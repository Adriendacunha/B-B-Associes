// Fusionne plusieurs fichiers (PDF, JPG, PNG) en un seul PDF — pour déposer une
// pièce composée de plusieurs fichiers/photos en un document unique (§5).

import { PDFDocument } from 'pdf-lib';

export interface MergeInput {
  type: string;
  name: string;
  bytes: Buffer;
}

export async function mergeToPdf(files: MergeInput[]): Promise<Buffer> {
  const out = await PDFDocument.create();
  for (const f of files) {
    const name = (f.name || '').toLowerCase();
    const type = (f.type || '').toLowerCase();
    try {
      if (type.includes('pdf') || name.endsWith('.pdf')) {
        const src = await PDFDocument.load(f.bytes, { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      } else if (type.includes('png') || name.endsWith('.png')) {
        const img = await out.embedPng(f.bytes);
        const page = out.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      } else if (type.includes('jpg') || type.includes('jpeg') || /\.jpe?g$/.test(name)) {
        const img = await out.embedJpg(f.bytes);
        const page = out.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      // autres formats : ignorés dans la fusion
    } catch {
      // fichier illisible / corrompu : on l'ignore
    }
  }
  if (out.getPageCount() === 0) throw new Error('Aucun fichier exploitable à fusionner.');
  return Buffer.from(await out.save());
}
