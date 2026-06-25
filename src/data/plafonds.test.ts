import { describe, it, expect } from 'vitest';
import {
  PLAFONDS_PAR_ANNEE,
  anneesDisponibles,
  plafondsFor,
  forfaitFraisPro,
  plafond3a,
  formatChf,
} from './plafonds';

const P2025 = PLAFONDS_PAR_ANNEE[2025];

describe('plafondsFor (résolution par année)', () => {
  it('renvoie le barème exact si l’année est définie', () => {
    expect(plafondsFor(2025)).toEqual({ plafonds: P2025, exact: true });
  });
  it('retombe sur l’année connue ≤ demandée si non définie', () => {
    const r = plafondsFor(2099);
    expect(r.exact).toBe(false);
    expect(r.plafonds.year).toBe(2025);
  });
  it('retombe sur l’année la plus ancienne si demande antérieure', () => {
    const r = plafondsFor(2000);
    expect(r.exact).toBe(false);
    expect(r.plafonds.year).toBe(anneesDisponibles()[0]);
  });
});

describe('forfaitFraisPro (3 % du revenu net, borné)', () => {
  it('borne au plancher ICC pour un faible revenu', () => {
    expect(forfaitFraisPro(1000, 'ICC', P2025)).toBe(640); // 3% = 30 < min 640
  });
  it('borne au plafond ICC pour un revenu élevé', () => {
    expect(forfaitFraisPro(1_000_000, 'ICC', P2025)).toBe(1812);
  });
  it('applique 3 % dans la plage IFD', () => {
    expect(forfaitFraisPro(100_000, 'IFD', P2025)).toBe(3000); // 3% = 3000 ∈ [2000, 4000]
  });
});

describe('plafond3a (selon affiliation 2e pilier)', () => {
  it('montant fixe si affilié au 2e pilier', () => {
    expect(plafond3a(true, 500_000, P2025)).toBe(7258);
  });
  it('20 % du revenu net borné si non affilié', () => {
    expect(plafond3a(false, 100_000, P2025)).toBe(20_000); // 20%
    expect(plafond3a(false, 1_000_000, P2025)).toBe(36_288); // borné au max
  });
});

describe('intégrité des barèmes', () => {
  it('toutes les valeurs numériques des barèmes sont strictement positives', () => {
    for (const p of Object.values(PLAFONDS_PAR_ANNEE)) {
      const flat: number[] = [];
      const walk = (o: unknown) => {
        if (typeof o === 'number') flat.push(o);
        else if (o && typeof o === 'object') Object.values(o).forEach(walk);
      };
      walk(p);
      expect(flat.every((n) => n > 0), `année ${p.year}`).toBe(true);
    }
  });
  it('la clé du Record correspond au champ year', () => {
    for (const [k, p] of Object.entries(PLAFONDS_PAR_ANNEE)) {
      expect(Number(k)).toBe(p.year);
    }
  });
});

describe('formatChf', () => {
  it('formate avec apostrophe suisse', () => {
    expect(formatChf(7258)).toBe("7'258");
    expect(formatChf(36288)).toBe("36'288");
  });
});
