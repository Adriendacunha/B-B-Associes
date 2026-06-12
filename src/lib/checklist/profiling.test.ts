import { describe, it, expect } from 'vitest';
import {
  deriveProfileTags,
  pieceApplies,
  selectRequiredPieces,
  carryOverProfile,
  type ClientProfile,
  type SelectablePiece,
} from './profiling';

const baseParticulier: ClientProfile = {
  type: 'PARTICULIER',
  residence: 'RESIDENT_CH',
  revenuSalarie: true,
  logement: 'LOCATAIRE',
};

describe('deriveProfileTags (§4.1)', () => {
  it('produit les tags attendus', () => {
    const tags = deriveProfileTags({ ...baseParticulier, nbEnfants: 2, pilier3a: true });
    expect(tags.has('PARTICULIER')).toBe(true);
    expect(tags.has('RESIDENT_CH')).toBe(true);
    expect(tags.has('REVENU_SALARIE')).toBe(true);
    expect(tags.has('ENFANTS')).toBe(true);
    expect(tags.has('PILIER_3A')).toBe(true);
    expect(tags.has('PROPRIETAIRE')).toBe(false);
  });
  it('n’ajoute pas ENFANTS si 0 enfant', () => {
    expect(deriveProfileTags({ ...baseParticulier, nbEnfants: 0 }).has('ENFANTS')).toBe(false);
  });

  it('Niveau 1 — émet le tag de situation de famille', () => {
    expect(deriveProfileTags({ ...baseParticulier, situationFamille: 'MARIE_PACS' }).has('MARIE_PACS')).toBe(true);
    expect(deriveProfileTags({ ...baseParticulier, situationFamille: 'SEPARE_DIVORCE' }).has('SEPARE_DIVORCE')).toBe(true);
  });

  it('Niveau 1 — un retraité dérive RETRAITE et RENTES', () => {
    const tags = deriveProfileTags({ ...baseParticulier, retraite: true });
    expect(tags.has('RETRAITE')).toBe(true);
    expect(tags.has('RENTES')).toBe(true);
  });

  it('Niveau 2 — activité accessoire et frais médicaux émettent leurs tags', () => {
    const tags = deriveProfileTags({ ...baseParticulier, activiteAccessoire: true, fraisMedicaux: true });
    expect(tags.has('ACTIVITE_ACCESSOIRE')).toBe(true);
    expect(tags.has('FRAIS_MEDICAUX')).toBe(true);
  });
});

describe('pieceApplies (sémantique ET)', () => {
  const tags = deriveProfileTags(baseParticulier);
  it('inclut une pièce dont tous les tags sont satisfaits', () => {
    const piece: SelectablePiece = { code: 'CERT-SALAIRE', profils: ['REVENU_SALARIE'] };
    expect(pieceApplies(piece, tags)).toBe(true);
  });
  it('exclut une pièce avec un tag manquant', () => {
    const piece: SelectablePiece = { code: 'ATTEST-SOURCE', profils: ['FRONTALIER'] };
    expect(pieceApplies(piece, tags)).toBe(false);
  });
  it('inclut une pièce universelle (profils vide)', () => {
    expect(pieceApplies({ code: 'X', profils: [] }, tags)).toBe(true);
  });
  it('exclut une pièce inactive', () => {
    expect(pieceApplies({ code: 'X', profils: [], active: false }, tags)).toBe(false);
  });
});

describe('selectRequiredPieces', () => {
  const defs: SelectablePiece[] = [
    { code: 'CERT-SALAIRE', profils: ['REVENU_SALARIE'] },
    { code: 'ATTEST-SOURCE', profils: ['FRONTALIER'] },
    { code: 'IMMO-HYPO', profils: ['PROPRIETAIRE'] },
  ];
  it('sélectionne selon le profil', () => {
    const codes = selectRequiredPieces(defs, baseParticulier).map((p) => p.code);
    expect(codes).toEqual(['CERT-SALAIRE']);
  });
  it('frontalier propriétaire', () => {
    const codes = selectRequiredPieces(defs, {
      type: 'PARTICULIER',
      residence: 'FRONTALIER',
      revenuSalarie: true,
      logement: 'PROPRIETAIRE',
    }).map((p) => p.code);
    expect(codes).toEqual(['CERT-SALAIRE', 'ATTEST-SOURCE', 'IMMO-HYPO']);
  });

  it('Niveau 1+2 — sélectionne les pièces des nouvelles situations', () => {
    const withNew: SelectablePiece[] = [
      ...defs,
      { code: 'REVENU-ACCESSOIRE', profils: ['ACTIVITE_ACCESSOIRE'] },
      { code: 'FRAIS-MEDICAUX', profils: ['FRAIS_MEDICAUX'] },
      { code: 'DIVORCE-JUGEMENT', profils: ['SEPARE_DIVORCE'] },
      { code: 'ATTEST-RENTES', profils: ['RENTES'] },
    ];
    const codes = selectRequiredPieces(withNew, {
      type: 'PARTICULIER',
      residence: 'RESIDENT_CH',
      situationFamille: 'SEPARE_DIVORCE',
      retraite: true,
      activiteAccessoire: true,
      fraisMedicaux: true,
    }).map((p) => p.code);
    expect(codes).toContain('REVENU-ACCESSOIRE');
    expect(codes).toContain('FRAIS-MEDICAUX');
    expect(codes).toContain('DIVORCE-JUGEMENT');
    expect(codes).toContain('ATTEST-RENTES'); // dérivé de retraite
  });
});

describe('carryOverProfile (§4.3)', () => {
  it('reprend le profil précédent avec overrides', () => {
    const next = carryOverProfile(baseParticulier, { logement: 'PROPRIETAIRE' });
    expect(next.logement).toBe('PROPRIETAIRE');
    expect(next.revenuSalarie).toBe(true);
  });
});
