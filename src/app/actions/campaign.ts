'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Prisma, ClientDeclaration } from '@prisma/client';
import { prisma } from '@/lib/db';
import { appendAuditLog } from '@/lib/audit/log';
import { requireStaff, requireClient } from '@/lib/auth/session';
import type { Answers } from '@/lib/questionnaire/types';
import { requestedDocuments } from '@/lib/questionnaire/engine';
import { RECTIFICATIVE_TEMPLATE } from '@/data/templates/declaration-rectificative';
import { rectPieceCode } from '@/data/templates/rectificative-pieces';

/** Borne l'année fiscale (2015 ≤ année ≤ année courante + 1). */
function assertFiscalYear(y: number): void {
  const min = 2015;
  const max = new Date().getUTCFullYear() + 1;
  if (!Number.isInteger(y) || y < min || y > max) {
    throw new Error(`Année fiscale invalide : attendu entre ${min} et ${max}.`);
  }
}

export interface CreateRectificativeInput {
  locale: string;
  clientCode: string;
  fiscalYear: number;
  answers: Answers;
}

/**
 * Crée (ou régénère) une campagne « Déclaration rectificative » à partir des
 * réponses du questionnaire conditionnel. Les documents générés deviennent des
 * ChecklistItem normaux (pièces RECT- seedées) → tout le pipeline de dépôt,
 * d'analyse IA et de validation est réutilisé tel quel.
 */
export async function createRectificativeCampaign(input: CreateRectificativeInput): Promise<void> {
  await requireStaff(input.locale);
  assertFiscalYear(input.fiscalYear);

  const client = await prisma.client.findUnique({ where: { clientCode: input.clientCode } });
  if (!client) throw new Error(`Client introuvable: ${input.clientCode}`);

  const docs = requestedDocuments(RECTIFICATIVE_TEMPLATE, input.answers);
  const codes = docs.map((d) => rectPieceCode(d.id));
  const defs = await prisma.pieceDefinition.findMany({ where: { code: { in: codes } } });
  const defByCode = new Map(defs.map((d) => [d.code, d]));

  const profileBlob = { templateId: RECTIFICATIVE_TEMPLATE.id, answers: input.answers } as unknown as Prisma.InputJsonValue;

  const campaign = await prisma.$transaction(async (tx) => {
    const existing = await tx.campaign.findUnique({
      where: { clientId_fiscalYear: { clientId: client.id, fiscalYear: input.fiscalYear } },
    });
    const camp = existing
      ? await tx.campaign.update({
          where: { id: existing.id },
          data: { profile: profileBlob, templateId: RECTIFICATIVE_TEMPLATE.id, status: 'EN_COURS', openedAt: new Date() },
        })
      : await tx.campaign.create({
          data: {
            clientId: client.id,
            fiscalYear: input.fiscalYear,
            profile: profileBlob,
            templateId: RECTIFICATIVE_TEMPLATE.id,
            status: 'EN_COURS',
            openedAt: new Date(),
          },
        });

    if (existing) await tx.checklistItem.deleteMany({ where: { campaignId: camp.id } });

    const items = docs.flatMap((d) => {
      const def = defByCode.get(rectPieceCode(d.id));
      if (!def) return [];
      return [
        {
          campaignId: camp.id,
          pieceDefinitionId: def.id,
          pieceCode: def.code,
          category: def.category as Prisma.ChecklistItemCreateManyInput['category'],
          required: d.obligation === 'obligatoire',
          expectedFiscalYear: input.fiscalYear,
          modeValidation: 'HUMAIN_REQUIS' as Prisma.ChecklistItemCreateManyInput['modeValidation'],
        },
      ];
    });
    await tx.checklistItem.createMany({ data: items });

    return camp;
  });

  await appendAuditLog(prisma, {
    actorType: 'COLLABORATEUR',
    actorId: client.gestionnaireId,
    action: 'CAMPAIGN_CREATED',
    entityType: 'Campaign',
    entityId: campaign.id,
    metadata: { clientCode: input.clientCode, fiscalYear: input.fiscalYear, template: RECTIFICATIVE_TEMPLATE.id, items: docs.length },
    createdAt: new Date(),
  });

  redirect(`/${input.locale}/campagne/${campaign.id}`);
}

