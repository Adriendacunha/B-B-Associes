// Construit les lignes de checklist à persister à partir du profil et du
// référentiel de pièces (§4). Logique pure (testable), réutilisée par la
// server action de création de campagne.

import { selectRequiredPieces, type ClientProfile, type SelectablePiece } from './profiling';

/** Définition de pièce telle que lue en base (sous-ensemble utile). */
export interface BuildablePiece extends SelectablePiece {
  id: string;
  category: string;
  requiredByDefault: boolean;
  modeValidation: string;
  expectedYearOffset: number;
}

/** Ligne de checklist prête à être créée (ChecklistItem). */
export interface ChecklistItemDraft {
  pieceDefinitionId: string;
  pieceCode: string;
  category: string;
  required: boolean;
  modeValidation: string;
  expectedFiscalYear: number;
}

/**
 * Sélectionne les pièces applicables au profil et calcule, pour chacune,
 * l'année fiscale attendue (= année de campagne + décalage de la pièce, §4.2).
 */
export function buildChecklistItems(
  definitions: BuildablePiece[],
  profile: ClientProfile,
  fiscalYear: number,
): ChecklistItemDraft[] {
  return selectRequiredPieces(definitions, profile).map((d) => ({
    pieceDefinitionId: d.id,
    pieceCode: d.code,
    category: d.category,
    required: d.requiredByDefault,
    modeValidation: d.modeValidation,
    expectedFiscalYear: fiscalYear + d.expectedYearOffset,
  }));
}
