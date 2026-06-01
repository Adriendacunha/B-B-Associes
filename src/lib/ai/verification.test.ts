import { describe, it, expect } from 'vitest';
import { buildVerificationPrompt, parseVerdict, decideRouting, type ExpectedPiece } from './verification';

const piece: ExpectedPiece = {
  code: 'CERT-SALAIRE',
  nom: 'Certificat de salaire',
  description: 'Certificat de salaire annuel',
  expectedFiscalYear: 2025,
  clientDisplayName: 'Dupont Jean',
  acceptedFormats: ['pdf', 'jpg', 'png'],
};

describe('buildVerificationPrompt (§7.2)', () => {
  it('inclut le code, l’année et le titulaire', () => {
    const prompt = buildVerificationPrompt(piece, 'texte OCR...', 'fr');
    expect(prompt).toContain('CERT-SALAIRE');
    expect(prompt).toContain('2025');
    expect(prompt).toContain('Dupont Jean');
    expect(prompt).toContain('français');
  });
  it('mentionne la signature si requise', () => {
    const prompt = buildVerificationPrompt({ ...piece, signatureRequired: true }, 't', 'de');
    expect(prompt).toContain('signature');
    expect(prompt).toContain('allemand');
  });
});

describe('parseVerdict (§7.2)', () => {
  it('parse une réponse JSON valide', () => {
    const raw = JSON.stringify({
      conforme: true,
      type_detecte: 'certificat de salaire',
      annee_detectee: 2025,
      score_lisibilite: 0.95,
      anomalies: [],
      message_client: 'Document reçu.',
    });
    const v = parseVerdict(raw);
    expect(v.conforme).toBe(true);
    expect(v.annee_detectee).toBe(2025);
  });
  it('tolère un bloc ```json', () => {
    const raw = '```json\n{"conforme":false,"type_detecte":null,"annee_detectee":null,"score_lisibilite":0.2,"anomalies":["illisible"],"message_client":"Flou."}\n```';
    expect(parseVerdict(raw).conforme).toBe(false);
  });
  it('rejette une sortie non conforme au schéma', () => {
    expect(() => parseVerdict('{"conforme":"oui"}')).toThrow();
  });
});

describe('decideRouting (§4.2/§15)', () => {
  const verdict = parseVerdict(
    '{"conforme":true,"type_detecte":"x","annee_detectee":2025,"score_lisibilite":0.9,"anomalies":[],"message_client":"ok"}',
  );
  it('MVP : HUMAIN_REQUIS -> toujours validation humaine', () => {
    expect(decideRouting({ verdict, pieceMode: 'HUMAIN_REQUIS', clientNiveau: 'EXPERT' })).toBe('EN_VALIDATION');
    expect(decideRouting({ verdict, pieceMode: 'HUMAIN_REQUIS', clientNiveau: 'AUTO' })).toBe('EN_VALIDATION');
  });
  it('auto seulement si pièce AUTO_AUTORISE ET client AUTO', () => {
    expect(decideRouting({ verdict, pieceMode: 'AUTO_AUTORISE', clientNiveau: 'EXPERT' })).toBe('EN_VALIDATION');
    expect(decideRouting({ verdict, pieceMode: 'AUTO_AUTORISE', clientNiveau: 'AUTO' })).toBe('AUTO_VALIDE');
  });
});
