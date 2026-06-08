import { describe, it, expect } from 'vitest';
import { stubVerdict, detectYear, codeKeywords } from './stub';

describe('détection auxiliaire', () => {
  it('detectYear trouve une année 20xx', () => {
    expect(detectYear('2025_dupont_salaire.pdf')).toBe(2025);
    expect(detectYear('aucune annee ici')).toBeNull();
  });
  it('codeKeywords garde les tokens ≥ 4 lettres', () => {
    expect(codeKeywords('CERT-SALAIRE')).toEqual(['cert', 'salaire']);
    expect(codeKeywords('3A')).toEqual([]);
  });
});

describe('stubVerdict (analyse de démonstration §7)', () => {
  it('conforme quand année + type correspondent', () => {
    const v = stubVerdict({ pieceCode: 'CERT-SALAIRE', expectedFiscalYear: 2025, filename: '2025_certificat_salaire.pdf' });
    expect(v.conforme).toBe(true);
    expect(v.annee_detectee).toBe(2025);
    expect(v.anomalies).toEqual([]);
  });

  it('signale une mauvaise année', () => {
    const v = stubVerdict({ pieceCode: 'CERT-SALAIRE', expectedFiscalYear: 2025, filename: '2023_salaire.pdf' });
    expect(v.conforme).toBe(false);
    expect(v.anomalies).toContain('mauvaise_annee');
  });

  it('signale un mauvais type', () => {
    const v = stubVerdict({ pieceCode: 'CERT-SALAIRE', expectedFiscalYear: 2025, filename: '2025_facture_garage.pdf' });
    expect(v.conforme).toBe(false);
    expect(v.anomalies).toContain('mauvais_type');
  });

  it('pièce sans mot-clé exploitable : type non infirmable', () => {
    const v = stubVerdict({ pieceCode: '3A', expectedFiscalYear: 2025, filename: '2025_attestation.pdf' });
    expect(v.anomalies).not.toContain('mauvais_type');
    expect(v.conforme).toBe(true);
  });

  it('message client présent dans les 3 langues', () => {
    const v = stubVerdict({ pieceCode: 'CERT-SALAIRE', expectedFiscalYear: 2025, filename: 'x.pdf' });
    expect(v.message_client.fr).toBeTruthy();
    expect(v.message_client.en).toBeTruthy();
    expect(v.message_client.de).toBeTruthy();
  });
});
