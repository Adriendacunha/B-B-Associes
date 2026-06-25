import { describe, it, expect } from 'vitest';
import { summarize, formatTokens, formatUsd } from './analytics';
import { estimateCostUsd, priceFor } from './pricing';

describe('pricing', () => {
  it('applique le tarif Opus par défaut (15 / 75 USD par Mtok)', () => {
    expect(priceFor('claude-opus-4-8')).toEqual({ inputPerMTok: 15, outputPerMTok: 75 });
    // 1M in + 1M out = 15 + 75 = 90 USD
    expect(estimateCostUsd('claude-opus-4-8', 1_000_000, 1_000_000)).toBeCloseTo(90, 6);
  });

  it('compte le cache lu au tarif d’entrée', () => {
    // 0 in, 0 out, 1M cache read → 15 USD
    expect(estimateCostUsd('claude-opus-4-8', 0, 0, 1_000_000)).toBeCloseTo(15, 6);
  });

  it('retombe sur un tarif par défaut pour un modèle inconnu', () => {
    expect(priceFor('mystere-x')).toEqual({ inputPerMTok: 15, outputPerMTok: 75 });
  });
});

describe('summarize', () => {
  it('calcule coûts par modèle et totaux, triés par coût décroissant', () => {
    const s = summarize([
      { model: 'claude-haiku-4-5', calls: 10, inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0 },
      { model: 'claude-opus-4-8', calls: 2, inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 0 },
    ]);
    expect(s.totalCalls).toBe(12);
    expect(s.totalInput).toBe(2_000_000);
    expect(s.rows[0].model).toBe('claude-opus-4-8'); // plus cher en tête
    expect(s.totalCostUsd).toBeCloseTo(90 + 0.8, 4);
  });
});

describe('formatters', () => {
  it('formatTokens', () => {
    expect(formatTokens(500)).toBe('500');
    expect(formatTokens(1500)).toBe('1.5k');
    expect(formatTokens(2_500_000)).toBe('2.5M');
  });
  it('formatUsd', () => {
    expect(formatUsd(0)).toBe('$0');
    expect(formatUsd(0.0123)).toBe('$0.0123');
    expect(formatUsd(12.5)).toBe('$12.50');
  });
});
