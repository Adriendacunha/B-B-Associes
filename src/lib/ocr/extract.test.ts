import { describe, it, expect } from 'vitest';
import { extractionKind, extractText, extractPdfText } from './extract';

// PDF numérique minimal contenant du texte (pas de réseau, pas d'OCR).
function makeTextPdf(text: string): Buffer {
  const content = `BT /F1 18 Tf 72 700 Td (${text}) Tj ET`;
  const objs = [
    `<</Type/Catalog/Pages 2 0 R>>`,
    `<</Type/Pages/Kids[3 0 R]/Count 1>>`,
    `<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>`,
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    `<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>`,
  ];
  let pdf = `%PDF-1.4\n`;
  objs.forEach((o, i) => (pdf += `${i + 1} 0 obj\n${o}\nendobj\n`));
  pdf += `trailer<</Root 1 0 R/Size ${objs.length + 1}>>\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

describe('extractionKind (§7.2)', () => {
  it('reconnaît texte / pdf / image / inconnu', () => {
    expect(extractionKind('text/plain', 'a.txt')).toBe('text');
    expect(extractionKind('application/pdf', 'a.pdf')).toBe('pdf');
    expect(extractionKind('', 'scan.PDF')).toBe('pdf');
    expect(extractionKind('image/jpeg', 'p.jpg')).toBe('image');
    expect(extractionKind('', 'photo.png')).toBe('image');
    expect(extractionKind('application/octet-stream', 'x.bin')).toBe('unknown');
  });
});

describe('extractText — voie texte', () => {
  it('décode l’UTF-8 d’un fichier texte', async () => {
    const r = await extractText(Buffer.from('Certificat 2025', 'utf8'), 'text/plain', 'c.txt');
    expect(r.method).toBe('text');
    expect(r.text).toContain('Certificat 2025');
  });
  it('renvoie none pour un type non géré', async () => {
    const r = await extractText(Buffer.from([0, 1, 2]), 'application/zip', 'a.zip');
    expect(r).toEqual({ text: '', method: 'none' });
  });
});

describe('extractText — voie PDF numérique', () => {
  it('extrait le texte embarqué d’un PDF', async () => {
    const buf = makeTextPdf('Certificat de salaire 2025 Dupont Jean');
    const r = await extractText(buf, 'application/pdf', '2025_cert.pdf');
    expect(r.method).toBe('pdf');
    expect(r.text).toContain('Certificat de salaire 2025');
  });

  it('extractPdfText ne lève pas sur un PDF invalide', async () => {
    expect(await extractPdfText(Buffer.from('pas un pdf'))).toBe('');
  });
});