const DECLARATIONS: ClientDeclaration[] = ['NON', 'OUI', 'NON_CONCERNE'];

/**
 * Déclaration de complétude par le client sur sa checklist (UX §7) : « Avez-vous
 * terminé de déposer les documents demandés ? » Non / Oui / Je ne suis pas
 * concerné. « OUI » et « NON_CONCERNE » suspendent les relances automatiques.
 */
export async function setClientDeclaration(formData: FormData): Promise<void> {
  const uiLocale = String(formData.get('locale') ?? 'fr');
  const campaignId = String(formData.get('campaignId') ?? '');
  const value = String(formData.get('declaration') ?? '');
  const client = await requireClient(uiLocale);
  if (!DECLARATIONS.includes(value as ClientDeclaration)) return;

  // Le client ne peut déclarer que sur SA propre campagne (§9).
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { id: true, clientId: true } });
  if (!campaign || campaign.clientId !== client.id) return;

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { clientDeclaration: value as ClientDeclaration, clientDeclarationAt: new Date() },
  });

  await appendAuditLog(prisma, {
    actorType: 'CLIENT',
    actorId: client.id,
    action: 'CLIENT_DECLARATION',
    entityType: 'Campaign',
    entityId: campaignId,
    metadata: { declaration: value },
    createdAt: new Date(),
  });

  revalidatePath(`/${uiLocale}/espace`);
  revalidatePath(`/${uiLocale}/campagne/${campaignId}`);
}

/**
 * Le client renseigne son formulaire d'intake (données du dossier) dans son
 * espace. Les réponses sont fusionnées dans le blob `answers` de la campagne,
 * sans écraser les réponses de qualification du cabinet.
 */
export async function saveIntakeAnswers(input: { locale: string; campaignId: string; answers: Answers }): Promise<void> {
  const client = await requireClient(input.locale);
  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    select: { id: true, clientId: true, profile: true, templateId: true },
  });
  if (!campaign || campaign.clientId !== client.id) return;

  const profile = (campaign.profile ?? {}) as { templateId?: string; answers?: Answers };
  const merged = { ...(profile.answers ?? {}), ...input.answers };
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      profile: { templateId: profile.templateId ?? campaign.templateId, answers: merged } as unknown as Prisma.InputJsonValue,
    },
  });
  revalidatePath(`/${input.locale}/espace`);
  revalidatePath(`/${input.locale}/campagne/${campaign.id}`);
}

/**
 * Le client déclare (ou annule) « Je ne suis pas concerné » pour une pièce
 * précise (UX écran 4/6). Bascule le statut entre NON_CONCERNE et MANQUANT.
 */
export async function setItemConcern(formData: FormData): Promise<void> {
  const uiLocale = String(formData.get('locale') ?? 'fr');
  const client = await requireClient(uiLocale);
  const itemId = String(formData.get('itemId') ?? '');
  const concerned = String(formData.get('concerned') ?? '') === 'true';

  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    select: { id: true, status: true, campaign: { select: { id: true, clientId: true } } },
  });
  if (!item || item.campaign.clientId !== client.id) return;
  // On ne touche pas à une pièce déjà déposée/validée (seulement MANQUANT ↔ NON_CONCERNE).
  if (concerned) {
    if (item.status === 'NON_CONCERNE') await prisma.checklistItem.update({ where: { id: itemId }, data: { status: 'MANQUANT' } });
  } else {
    if (item.status === 'MANQUANT') await prisma.checklistItem.update({ where: { id: itemId }, data: { status: 'NON_CONCERNE' } });
  }

  revalidatePath(`/${uiLocale}/espace`);
  revalidatePath(`/${uiLocale}/campagne/${item.campaign.id}`);
}
