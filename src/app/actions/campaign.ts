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
import { planChecklistSync } from '@/lib/checklist/rectificative-sync';
import { A_TRIER_CODE } from '@/data/piece-referential';

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

  // `cabinetKeys` = questions répondues par le cabinet → verrouillées côté client.
  // Le client pourra répondre à TOUTES les autres questions visibles dans son espace.
  const profileBlob = {
    templateId: RECTIFICATIVE_TEMPLATE.id,
    answers: input.answers,
    cabinetKeys: Object.keys(input.answers),
  } as unknown as Prisma.InputJsonValue;

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
 * Le client répond, dans son espace, à toutes les questions de la déclaration que
 * le cabinet a laissées sans réponse (orientation, détail, infos). On fusionne ses
 * réponses (sans écraser celles verrouillées par le cabinet) PUIS on resynchronise
 * sa checklist : ajout des pièces nouvellement demandées, retrait de celles qui ne
 * le sont plus — jamais une pièce déjà déposée ni la pièce système « À trier ».
 */
export async function saveClientQuestionnaire(input: { locale: string; campaignId: string; answers: Answers }): Promise<void> {
  const client = await requireClient(input.locale);
  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    include: {
      checklistItems: { select: { id: true, pieceCode: true, _count: { select: { documents: true } } } },
    },
  });
  if (!campaign || campaign.clientId !== client.id) return;
  if (campaign.templateId !== RECTIFICATIVE_TEMPLATE.id) return;

  const profile = (campaign.profile ?? {}) as { templateId?: string; answers?: Answers; cabinetKeys?: string[] };
  const stored = profile.answers ?? {};
  // Verrou : les questions répondues par le cabinet ne sont pas modifiables ici.
  const cabinetKeys = profile.cabinetKeys ?? Object.keys(stored);
  const locked = new Set(cabinetKeys);
  const clientAnswers: Answers = {};
  for (const [k, v] of Object.entries(input.answers)) if (!locked.has(k)) clientAnswers[k] = v;
  const merged = { ...stored, ...clientAnswers };

  const existing = campaign.checklistItems.map((i) => ({
    id: i.id,
    pieceCode: i.pieceCode,
    hasDocuments: i._count.documents > 0,
  }));
  const plan = planChecklistSync(merged, existing, [A_TRIER_CODE]);

  const defs = plan.create.length
    ? await prisma.pieceDefinition.findMany({ where: { code: { in: plan.create.map((c) => c.pieceCode) } } })
    : [];
  const defByCode = new Map(defs.map((d) => [d.code, d]));
  const idByCode = new Map(existing.map((i) => [i.pieceCode, i.id]));

  await prisma.$transaction(async (tx) => {
    await tx.campaign.update({
      where: { id: campaign.id },
      data: {
        profile: { templateId: RECTIFICATIVE_TEMPLATE.id, answers: merged, cabinetKeys } as unknown as Prisma.InputJsonValue,
      },
    });
    const deleteIds = plan.deleteCodes.map((c) => idByCode.get(c)).filter((x): x is string => Boolean(x));
    if (deleteIds.length) await tx.checklistItem.deleteMany({ where: { id: { in: deleteIds } } });

    const toCreate = plan.create.flatMap((c) => {
      const def = defByCode.get(c.pieceCode);
      if (!def) return [];
      return [
        {
          campaignId: campaign.id,
          pieceDefinitionId: def.id,
          pieceCode: def.code,
          category: def.category as Prisma.ChecklistItemCreateManyInput['category'],
          required: c.required,
          expectedFiscalYear: campaign.fiscalYear,
          modeValidation: 'HUMAIN_REQUIS' as Prisma.ChecklistItemCreateManyInput['modeValidation'],
        },
      ];
    });
    if (toCreate.length) await tx.checklistItem.createMany({ data: toCreate });
  });

  await appendAuditLog(prisma, {
    actorType: 'CLIENT',
    actorId: client.id,
    action: 'CLIENT_QUESTIONNAIRE',
    entityType: 'Campaign',
    entityId: campaign.id,
    metadata: { added: plan.create.length, removed: plan.deleteCodes.length },
    createdAt: new Date(),
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
