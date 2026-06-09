import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { runRetention } from './run';
import { putDocumentContent, getDocumentContent } from '@/lib/storage/document';

// Intégration §9 : la purge supprime la copie temporaire (DocumentBlob) des pièces
// finalisées au-delà du délai, en préservant les pièces récentes.

const createdClientIds: string[] = [];

async function makeFinalizedDoc(uploadedDaysAgo: number) {
  const code = 'RET-' + Math.random().toString(36).slice(2, 9).toUpperCase();
  const client = await prisma.client.create({
    data: { clientCode: code, displayName: 'Ret Client', type: 'PARTICULIER', email: `${code.toLowerCase()}@test.ch`, locale: 'FR' },
  });
  createdClientIds.push(client.id);
  const piece = await prisma.pieceDefinition.findFirstOrThrow();
  const campaign = await prisma.campaign.create({ data: { clientId: client.id, fiscalYear: 2025, profile: {} } });
  const item = await prisma.checklistItem.create({
    data: { campaignId: campaign.id, pieceDefinitionId: piece.id, pieceCode: piece.code, category: piece.category, required: true, expectedFiscalYear: 2025, status: 'CONFORME' },
  });
  const doc = await prisma.document.create({
    data: {
      checklistItemId: item.id,
      version: 1,
      originalFilename: 'p.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 13,
      status: 'DEPOSE_ONEDRIVE',
      uploadedAt: new Date(Date.now() - uploadedDaysAgo * 86_400_000),
    },
  });
  await putDocumentContent(doc.id, Buffer.from('contenu pièce'));
  return doc.id;
}

afterAll(async () => {
  for (const clientId of createdClientIds) {
    await prisma.campaign.deleteMany({ where: { clientId } });
    await prisma.client.delete({ where: { id: clientId } }).catch(() => {});
  }
});

describe('runRetention (intégration §9)', () => {
  it('purge la copie temporaire des pièces finalisées anciennes, garde les récentes', async () => {
    const oldDocId = await makeFinalizedDoc(400); // > 180 j
    const recentDocId = await makeFinalizedDoc(5); // récent

    await runRetention();

    const oldDoc = await prisma.document.findUniqueOrThrow({ where: { id: oldDocId } });
    expect(oldDoc.purgedAt).not.toBeNull();
    expect(await getDocumentContent(oldDocId)).toBeNull(); // contenu purgé

    // le contenu de la pièce récente est toujours lisible
    const recent = await getDocumentContent(recentDocId);
    expect(recent?.toString()).toBe('contenu pièce');
  });
});
