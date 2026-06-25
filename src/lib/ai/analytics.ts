// Agrégations pures pour la page de suivi de consommation IA (testable, sans DB).

import { estimateCostUsd } from './pricing';

export interface ModelAgg {
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

export interface ModelAggWithCost extends ModelAgg {
  costUsd: number;
}

export interface UsageSummary {
  rows: ModelAggWithCost[];
  totalCalls: number;
  totalInput: number;
  totalOutput: number;
  totalCostUsd: number;
}

/** Ajoute le coût estimé par modèle et calcule les totaux. */
export function summarize(rows: ModelAgg[]): UsageSummary {
  const withCost = rows
    .map((r) => ({ ...r, costUsd: estimateCostUsd(r.model, r.inputTokens, r.outputTokens, r.cacheReadTokens) }))
    .sort((a, b) => b.costUsd - a.costUsd);
  return {
    rows: withCost,
    totalCalls: rows.reduce((s, r) => s + r.calls, 0),
    totalInput: rows.reduce((s, r) => s + r.inputTokens, 0),
    totalOutput: rows.reduce((s, r) => s + r.outputTokens, 0),
    totalCostUsd: withCost.reduce((s, r) => s + r.costUsd, 0),
  };
}

/** Format compact d'un nombre de tokens (1234 → « 1.2k »). */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Format monétaire USD, plus de décimales sous 1 $ (coûts faibles). */
export function formatUsd(n: number): string {
  if (n === 0) return '$0';
  return n < 1 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}
