// Synchronisation de la checklist d'une campagne « Déclaration d'impôt » quand les
// réponses du questionnaire changent (le cabinet OU le client y répond). On ajoute
// les pièces nouvellement demandées et on retire celles qui ne le sont plus —
// JAMAIS une pièce protégée (ex. « À trier ») ni une pièce ayant déjà reçu un
// document (on ne supprime jamais un dépôt du client).

import type { Answers } from '@/lib/questionnaire/types';
import { requestedDocuments } from '@/lib/questionnaire/engine';
import { RECTIFICATIVE_TEMPLATE } from '@/data/templates/declaration-rectificative';
import { rectPieceCode } from '@/data/templates/rectificative-pieces';

export interface ExistingItem {
  pieceCode: string;
  hasDocuments: boolean;
}

export interface ChecklistSyncPlan {
  /** Pièces à créer (code + caractère obligatoire). */
  create: { pieceCode: string; required: boolean }[];
  /** Codes de pièces à retirer (non demandées, sans dépôt, non protégées). */
  deleteCodes: string[];
}

/**
 * Calcule l'ajout/retrait de pièces pour faire correspondre la checklist aux
 * documents demandés par les réponses `answers`. `protectedCodes` ne sont jamais
 * supprimés (ex. la pièce système « À trier »).
 */
export function planChecklistSync(
  answers: Answers,
  existing: ExistingItem[],
  protectedCodes: string[] = [],
): ChecklistSyncPlan {
  const docs = requestedDocuments(RECTIFICATIVE_TEMPLATE, answers);
  const requestedByCode = new Map(docs.map((d) => [rectPieceCode(d.id), d]));
  const present = new Set(existing.map((i) => i.pieceCode));
  const protect = new Set(protectedCodes);

  const create = [...requestedByCode.entries()]
    .filter(([code]) => !present.has(code))
    .map(([code, d]) => ({ pieceCode: code, required: d.obligation === 'obligatoire' }));

  const deleteCodes = existing
    .filter((i) => !requestedByCode.has(i.pieceCode) && !i.hasDocuments && !protect.has(i.pieceCode))
    .map((i) => i.pieceCode);

  return { create, deleteCodes };
}
