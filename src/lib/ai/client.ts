// Client de vérification documentaire par IA (API Claude) — §7.2.
//
// Croise le contrat défini dans verification.ts (prompt + schéma JSON) avec l'appel
// réel au modèle. La sortie est validée par Zod avant usage.
//
// ⚠️ CONFORMITÉ (§9) : les documents fiscaux sont sensibles. L'utilisation de l'API
// Claude doit être couverte par la NON-RÉTENTION DES DONNÉES (Zero Data Retention)
// et un DPA, à valider avec le cabinet (§14.4). On envoie ici le TEXTE extrait/OCR,
// jamais davantage que nécessaire.

import Anthropic from '@anthropic-ai/sdk';
import {
  AiVerdictSchema,
  buildVerificationPrompt,
  type AiVerdict,
  type ExpectedPiece,
} from './verification';
import type { AppLocale } from '@/lib/i18n/locales';

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY manquante (voir .env.example / §14.4).");
  }
  return new Anthropic({ apiKey });
}

const MODEL = process.env.ANTHROPIC_VERIFICATION_MODEL ?? 'claude-opus-4-8';

export interface VerificationResult {
  verdict: AiVerdict;
  model: string;
  raw: string;
}

/**
 * Analyse le texte extrait d'un document et renvoie un verdict structuré et validé.
 * `documentText` = sortie OCR/extraction (le pipeline d'extraction est en amont, §7.2).
 */
export async function verifyDocument(
  piece: ExpectedPiece,
  documentText: string,
  clientLocale: AppLocale,
): Promise<VerificationResult> {
  const client = getClient();
  const prompt = buildVerificationPrompt(piece, documentText, clientLocale);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    // Réponse déterministe et concise : on veut du JSON strict.
    temperature: 0,
    system:
      "Tu es un assistant de contrôle documentaire d'une fiduciaire suisse. " +
      'Tu réponds EXCLUSIVEMENT par un objet JSON valide, sans aucun texte autour.',
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const verdict = AiVerdictSchema.parse(JSON.parse(cleaned));

  return { verdict, model: MODEL, raw };
}
