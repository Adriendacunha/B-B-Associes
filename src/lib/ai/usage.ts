// Enregistrement de la consommation de tokens des appels au modèle (analytics).
// N'échoue JAMAIS : une erreur de journalisation ne doit pas casser l'analyse.

import { prisma } from '@/lib/db';

export type AiOperation = 'VERIFY' | 'CLASSIFY';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

/** Attribution facultative d'un appel (pour les analyses par dossier). */
export interface UsageContext {
  documentId?: string;
  campaignId?: string;
  clientId?: string;
}

/** Normalise l'objet `usage` du SDK Anthropic en TokenUsage. */
export function toTokenUsage(u: {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}): TokenUsage {
  return {
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
  };
}

export async function recordAiUsage(
  operation: AiOperation,
  model: string,
  usage: TokenUsage,
  context: UsageContext = {},
): Promise<void> {
  try {
    await prisma.aiUsage.create({
      data: {
        operation,
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens ?? 0,
        cacheCreationTokens: usage.cacheCreationTokens ?? 0,
        documentId: context.documentId,
        campaignId: context.campaignId,
        clientId: context.clientId,
      },
    });
  } catch (err) {
    console.error('[recordAiUsage] échec de journalisation (ignoré) :', err);
  }
}
