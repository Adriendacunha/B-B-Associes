// Classification d'un document parmi les pièces attendues (tri automatique du
// dépôt en vrac, §7). Via l'API Claude si configurée, sinon heuristique par
// mots-clés (déterministe). Renvoie le CodePiece le mieux correspondant, ou null.

import Anthropic from '@anthropic-ai/sdk';
import { recordAiUsage, toTokenUsage, type UsageContext } from './usage';

export interface ClassifyCandidate {
  pieceCode: string;
  nom: string;
  description: string;
}

export interface ClassifyInput {
  filename: string;
  text: string;
  candidates: ClassifyCandidate[];
  /** Attribution pour le suivi de consommation (facultatif). */
  context?: UsageContext;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function keywords(code: string, nom: string): string[] {
  const fromCode = code.toLowerCase().split(/[-_]/).filter((t) => t.length >= 4);
  const fromNom = normalize(nom)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !['pour', 'avec', 'dans', 'leur', 'cette'].includes(t));
  return Array.from(new Set([...fromCode, ...fromNom]));
}

/** Heuristique : score par recouvrement de mots-clés (nom de fichier + texte). */
export function stubClassify(input: ClassifyInput): string | null {
  const hay = normalize(`${input.filename} ${input.text}`);
  let best: { code: string; score: number } | null = null;
  for (const c of input.candidates) {
    const kws = keywords(c.pieceCode, c.nom);
    const score = kws.filter((k) => hay.includes(k)).length;
    if (score > 0 && (!best || score > best.score)) best = { code: c.pieceCode, score };
  }
  return best?.code ?? null;
}

const MODEL = process.env.ANTHROPIC_VERIFICATION_MODEL ?? 'claude-opus-4-8';

/** Classifie un document ; repli sur l'heuristique si Claude indisponible/échoue. */
export async function classifyDocument(input: ClassifyInput): Promise<string | null> {
  const codes = new Set(input.candidates.map((c) => c.pieceCode));
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const list = input.candidates
        .map((c) => `- ${c.pieceCode} : ${c.nom} — ${c.description}`)
        .join('\n');
      const prompt = [
        'Voici la liste des pièces fiscales attendues (code : libellé — description) :',
        list,
        '',
        'Voici le contenu (extrait) du document à classer :',
        '"""',
        (input.text || input.filename).slice(0, 8000),
        '"""',
        '',
        'À quelle pièce ce document correspond-il ? Réponds UNIQUEMENT par le CODE exact',
        'de la pièce (ex. CERT-SALAIRE), ou par AUCUN si aucune ne correspond.',
      ].join('\n');
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 24,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      });
      await recordAiUsage('CLASSIFY', MODEL, toTokenUsage(res.usage), input.context);
      const answer = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim()
        .replace(/[^A-Za-z0-9-]/g, '')
        .toUpperCase();
      return codes.has(answer) ? answer : null;
    } catch (e) {
      console.error('Classification Claude échouée, repli heuristique:', (e as Error).message);
    }
  }
  return stubClassify(input);
}
