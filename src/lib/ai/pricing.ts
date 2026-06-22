// Estimation de coût des appels au modèle. Les tarifs sont PARAMÉTRABLES par le
// cabinet (ils évoluent et dépendent du contrat) : ajuster ce tableau ou la
// variable d'environnement AI_PRICE_<MODELE>_IN / _OUT (USD par million de tokens).
//
// Valeurs par défaut indicatives (USD / 1M tokens). À confirmer selon le contrat.

export interface ModelPrice {
  inputPerMTok: number; // USD par million de tokens d'entrée
  outputPerMTok: number; // USD par million de tokens de sortie
}

// Tarifs par défaut, par préfixe de modèle (match le plus spécifique d'abord).
const DEFAULT_PRICES: Record<string, ModelPrice> = {
  'claude-opus': { inputPerMTok: 15, outputPerMTok: 75 },
  'claude-sonnet': { inputPerMTok: 3, outputPerMTok: 15 },
  'claude-haiku': { inputPerMTok: 0.8, outputPerMTok: 4 },
};

const FALLBACK: ModelPrice = { inputPerMTok: 15, outputPerMTok: 75 };

/** Tarif d'un modèle : surcharge via env (AI_PRICE_IN / AI_PRICE_OUT) sinon table. */
export function priceFor(model: string): ModelPrice {
  const envIn = Number(process.env.AI_PRICE_IN);
  const envOut = Number(process.env.AI_PRICE_OUT);
  if (Number.isFinite(envIn) && Number.isFinite(envOut) && envIn > 0 && envOut > 0) {
    return { inputPerMTok: envIn, outputPerMTok: envOut };
  }
  const key = Object.keys(DEFAULT_PRICES)
    .filter((p) => model.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  return key ? DEFAULT_PRICES[key] : FALLBACK;
}

/** Coût estimé (USD) d'un appel, cache lu facturé au tarif d'entrée par simplicité. */
export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
): number {
  const p = priceFor(model);
  const inTok = inputTokens + cacheReadTokens;
  return (inTok / 1_000_000) * p.inputPerMTok + (outputTokens / 1_000_000) * p.outputPerMTok;
}
