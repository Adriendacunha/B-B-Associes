// Moteur de relance CONFIGURABLE (§6.1 du brief).
//
// La cadence n'est PAS figée : c'est une liste de règles éditables (ReminderRule).
// Les valeurs par défaut (J0/J+7/J+14/J+21/J+28) sont posées par le seed mais
// modifiables par l'administrateur. Ce module calcule les dates planifiées et
// les règles d'arrêt, sans dépendre de Prisma (testable en isolation).

export type ReminderActionKind = 'EMAIL_CLIENT' | 'ESCALADE_INTERNE';

export interface CadenceRule {
  stepOrder: number;
  label: string;
  offsetDays: number; // jours depuis l'ouverture de campagne
  action: ReminderActionKind;
  templateKey: string;
  active: boolean;
}

/** Cadence par défaut proposée (§6.1) — éditable en exploitation. */
export const DEFAULT_CADENCE: CadenceRule[] = [
  { stepOrder: 0, label: 'Invitation', offsetDays: 0, action: 'EMAIL_CLIENT', templateKey: 'INVITATION', active: true },
  { stepOrder: 1, label: '1re relance', offsetDays: 7, action: 'EMAIL_CLIENT', templateKey: 'RELANCE_1', active: true },
  { stepOrder: 2, label: '2e relance', offsetDays: 14, action: 'EMAIL_CLIENT', templateKey: 'RELANCE_2', active: true },
  { stepOrder: 3, label: '3e relance', offsetDays: 21, action: 'EMAIL_CLIENT', templateKey: 'RELANCE_3', active: true },
  { stepOrder: 4, label: 'Escalade', offsetDays: 28, action: 'ESCALADE_INTERNE', templateKey: 'ESCALADE_INTERNE', active: true },
];

export interface PlannedReminder {
  stepOrder: number;
  action: ReminderActionKind;
  templateKey: string;
  scheduledFor: Date;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Plage horaire d'envoi (jours ouvrés) — §6.1. */
export interface SendWindow {
  /** Heure d'envoi (UTC) à laquelle caler les relances, ex. 8 (08:00). */
  hourUtc?: number;
  /** N'envoyer que les jours ouvrés (lun–ven). */
  businessDaysOnly?: boolean;
}

/** Reporte une date au prochain jour ouvré si nécessaire (samedi/dimanche). */
export function shiftToBusinessDay(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = dimanche, 6 = samedi
  if (day === 6) return addDays(d, 2);
  if (day === 0) return addDays(d, 1);
  return d;
}

/**
 * Génère le calendrier complet des relances pour une campagne.
 * Les règles inactives sont ignorées. Applique la fenêtre d'envoi.
 */
export function planCadence(
  openedAt: Date,
  rules: CadenceRule[] = DEFAULT_CADENCE,
  window: SendWindow = {},
): PlannedReminder[] {
  return rules
    .filter((r) => r.active)
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((r) => {
      let scheduled = addDays(openedAt, r.offsetDays);
      if (window.hourUtc !== undefined) {
        scheduled.setUTCHours(window.hourUtc, 0, 0, 0);
      }
      if (window.businessDaysOnly) {
        scheduled = shiftToBusinessDay(scheduled);
      }
      return {
        stepOrder: r.stepOrder,
        action: r.action,
        templateKey: r.templateKey,
        scheduledFor: scheduled,
      };
    });
}

export interface CampaignReminderState {
  remindersPaused: boolean;
  isComplete: boolean; // dossier complet -> arrêt automatique (§6.1)
}

/**
 * Détermine les relances à RÉELLEMENT envoyer à l'instant `now`.
 * Règles (§6.1) :
 *  - arrêt automatique quand le dossier est complet ;
 *  - suspension manuelle possible ;
 *  - on n'envoie que les étapes dont la date est atteinte et non encore envoyées.
 */
export function dueReminders(
  planned: PlannedReminder[],
  alreadySentSteps: number[],
  now: Date,
  state: CampaignReminderState,
): PlannedReminder[] {
  if (state.isComplete || state.remindersPaused) return [];
  const sent = new Set(alreadySentSteps);
  return planned.filter(
    (p) => !sent.has(p.stepOrder) && p.scheduledFor.getTime() <= now.getTime(),
  );
}

/** Prochaine relance prévue (pour le tableau de bord §11), ou null si aucune. */
export function nextReminder(
  planned: PlannedReminder[],
  alreadySentSteps: number[],
  now: Date,
  state: CampaignReminderState,
): PlannedReminder | null {
  if (state.isComplete || state.remindersPaused) return null;
  const sent = new Set(alreadySentSteps);
  const upcoming = planned
    .filter((p) => !sent.has(p.stepOrder) && p.scheduledFor.getTime() > now.getTime())
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
  return upcoming[0] ?? null;
}
