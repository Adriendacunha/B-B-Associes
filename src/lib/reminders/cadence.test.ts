import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CADENCE,
  planCadence,
  dueReminders,
  nextReminder,
  shiftToBusinessDay,
} from './cadence';

const opened = new Date(Date.UTC(2026, 0, 1)); // jeudi 2026-01-01

describe('planCadence (§6.1)', () => {
  it('génère J0/J+7/J+14/J+21/J+28', () => {
    const plan = planCadence(opened);
    expect(plan).toHaveLength(5);
    expect(plan[0].scheduledFor.toISOString()).toBe(new Date(Date.UTC(2026, 0, 1)).toISOString());
    expect(plan[1].scheduledFor.toISOString()).toBe(new Date(Date.UTC(2026, 0, 8)).toISOString());
    expect(plan[4].action).toBe('ESCALADE_INTERNE');
  });

  it('ignore les règles inactives', () => {
    const rules = DEFAULT_CADENCE.map((r) => (r.stepOrder === 2 ? { ...r, active: false } : r));
    expect(planCadence(opened, rules)).toHaveLength(4);
  });

  it('reporte au jour ouvré si demandé', () => {
    const plan = planCadence(opened, DEFAULT_CADENCE, { businessDaysOnly: true });
    // J+24 (2026-01-25) est un dimanche -> on ne teste pas ici, mais on vérifie le shift dédié
    expect(shiftToBusinessDay(new Date(Date.UTC(2026, 0, 3))).getUTCDate()).toBe(5); // samedi -> lundi
    expect(shiftToBusinessDay(new Date(Date.UTC(2026, 0, 4))).getUTCDate()).toBe(5); // dimanche -> lundi
    expect(plan).toHaveLength(5);
  });
});

describe('dueReminders / nextReminder (§6.1)', () => {
  const plan = planCadence(opened);
  const state = { remindersPaused: false, isComplete: false };

  it('envoie les étapes dues non encore envoyées', () => {
    const now = new Date(Date.UTC(2026, 0, 9)); // après J+7
    const due = dueReminders(plan, [0], now, state);
    expect(due.map((d) => d.stepOrder)).toEqual([1]);
  });

  it('arrêt automatique quand le dossier est complet', () => {
    const now = new Date(Date.UTC(2026, 1, 1));
    expect(dueReminders(plan, [], now, { ...state, isComplete: true })).toHaveLength(0);
    expect(nextReminder(plan, [], now, { ...state, isComplete: true })).toBeNull();
  });

  it('suspension manuelle bloque les relances', () => {
    const now = new Date(Date.UTC(2026, 0, 9));
    expect(dueReminders(plan, [0], now, { ...state, remindersPaused: true })).toHaveLength(0);
  });

  it('prochaine relance prévue', () => {
    const now = new Date(Date.UTC(2026, 0, 2));
    expect(nextReminder(plan, [0], now, state)?.stepOrder).toBe(1);
  });
});
