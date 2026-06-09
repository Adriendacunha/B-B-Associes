// Politique de conservation / purge (§9). Une fois une pièce finalisée (déposée sur
// OneDrive ou rejetée) et au-delà du délai de rétention, la copie temporaire de
// l'application est supprimée — seule subsiste la copie OneDrive validée.
//
// Délai configurable via RETENTION_DAYS (défaut 180 j ~ 6 mois, à confirmer §14.3).

import { prisma } from '@/lib/db';
import { clearDocumentContent } from '@/lib/storage/document';

export interface RetentionResult {
  scanned: number;
  purged: number;
}

export function retentionDays(): number {
  const n = Number(process.env.RETENTION_DAYS ?? '180');
  return Number.isFinite(n) && n > 0 ? n : 180;
}

export async function runRetention(now: Date = new Date()): Promise<RetentionResult> {
  const cutoff = new Date(now.getTime() - retentionDays() * 86_400_000);

  // Pièces finalisées dont la copie temporaire (DocumentBlob) subsiste encore.
  const docs = await prisma.document.findMany({
    where: {
      blob: { isNot: null },
      status: { in: ['DEPOSE_ONEDRIVE', 'REJETE'] },
      uploadedAt: { lt: cutoff },
    },
    select: { id: true },
  });

  let purged = 0;
  for (const d of docs) {
    await clearDocumentContent(d.id);
    await prisma.document.update({ where: { id: d.id }, data: { purgedAt: now } });
    purged += 1;
  }
  return { scanned: docs.length, purged };
}
