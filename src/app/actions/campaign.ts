'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Prisma, ClientDeclaration } from '@prisma/client';
import { prisma } from '@/lib/db';
import { buildChecklistItems, type BuildablePiece } from '@/lib/checklist/build';
import { appendAuditLog } from '@/lib/audit/log';
import { requireStaff, requireClient } from '@/lib/auth/session';
import type { ClientProfile } from '@/lib/checklist/profiling';
import type { Answers } from '@/lib/questionnaire/types';
import { requestedDocuments } from '@/lib/questionnaire/engine';
import { RECTIFICATIVE_TEMPLATE } from '@/data/templates/declaration-rectificative';
import { rectPieceCode } from '@/data/templates/rectificative-pieces';

export interface CreateCampaignInput {
  locale: string;
  clientCode: string;
  fiscalYear: number;
  profile: ClientProfile;
}

/**
 * Crée (ou régénère) une campagne de collecte pour un client : sélectionne les
 * pièces selon le profil (§4), persiste la checklist, journalise (§8), puis
 * redirige vers la vue de campagne.
 */
export async function createCampaign(input: CreateCampaignInput): Promise<void> {
  await requireStaff(input.locale); // réservé au cabinet (§2/§8)

  const client = await prisma.client.findUnique({ where: { clientCode: input.clientCode } });
  if (!client) throw new Error(`Client introuvable: ${input.clientCode}`);

  const defs = await prisma.pieceDefinition.findMany({ where: { active: true } });
  const drafts = buildChecklistItems(defs as unknown as BuildablePiece[], input.profile, input.fiscalYear);

  const campaign = await prisma.$transaction(async (tx) => {
    const existing = await tx.campaign.findUnique({
      where: { clientId_fiscalYear: { clientId: client.id, fiscalYear: input.fiscalYear } },
    });

    const camp = existing
      ? await tx.campaign.update({
          where: { id: existing.id },
          data: { profile: input.profile as unknown as Prisma.InputJsonValue, status: 'EN_COURS', openedAt: new Date() },
        })
      : await tx.campaign.create({
          data: {
            clientId: client.id,
            fiscalYear: input.fiscalYear,
            profile: input.profile as unknown as Prisma.InputJsonValue,
            status: 'EN_COURS',
            openedAt: new Date(),
          },
        });

    if (existing) await tx.checklistItem.deleteMany({ where: { campaignId: camp.id } });

    await tx.checklistItem.createMany({
      data: drafts.map((d) => ({
        campaignId: camp.id,
        pieceDefinitionId: d.pieceDefinitionId,
        pieceCode: d.pieceCode,
        category: d.category as Prisma.ChecklistItemCreateManyInput['category'],
        required: d.required,
        expectedFiscalYear: d.expectedFiscalYear,
        modeValidation: d.modeValidation as Prisma.ChecklistItemCreateManyInput['modeValidation'],
      })),
    });

    return camp;
  });

  await appendAuditLog(prisma, {
    actorType: 'COLLABORATEUR',
    actorId: client.gestionnaireId,
    action: 'CAMPAIGN_CREATED',
    entityType: 'Campaign',
    entityId: campaign.id,
    metadata: { clientCode: input.clientCode, fiscalYear: input.fiscalYear, items: drafts.length },
    createdAt: new Date(),
  });

  redirect(`/${input.locale}/campagne/${campaign.id}`);
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
