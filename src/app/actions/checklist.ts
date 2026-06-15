'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/session';
import { appendAuditLog } from '@/lib/audit/log';

// Personnalisation de la checklist par le cabinet (écran 3) : rendre une pièce
// obligatoire/optionnelle, la supprimer, en ajouter, annoter (note interne /
// explication client) et fixer une date limite.

async function revalidateCampaign(campaignId: string, locale: string) {
  revalidatePath(`/${locale}/campagne/${campaignId}`);
  revalidatePath(`/${locale}/espace`);
}

/** Bascule obligatoire ↔ optionnel. */
export async function setItemRequired(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'fr');
  await requireStaff(locale);
  const itemId = String(formData.get('itemId') ?? '');
  const required = String(formData.get('required') ?? '') === 'true';
  const item = await prisma.checklistItem.update({
    where: { id: itemId },
    data: { required },
    select: { campaignId: true },
  });
  await revalidateCampaign(item.campaignId, locale);
}

/** Supprime une pièce de la checklist (cascade documents). */
export async function deleteItem(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'fr');
  await requireStaff(locale);
  const itemId = String(formData.get('itemId') ?? '');
  const item = await prisma.checklistItem.findUnique({ where: { id: itemId }, select: { campaignId: true } });
  if (!item) return;
  await prisma.checklistItem.delete({ where: { id: itemId } });
  await revalidateCampaign(item.campaignId, locale);
}

/** Met à jour note interne, explication client et date limite d'une pièce. */
export async function updateItemDetails(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'fr');
  await requireStaff(locale);
  const itemId = String(formData.get('itemId') ?? '');
  const internalNote = String(formData.get('internalNote') ?? '').trim() || null;
  const clientNote = String(formData.get('clientNote') ?? '').trim() || null;
  const dueRaw = String(formData.get('dueDate') ?? '').trim();
  const dueDate = dueRaw ? new Date(dueRaw) : null;
  const item = await prisma.checklistItem.update({
    where: { id: itemId },
    data: { internalNote, clientNote, dueDate },
    select: { campaignId: true },
  });
  await revalidateCampaign(item.campaignId, locale);
}

/** Ajoute une pièce du référentiel à la campagne. */
export async function addItemFromCatalogue(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'fr');
  const staff = await requireStaff(locale);
  const campaignId = String(formData.get('campaignId') ?? '');
  const pieceDefinitionId = String(formData.get('pieceDefinitionId') ?? '');
  if (!pieceDefinitionId) return;

  const [campaign, def] = await Promise.all([
    prisma.campaign.findUnique({ where: { id: campaignId }, select: { id: true, fiscalYear: true } }),
    prisma.pieceDefinition.findUnique({ where: { id: pieceDefinitionId } }),
  ]);
  if (!campaign || !def) return;

  try {
    await prisma.checklistItem.create({
      data: {
        campaignId: campaign.id,
        pieceDefinitionId: def.id,
        pieceCode: def.code,
        category: def.category,
        required: def.requiredByDefault,
        expectedFiscalYear: campaign.fiscalYear,
        modeValidation: def.modeValidation,
      },
    });
    await appendAuditLog(prisma, {
      actorType: staff.role === 'ADMIN' ? 'ADMIN' : 'COLLABORATEUR',
      actorId: staff.id,
      action: 'CHECKLIST_ITEM_ADDED',
      entityType: 'Campaign',
      entityId: campaign.id,
      metadata: { pieceCode: def.code },
      createdAt: new Date(),
    });
  } catch (e) {
    // @@unique(campaignId, pieceDefinitionId) : pièce déjà présente → ignorer.
    if (!(e as Prisma.PrismaClientKnownRequestError)?.code) throw e;
  }
  await revalidateCampaign(campaign.id, locale);
}
