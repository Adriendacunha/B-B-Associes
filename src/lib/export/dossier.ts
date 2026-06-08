// Export d'un dossier vers les logiciels comptables (Crésus / Banana) — §10.
//
// Pas d'intégration transactionnelle (hors périmètre) : on produit des FICHIERS.
//  - un CSV récapitulatif (client, pièces, statut, dates) réutilisable ;
//  - un ZIP des pièces validées (correctement nommées) + ce CSV.
//
// Le builder CSV est pur et testable. Le ZIP s'appuie sur JSZip.

import JSZip from 'jszip';

export interface RecapMeta {
  clientCode: string;
  clientName: string;
  fiscalYear: number;
}

export interface RecapRow {
  pieceCode: string;
  nom: string;
  category: string;
  required: boolean;
  status: string;
  finalFilename: string | null;
  depositDate: Date | null;
  validationDate: Date | null;
}

const SEP = ';'; // séparateur usuel Excel/Crésus en Suisse romande

function csvCell(value: string): string {
  if (/[";\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function isoDay(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

/** Construit le CSV récapitulatif (1 ligne par pièce). BOM UTF-8 pour Excel. */
export function buildRecapCsv(meta: RecapMeta, rows: RecapRow[]): string {
  const header = [
    'ID-Client',
    'Nom-Client',
    'AnneeFiscale',
    'CodePiece',
    'Piece',
    'Categorie',
    'Obligatoire',
    'Statut',
    'FichierFinal',
    'DateDepot',
    'DateValidation',
  ];
  const lines = [header.join(SEP)];
  for (const r of rows) {
    lines.push(
      [
        meta.clientCode,
        meta.clientName,
        String(meta.fiscalYear),
        r.pieceCode,
        r.nom,
        r.category,
        r.required ? 'oui' : 'non',
        r.status,
        r.finalFilename ?? '',
        isoDay(r.depositDate),
        isoDay(r.validationDate),
      ]
        .map((c) => csvCell(String(c)))
        .join(SEP),
    );
  }
  return '﻿' + lines.join('\r\n');
}

/** Nom de fichier de l'export (sans accents/espaces). */
export function exportBaseName(meta: RecapMeta): string {
  const name = meta.clientName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${meta.fiscalYear}_${meta.clientCode}_${name}`;
}

export interface ZipFile {
  filename: string;
  content: Buffer | Uint8Array;
}

/**
 * Construit le ZIP du dossier : CSV récapitulatif + pièces validées fournies.
 * `files` = contenus des pièces validées (déjà nommées §5.3). Retourne un Buffer.
 */
export async function buildDossierZip(meta: RecapMeta, csv: string, files: ZipFile[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('recapitulatif.csv', csv);
  const folder = zip.folder('pieces');
  for (const f of files) {
    folder!.file(f.filename, f.content);
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
