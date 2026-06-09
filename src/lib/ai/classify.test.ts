import { describe, it, expect } from 'vitest';
import { stubClassify } from './classify';

const candidates = [
  { pieceCode: 'CERT-SALAIRE', nom: 'Certificat de salaire', description: 'Certificat annuel' },
  { pieceCode: 'RELEVE-BANCAIRE', nom: 'Relevés bancaires et postaux au 31.12', description: 'Soldes et intérêts' },
  { pieceCode: '3A', nom: 'Attestation 3e pilier A', description: 'Montant versé' },
];

describe('stubClassify (tri par mots-clés §7)', () => {
  it('reconnaît un certificat de salaire par le contenu', () => {
    expect(stubClassify({ filename: 'doc.pdf', text: 'Certificat de salaire 2025 employeur ACME', candidates })).toBe('CERT-SALAIRE');
  });
  it('reconnaît un relevé bancaire par le nom de fichier', () => {
    expect(stubClassify({ filename: 'releve_bancaire_2025.pdf', text: '', candidates })).toBe('RELEVE-BANCAIRE');
  });
  it('renvoie null quand rien ne correspond', () => {
    expect(stubClassify({ filename: 'photo.jpg', text: 'contenu sans rapport', candidates })).toBeNull();
  });
});
