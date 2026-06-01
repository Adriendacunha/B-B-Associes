import { describe, it, expect } from 'vitest';
import {
  normalizeSegment,
  campaignRootPath,
  campaignFolderTree,
  buildFileName,
  buildFinalPath,
} from './paths';

describe('normalizeSegment', () => {
  it('retire accents et espaces (§5.3)', () => {
    expect(normalizeSegment('Dupont Jean')).toBe('Dupont-Jean');
    expect(normalizeSegment('Société Générale')).toBe('Societe-Generale');
    expect(normalizeSegment("L'Hoirie Müller")).toBe('LHoirie-Muller');
  });
  it('nettoie les tirets en trop', () => {
    expect(normalizeSegment('  a   b  ')).toBe('a-b');
    expect(normalizeSegment('Acme Sàrl')).toBe('Acme-Sarl');
  });
});

describe('arborescence campagne (§5.2)', () => {
  const params = { clientCode: 'C0042', clientDisplayName: 'Dupont Jean', fiscalYear: 2025 };
  it('chemin racine', () => {
    expect(campaignRootPath(params)).toBe('/Clients fiscaux/C0042 - Dupont Jean/2025');
  });
  it('crée les 7 dossiers ordonnés', () => {
    const tree = campaignFolderTree(params);
    expect(tree).toHaveLength(8); // racine + 7 sous-dossiers
    expect(tree[1]).toContain('01 - Revenus');
    expect(tree[7]).toContain('99 - A trier-Non classe');
  });
});

describe('buildFileName (§5.3)', () => {
  const date = new Date(Date.UTC(2026, 0, 14)); // 2026-01-14
  it('format de base', () => {
    expect(
      buildFileName({ fiscalYear: 2025, clientDisplayName: 'Dupont Jean', pieceCode: 'CERT-SALAIRE', depositDate: date }),
    ).toBe('2025_Dupont-Jean_CERT-SALAIRE_20260114.pdf');
  });
  it('gère les doublons par suffixe _v2', () => {
    expect(
      buildFileName({ fiscalYear: 2025, clientDisplayName: 'Acme Sarl', pieceCode: 'TVA-Q3', depositDate: date, version: 2 }),
    ).toBe('2025_Acme-Sarl_TVA-Q3_20260114_v2.pdf');
  });
  it('respecte une extension image convertie', () => {
    expect(
      buildFileName({ fiscalYear: 2025, clientDisplayName: 'Dupont Jean', pieceCode: '3A', depositDate: date, extension: '.PNG' }),
    ).toBe('2025_Dupont-Jean_3A_20260114.png');
  });
});

describe('buildFinalPath', () => {
  it('place le fichier dans la bonne sous-catégorie', () => {
    const path = buildFinalPath(
      { clientCode: 'C0042', clientDisplayName: 'Dupont Jean', fiscalYear: 2025 },
      'REVENUS',
      { fiscalYear: 2025, clientDisplayName: 'Dupont Jean', pieceCode: 'CERT-SALAIRE', depositDate: new Date(Date.UTC(2026, 0, 14)) },
    );
    expect(path).toBe('/Clients fiscaux/C0042 - Dupont Jean/2025/01 - Revenus/2025_Dupont-Jean_CERT-SALAIRE_20260114.pdf');
  });
});
