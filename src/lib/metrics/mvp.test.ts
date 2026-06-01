import { describe, it, expect } from 'vitest';
import {
  autonomyCompletionRate,
  reliabilityByPiece,
  dropOffFunnel,
  timeSaved,
  completude,
} from './mvp';

describe('métrique 1 — complétion en autonomie (§15.3.1)', () => {
  it('ne compte que les dossiers complets sans intervention', () => {
    const rate = autonomyCompletionRate([
      { isComplete: true, humanCorrections: 0, manualReminders: 0, escalations: 0 },
      { isComplete: true, humanCorrections: 1, manualReminders: 0, escalations: 0 },
      { isComplete: false, humanCorrections: 0, manualReminders: 0, escalations: 0 },
      { isComplete: true, humanCorrections: 0, manualReminders: 0, escalations: 0 },
    ]);
    expect(rate).toBe(0.5);
  });
});

describe('métrique 2 — fiabilité par CodePiece (§15.3.2/§15.4)', () => {
  it('calcule le taux et le seuil avec volume minimal', () => {
    const samples = [
      ...Array(19).fill({ pieceCode: '3A', agreedWithAi: true }),
      { pieceCode: '3A', agreedWithAi: true }, // 20/20 = 100%
      ...Array(10).fill({ pieceCode: 'CERT-SALAIRE', agreedWithAi: true }),
    ];
    const res = reliabilityByPiece(samples, 0.9, 20);
    const a3 = res.find((r) => r.pieceCode === '3A')!;
    const cert = res.find((r) => r.pieceCode === 'CERT-SALAIRE')!;
    expect(a3.reliability).toBe(1);
    expect(a3.meetsThreshold).toBe(true);
    // volume insuffisant -> ne passe pas le seuil même à 100%
    expect(cert.reliability).toBe(1);
    expect(cert.meetsThreshold).toBe(false);
  });
});

describe('métrique 3 — points de décrochage (§15.3.3)', () => {
  it('calcule les abandons par étape', () => {
    const funnel = dropOffFunnel({
      COMPTE_CREE: 15,
      PREMIER_UPLOAD: 12,
      DOSSIER_PARTIEL: 10,
      DOSSIER_COMPLET: 8,
    });
    expect(funnel[1].dropOffFromPrevious).toBe(3);
    expect(funnel[3].dropOffFromPrevious).toBe(2);
  });
});

describe('métrique 4 — temps économisé (§15.3.4)', () => {
  it('estime les relances évitées et le temps', () => {
    const res = timeSaved({
      baselineManualRemindersPerCampaign: 4,
      campaigns: 10,
      actualManualReminders: 5,
      minutesPerReminder: 5,
    });
    expect(res.remindersAvoided).toBe(35);
    expect(res.minutesSaved).toBe(175);
  });
});

describe('complétude (§11)', () => {
  it('renvoie ratio et libellé X/Y', () => {
    expect(completude({ requiredTotal: 12, conformes: 7 })).toEqual({ ratio: 7 / 12, label: '7/12' });
  });
});
