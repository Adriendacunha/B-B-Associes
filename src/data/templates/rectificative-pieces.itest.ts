import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';
import { RECTIFICATIVE_TEMPLATE } from './declaration-rectificative';
import { rectPieceCode } from './rectificative-pieces';

// Invariant critique : chaque document du template rectificative DOIT avoir une
// PieceDefinition seedée (sinon la création de campagne perd silencieusement le doc).

describe('seed du template rectificative', () => {
  it('chaque document a une PieceDefinition correspondante', async () => {
    const codes = RECTIFICATIVE_TEMPLATE.documents.map((d) => rectPieceCode(d.id));
    const found = await prisma.pieceDefinition.findMany({ where: { code: { in: codes } }, select: { code: true } });
    const foundCodes = new Set(found.map((p) => p.code));
    const missing = codes.filter((c) => !foundCodes.has(c));
    expect(missing).toEqual([]);
  });
});
