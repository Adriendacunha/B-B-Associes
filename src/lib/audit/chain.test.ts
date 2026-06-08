import { describe, it, expect } from 'vitest';
import { sealEntry, verifyChain, type AuditEntryInput, type SealedAuditEntry } from './chain';

function entry(action: string, at: string): AuditEntryInput {
  return {
    actorType: 'COLLABORATEUR',
    actorId: 'u1',
    action,
    entityType: 'Document',
    entityId: 'd1',
    metadata: { foo: 'bar' },
    createdAt: new Date(at),
  };
}

describe('chaîne d’audit inaltérable (§8)', () => {
  function buildChain(): SealedAuditEntry[] {
    const e1 = sealEntry(entry('UPLOAD', '2026-01-01T10:00:00Z'), null);
    const e2 = sealEntry(entry('REVIEW_VALIDATE', '2026-01-01T11:00:00Z'), e1.hash);
    const e3 = sealEntry(entry('EMAIL_SENT', '2026-01-01T12:00:00Z'), e2.hash);
    return [e1, e2, e3];
  }

  it('une chaîne intègre passe la vérification', () => {
    expect(verifyChain(buildChain())).toBe(-1);
  });

  it('détecte une altération de contenu', () => {
    const chain = buildChain();
    chain[1] = { ...chain[1], action: 'REVIEW_REJECT' }; // modifié sans recalcul
    expect(verifyChain(chain)).toBe(1);
  });

  it('détecte une rupture de chaînage', () => {
    const chain = buildChain();
    chain[2] = { ...chain[2], prevHash: 'faux' };
    expect(verifyChain(chain)).toBe(2);
  });

  it('hash déterministe quel que soit l’ordre des clés de metadata', () => {
    const a = sealEntry({ ...entry('X', '2026-01-01T10:00:00Z'), metadata: { a: 1, b: 2 } }, null);
    const b = sealEntry({ ...entry('X', '2026-01-01T10:00:00Z'), metadata: { b: 2, a: 1 } }, null);
    expect(a.hash).toBe(b.hash);
  });
});
