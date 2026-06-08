'use server';

import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { buildChecklistItems, type BuildablePiece } from '@/lib/checklist/build';
import { appendAuditLog } from '@/lib/audit/log';
import type { ClientProfile } from '@/lib/checklist/profiling';

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
