// Les 4 métriques MVP à instrumenter dès la Phase 1 (§15.3 du brief).
// Le tableau de bord (§11) doit les exposer. Calculs purs, testables.

// ─── Métrique 1 : taux de complétion en autonomie (§15.3.1) ──────────────────
// Part des campagnes complétées SANS intervention humaine (aucune correction,
// aucune relance manuelle, aucune escalade). Mesure le marché de l'offre `auto`.

export interface CampaignAutonomyInput {
  isComplete: boolean;
  humanCorrections: number; // verdicts IA corrigés par un collaborateur
  manualReminders: number; // relances manuelles déclenchées
  escalations: number; // escalades internes
}

export function autonomyCompletionRate(campaigns: CampaignAutonomyInput[]): number {
  if (campaigns.length === 0) return 0;
  const autonomous = campaigns.filter(
    (c) => c.isComplete && c.humanCorrections === 0 && c.manualReminders === 0 && c.escalations === 0,
  ).length;
  return autonomous / campaigns.length;
}

// ─── Métrique 2 : fiabilité de l'IA par CodePiece (§15.3.2 / §15.4) ──────────
// % de verdicts IA confirmés sans correction humaine, décomposé par code de pièce.
// C'est le critère de passage d'une pièce en `auto_autorise`.

export interface ReviewSample {
  pieceCode: string;
  agreedWithAi: boolean; // le collaborateur a confirmé le verdict IA
}

export interface PieceReliability {
  pieceCode: string;
  total: number;
  confirmed: number;
  reliability: number; // 0..1
  meetsThreshold: boolean;
}

export const DEFAULT_RELIABILITY_THRESHOLD = 0.9; // §15.4 (proposition : 90%)

/**
 * Fiabilité par CodePiece. `minSample` évite de qualifier une pièce sur un volume
 * non significatif (§15.4 « sur un volume significatif »).
 */
export function reliabilityByPiece(
  samples: ReviewSample[],
  threshold = DEFAULT_RELIABILITY_THRESHOLD,
  minSample = 20,
): PieceReliability[] {
  const byCode = new Map<string, { total: number; confirmed: number }>();
  for (const s of samples) {
    const agg = byCode.get(s.pieceCode) ?? { total: 0, confirmed: 0 };
    agg.total += 1;
    if (s.agreedWithAi) agg.confirmed += 1;
    byCode.set(s.pieceCode, agg);
  }
  return [...byCode.entries()]
    .map(([pieceCode, { total, confirmed }]) => {
      const reliability = total === 0 ? 0 : confirmed / total;
      return {
        pieceCode,
        total,
        confirmed,
        reliability,
        meetsThreshold: total >= minSample && reliability >= threshold,
      };
    })
    .sort((a, b) => b.reliability - a.reliability);
}

// ─── Métrique 3 : points de décrochage (§15.3.3) ─────────────────────────────
// Étape du parcours où les clients abandonnent.

export type FunnelStep =
  | 'COMPTE_CREE'
  | 'PREMIER_UPLOAD'
  | 'DOSSIER_PARTIEL'
  | 'DOSSIER_COMPLET';

export const FUNNEL_ORDER: FunnelStep[] = [
  'COMPTE_CREE',
  'PREMIER_UPLOAD',
  'DOSSIER_PARTIEL',
  'DOSSIER_COMPLET',
];

export interface FunnelCount {
  step: FunnelStep;
  reached: number;
  dropOffFromPrevious: number; // abandons depuis l'étape précédente
}

/** `reachedByStep` = nb de clients ayant atteint chaque étape (cumulatif décroissant). */
export function dropOffFunnel(reachedByStep: Record<FunnelStep, number>): FunnelCount[] {
  return FUNNEL_ORDER.map((step, i) => {
    const reached = reachedByStep[step] ?? 0;
    const prev = i === 0 ? reached : reachedByStep[FUNNEL_ORDER[i - 1]] ?? 0;
    return { step, reached, dropOffFromPrevious: Math.max(0, prev - reached) };
  });
}

// ─── Métrique 4 : temps cabinet économisé (§15.3.4) ──────────────────────────
// Réduction du nombre de relances manuelles vs baseline (avant l'outil).

export interface TimeSavedInput {
  baselineManualRemindersPerCampaign: number; // moyenne historique
  campaigns: number;
  actualManualReminders: number; // relances manuelles réellement déclenchées
  minutesPerReminder?: number; // estimation du temps par relance
}

export interface TimeSaved {
  remindersAvoided: number;
  minutesSaved: number;
}

export function timeSaved(input: TimeSavedInput): TimeSaved {
  const minutesPerReminder = input.minutesPerReminder ?? 5;
  const baselineTotal = input.baselineManualRemindersPerCampaign * input.campaigns;
  const remindersAvoided = Math.max(0, baselineTotal - input.actualManualReminders);
  return { remindersAvoided, minutesSaved: remindersAvoided * minutesPerReminder };
}

// ─── Complétude d'un dossier (tableau de bord §11) ───────────────────────────

export interface CompletudeInput {
  requiredTotal: number;
  conformes: number;
}

/** Taux de complétude « X/Y pièces conformes » (§11). */
export function completude(input: CompletudeInput): { ratio: number; label: string } {
  const ratio = input.requiredTotal === 0 ? 0 : input.conformes / input.requiredTotal;
  return { ratio, label: `${input.conformes}/${input.requiredTotal}` };
}
