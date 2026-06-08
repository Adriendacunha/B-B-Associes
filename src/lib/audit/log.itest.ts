import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { appendAuditLog } from './log';
import { computeEntryHash } from './chain';

// Intégration §8 : l'écriture du journal chaîne bien chaque entrée au hash
// précédent, et le hash stocké correspond au recalcul (inaltérabilité).

const hashes: string[] = [];

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { hash: { in: hashes } } });
});

describe('appendAuditLog (intégration §8)', () => {
  it('chaîne chaque entrée au hash de la précédente', async () => {
    const e1 = await appendAuditLog(prisma, { actorType: 'SYSTEM', action: 'ITEST_A', entityType: 'Test', createdAt: new Date() });
    const e2 = await appendAuditLog(prisma, { actorType: 'SYSTEM', action: 'ITEST_B', entityType: 'Test', createdAt: new Date() });
    hashes.push(e1.hash, e2.hash);

    expect(e2.prevHash).toBe(e1.hash);

    const recomputed = computeEntryHash(
      { actorType: 'SYSTEM', actorId: null, action: 'ITEST_B', entityType: 'Test', entityId: null, metadata: {}, createdAt: e2.createdAt },
      e1.hash,
    );
    expect(recomputed).toBe(e2.hash);
  });
});
