import { describe, it, expect } from 'vitest';
import { planChecklistSync } from './rectificative-sync';
import { requestedDocuments } from '@/lib/questionnaire/engine';
import { RECTIFICATIVE_TEMPLATE as T } from '@/data/templates/declaration-rectificative';
import { rectPieceCode } from '@/data/templates/rectificative-pieces';
import { A_TRIER_CODE } from '@/data/piece-referential';

const answers = { source: 'non', typeDeclaration: 'ordinaire' };
const requestedCodes = requestedDocuments(T, answers).map((d) => rectPieceCode(d.id));

describe('planChecklistSync', () => {
  it('crée toutes les pièces demandées quand la checklist est vide', () => {
    const plan = planChecklistSync(answers, [], [A_TRIER_CODE]);
    expect(plan.create.map((c) => c.pieceCode).sort()).toEqual([...requestedCodes].sort());
    expect(plan.deleteCodes).toEqual([]);
  });

  it('retire une pièce non demandée et sans dépôt', () => {
    const existing = [
      ...requestedCodes.map((c) => ({ pieceCode: c, hasDocuments: false })),
      { pieceCode: 'RECT-phantom', hasDocuments: false },
    ];
    const plan = planChecklistSync(answers, existing, [A_TRIER_CODE]);
    expect(plan.create).toEqual([]);
    expect(plan.deleteCodes).toContain('RECT-phantom');
  });

  it('ne supprime jamais une pièce ayant un dépôt, ni une pièce protégée', () => {
    const existing = [
      { pieceCode: 'RECT-phantom', hasDocuments: true }, // dépôt présent
      { pieceCode: A_TRIER_CODE, hasDocuments: false }, // protégée
    ];
    const plan = planChecklistSync(answers, existing, [A_TRIER_CODE]);
    expect(plan.deleteCodes).not.toContain('RECT-phantom');
    expect(plan.deleteCodes).not.toContain(A_TRIER_CODE);
  });
});
