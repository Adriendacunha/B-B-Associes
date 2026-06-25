import { describe, it, expect } from 'vitest';
import { PIECE_REFERENTIAL, deriveRequirement, findPiece } from './piece-referential';

describe('deriveRequirement (§4.2 — règle 3 niveaux)', () => {
  it('OPTIONNEL dès que la pièce n’est pas requise par défaut', () => {
    expect(deriveRequirement({ profils: ['PARTICULIER'], requiredByDefault: false })).toBe('OPTIONNEL');
    expect(deriveRequirement({ profils: ['TITRES'], requiredByDefault: false })).toBe('OPTIONNEL');
  });

  it('OBLIGATOIRE si requise et non filtrée (universelle)', () => {
    expect(deriveRequirement({ profils: [], requiredByDefault: true })).toBe('OBLIGATOIRE');
    expect(deriveRequirement({ profils: ['PARTICULIER'], requiredByDefault: true })).toBe('OBLIGATOIRE');
  });

  it('SI_CONCERNE si requise mais conditionnée à une question de filtrage', () => {
    expect(deriveRequirement({ profils: ['REVENU_SALARIE'], requiredByDefault: true })).toBe('SI_CONCERNE');
    expect(deriveRequirement({ profils: ['PARTICULIER', 'NOUVEAU_CLIENT'], requiredByDefault: true })).toBe('SI_CONCERNE');
  });

  it('classe correctement quelques pièces clés du référentiel', () => {
    const expectations: Record<string, string> = {
      'IDENT-FISCAL': 'OBLIGATOIRE',
      'DECL-N1': 'OBLIGATOIRE',
      'RELEVE-BANCAIRE': 'OBLIGATOIRE',
      LAMAL: 'OBLIGATOIRE',
      'CERT-SALAIRE': 'SI_CONCERNE',
      'ETAT-TITRES': 'SI_CONCERNE',
      'DECOMPTE-CHOMAGE': 'SI_CONCERNE',
      'ALLOC-FAMILIALES': 'SI_CONCERNE',
      SUBSIDES: 'SI_CONCERNE',
      'IMMO-IIC': 'SI_CONCERNE',
      'FRAIS-MEDICAUX': 'OPTIONNEL',
      'RACHAT-LPP': 'OPTIONNEL',
      'GAIN-LOTERIE': 'OPTIONNEL',
      'PARTICIPATION-QUALIFIEE': 'OPTIONNEL',
    };
    for (const [code, level] of Object.entries(expectations)) {
      const piece = findPiece(code);
      expect(piece, `pièce ${code} absente du référentiel`).toBeDefined();
      expect(deriveRequirement(piece!), code).toBe(level);
    }
  });

  it('toutes les pièces du référentiel ont un niveau dérivable', () => {
    for (const p of PIECE_REFERENTIAL) {
      expect(['OBLIGATOIRE', 'SI_CONCERNE', 'OPTIONNEL']).toContain(deriveRequirement(p));
    }
  });
});
