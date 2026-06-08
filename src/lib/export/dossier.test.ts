import { describe, it, expect } from 'vitest';
import { buildRecapCsv, exportBaseName, type RecapRow } from './dossier';

const meta = { clientCode: 'C0001', clientName: 'Dupont Jean', fiscalYear: 2025 };
const rows: RecapRow[] = [
  {
    pieceCode: 'CERT-SALAIRE',
    nom: 'Certificat de salaire',
    category: 'REVENUS',
    required: true,
    status: 'CONFORME',
    finalFilename: '2025_Dupont-Jean_CERT-SALAIRE_20260608.pdf',
    depositDate: new Date('2026-06-08T09:00:00Z'),
    validationDate: new Date('2026-06-08T10:00:00Z'),
  },
  {
    pieceCode: 'LAMAL',
    nom: 'Primes; assurance "maladie"',
    category: 'DEDUCTIONS',
    required: true,
    status: 'MANQUANT',
    finalFilename: null,
    depositDate: null,
    validationDate: null,
  },
];

describe('buildRecapCsv (§10)', () => {
  const csv = buildRecapCsv(meta, rows);
  const lines = csv.replace('﻿', '').split('\r\n');

  it('commence par un BOM UTF-8', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });
  it('a l’en-tête attendu', () => {
    expect(lines[0]).toBe('ID-Client;Nom-Client;AnneeFiscale;CodePiece;Piece;Categorie;Obligatoire;Statut;FichierFinal;DateDepot;DateValidation');
  });
  it('écrit une ligne conforme avec dates ISO', () => {
    expect(lines[1]).toBe('C0001;Dupont Jean;2025;CERT-SALAIRE;Certificat de salaire;REVENUS;oui;CONFORME;2025_Dupont-Jean_CERT-SALAIRE_20260608.pdf;2026-06-08;2026-06-08');
  });
  it('échappe les cellules contenant ; ou guillemets', () => {
    expect(lines[2]).toContain('"Primes; assurance ""maladie"""');
    expect(lines[2]).toContain(';MANQUANT;;;');
  });
});

describe('exportBaseName', () => {
  it('produit un nom sans accents ni espaces', () => {
    expect(exportBaseName({ clientCode: 'C0002', clientName: 'Müller Anna', fiscalYear: 2025 })).toBe('2025_C0002_Muller-Anna');
  });
});
