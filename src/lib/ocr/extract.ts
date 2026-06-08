// Extraction de texte d'un document avant analyse IA (§7.2).
//
// Trois voies, par ordre de fiabilité :
//  1. Fichiers texte         → décodage UTF-8.
//  2. PDF « numériques »      → texte embarqué (pdf-parse), sans réseau.
//  3. Images / PDF scannés    → OCR Tesseract (tesseract.js), données locales.
//
// L'OCR est best-effort : toute défaillance (données de langue absentes, etc.)
// retombe proprement sur une extraction vide — le dépôt n'échoue jamais.
// En production (§9), héberger Tesseract en Suisse (binaire système ou ces
// fichiers `tessdata/`). Les langues et le chemin sont configurables par env.

import path from 'node:path';

const MAX_CHARS = 20_000;
const TESSDATA = process.env.OCR_TESSDATA_PATH ?? path.resolve(process.cwd(), 'tessdata');
const OCR_LANGS = process.env.OCR_LANGS ?? 'fra+eng';

export type ExtractionMethod = 'text' | 'pdf' | 'ocr' | 'none';
export interface ExtractionResult {
  text: string;
  method: ExtractionMethod;
}

function extOf(filename: string): string {
  return (filename.split('.').pop() ?? '').toLowerCase();
}

/** Décide la voie d'extraction selon le type MIME / l'extension (testable). */
export function extractionKind(mimeType: string, filename: string): 'text' | 'pdf' | 'image' | 'unknown' {
  const mime = (mimeType ?? '').toLowerCase();
  const ext = extOf(filename);
  if (mime.startsWith('text/') || ['txt', 'csv', 'md'].includes(ext)) return 'text';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'bmp', 'webp'].includes(ext)) return 'image';
  return 'unknown';
}

/** Extrait le texte d'un document. Ne lève jamais : retombe sur method 'none'. */
export async function extractText(buffer: Buffer, mimeType: string, filename: string): Promise<ExtractionResult> {
  const kind = extractionKind(mimeType, filename);

  if (kind === 'text') {
    return { text: buffer.toString('utf8').slice(0, MAX_CHARS), method: 'text' };
  }

  if (kind === 'pdf') {
    const pdfText = await extractPdfText(buffer);
    if (pdfText.trim().length >= 20) return { text: pdfText.slice(0, MAX_CHARS), method: 'pdf' };
    // PDF probablement scanné (peu de texte embarqué) → OCR.
    const ocr = await runOcr(buffer);
    if (ocr) return { text: ocr.slice(0, MAX_CHARS), method: 'ocr' };
    return { text: pdfText.slice(0, MAX_CHARS), method: 'pdf' };
  }

  if (kind === 'image') {
    const ocr = await runOcr(buffer);
    if (ocr) return { text: ocr.slice(0, MAX_CHARS), method: 'ocr' };
  }

  return { text: '', method: 'none' };
}

/** Texte embarqué d'un PDF numérique (sans réseau). */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const mod = (await import('pdf-parse')) as unknown as {
      PDFParse?: new (o: { data: Buffer }) => { getText: () => Promise<{ text?: string }>; destroy?: () => Promise<void> };
      default?: { PDFParse?: new (o: { data: Buffer }) => { getText: () => Promise<{ text?: string }>; destroy?: () => Promise<void> } };
    };
    const PDFParse = mod.PDFParse ?? mod.default?.PDFParse;
    if (!PDFParse) return '';
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy?.();
    // Retire les séparateurs de page « -- 1 of N -- » ajoutés par pdf-parse.
    return (result.text ?? '').replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '').trim();
  } catch {
    return '';
  }
}

/** OCR best-effort via Tesseract. Renvoie null si indisponible. */
async function runOcr(buffer: Buffer): Promise<string | null> {
  if (process.env.OCR_DISABLED === '1') return null;
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker(OCR_LANGS, 1, { langPath: TESSDATA, gzip: false, cachePath: '/tmp/tess-cache' });
    try {
      const { data } = await worker.recognize(buffer);
      const text = (data.text ?? '').trim();
      return text.length ? text : null;
    } finally {
      await worker.terminate();
    }
  } catch {
    return null;
  }
}
