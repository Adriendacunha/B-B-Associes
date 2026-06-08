import { describe, it, expect } from 'vitest';
import { buildChecklistItems, type BuildablePiece } from './build';
import type { ClientProfile } from './profiling';

const defs: BuildablePiece[] = [
  { id: 'p1', code: 'DECL-N1', category: 'A_TRIER', profils: ['PARTICULIER', 'NOUVEAU_CLIENT'], requiredByDefault: true, modeValidation: 'HUMAIN_REQUIS', expectedYearOffset: -1 },
  { id: 'p2', code: 'CERT-SALAIRE', category: 'REVENUS', profils: ['REVENU_SALARIE'], requiredByDefault: true, modeValidation: 'HUMAIN_REQUIS', expectedYearOffset: 0 },
  { id: 'p3', code: 'IMMO-HYPO', category: 'IMMOBILIER', profils: ['PROPRIETAIRE'], requiredByDefault: true, modeValidation: 'HUMAIN_REQUIS', expectedYearOffset: 0 },
];

const profile: ClientProfile = {
  type: 'PARTICULIER',
  residence: 'RESIDENT_CH',
  nouveauClient: true,
  revenuSalarie: true,
  logement: 'LOCATAIRE',
};

describe('buildChecklistItems (§4)', () => {
  it('ne retient que les pièces applicables au profil', () => {
    const items = buildChecklistItems(defs, profile, 2025);
    expect(items.map((i) => i.pieceCode).sort()).toEqual(['CERT-SALAIRE', 'DECL-N1']);
  });

  it("calcule l'année fiscale attendue avec le décalage de pièce", () => {
    const items = buildChecklistItems(defs, profile, 2025);
    const decl = items.find((i) => i.pieceCode === 'DECL-N1')!;
    const cert = items.find((i) => i.pieceCode === 'CERT-SALAIRE')!;
    expect(decl.expectedFiscalYear).toBe(2024); // offset -1 (taxation année précédente)
    expect(cert.expectedFiscalYear).toBe(2025);
  });

  it('conserve l’identifiant de définition pour le lien en base', () => {
    const items = buildChecklistItems(defs, profile, 2025);
    expect(items.find((i) => i.pieceCode === 'CERT-SALAIRE')!.pieceDefinitionId).toBe('p2');
  });
});
