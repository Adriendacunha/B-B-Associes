// Données de DÉMONSTRATION pour visualiser l'espace client et le tableau de bord
// sans base connectée. Elles s'appuient sur les VRAIS modules métier (profilage,
// référentiel, métriques) pour rester représentatives. À remplacer par des requêtes
// Prisma une fois la base provisionnée.

import { PIECE_REFERENTIAL } from '@/data/piece-referential';
import { selectRequiredPieces, type ClientProfile } from '@/lib/checklist/profiling';
import { completude, autonomyCompletionRate, timeSaved } from '@/lib/metrics/mvp';
import { planCadence, nextReminder } from '@/lib/reminders/cadence';
import type { LocalizedText } from '@/lib/i18n/locales';

export type DemoStatus = 'MANQUANT' | 'DEPOSE' | 'EN_VALIDATION' | 'CONFORME' | 'NON_CONFORME';

export interface DemoChecklistItem {
  code: string;
  category: string;
  required: boolean;
  status: DemoStatus;
  nom: LocalizedText;
  description: LocalizedText;
  texteAide: LocalizedText;
}

// Profil bêta-testeur type (§15.2) : particulier salarié résident, locataire, 3a.
const demoProfile: ClientProfile = {
  type: 'PARTICULIER',
  residence: 'RESIDENT_CH',
  revenuSalarie: true,
  logement: 'LOCATAIRE',
  pilier3a: true,
  nbEnfants: 1,
  fraisGarde: true,
  titres: true,
};

// Statuts simulés pour rendre la démo parlante.
const DEMO_STATUSES: Record<string, DemoStatus> = {
  'CERT-SALAIRE': 'CONFORME',
  '3A': 'CONFORME',
  'LAMAL': 'EN_VALIDATION',
  'RELEVE-BANCAIRE': 'DEPOSE',
  'ETAT-TITRES': 'NON_CONFORME',
  'FRAIS-GARDE': 'MANQUANT',
};

export function demoChecklist(): DemoChecklistItem[] {
  const required = selectRequiredPieces(PIECE_REFERENTIAL, demoProfile);
  return required.map((p) => ({
    code: p.code,
    category: p.category,
    required: p.requiredByDefault,
    status: DEMO_STATUSES[p.code] ?? 'MANQUANT',
    nom: p.nom,
    description: p.description,
    texteAide: p.texteAide,
  }));
}

export function demoCompletude() {
  const items = demoChecklist().filter((i) => i.required);
  const conformes = items.filter((i) => i.status === 'CONFORME').length;
  return completude({ requiredTotal: items.length, conformes });
}

export interface DemoClientRow {
  clientCode: string;
  displayName: string;
  manager: string;
  completude: { ratio: number; label: string };
  nextReminderDays: number | null;
}

export function demoDashboard() {
  const opened = new Date();
  const plan = planCadence(opened);
  const next = nextReminder(plan, [0], opened, { remindersPaused: false, isComplete: false });

  const clients: DemoClientRow[] = [
    { clientCode: 'C0001', displayName: 'Dupont Jean', manager: 'Collaborateur Référent', completude: { ratio: 7 / 9, label: '7/9' }, nextReminderDays: 7 },
    { clientCode: 'C0002', displayName: 'Müller Anna', manager: 'Collaborateur Référent', completude: { ratio: 9 / 9, label: '9/9' }, nextReminderDays: null },
    { clientCode: 'C0003', displayName: 'Rossi Marco', manager: 'Associé Admin', completude: { ratio: 3 / 9, label: '3/9' }, nextReminderDays: 14 },
  ];

  const autonomy = autonomyCompletionRate([
    { isComplete: true, humanCorrections: 0, manualReminders: 0, escalations: 0 },
    { isComplete: true, humanCorrections: 2, manualReminders: 1, escalations: 0 },
    { isComplete: false, humanCorrections: 0, manualReminders: 0, escalations: 0 },
  ]);

  const saved = timeSaved({
    baselineManualRemindersPerCampaign: 4,
    campaigns: 12,
    actualManualReminders: 9,
    minutesPerReminder: 5,
  });

  return {
    clients,
    autonomyRate: autonomy,
    reliabilityRate: 0.86, // illustratif (sous le seuil 90% -> reste HUMAIN_REQUIS)
    completeCount: clients.filter((c) => c.completude.ratio >= 1).length,
    minutesSaved: saved.minutesSaved,
    nextReminderStep: next?.stepOrder ?? null,
  };
}
