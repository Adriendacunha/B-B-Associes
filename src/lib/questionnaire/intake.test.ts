import { describe, it, expect } from 'vitest';
import { intakeQuestions, intakeComplete, intakeSummary } from './intake';
import { RECTIFICATIVE_TEMPLATE as T } from '@/data/templates/declaration-rectificative';

const base = { source: 'oui', dejaDeposee: 'oui', decisionTaxation: 'oui', motif: ['bareme_taux'] };

describe('intake (données du dossier remplies par le client)', () => {
  it('ne retient que les questions clientData visibles', () => {
    const ids = intakeQuestions(T, base).map((q) => q.id);
    expect(ids).toContain('nomPrenom'); // donnée client
    expect(ids).toContain('dateNotification'); // visible car decisionTaxation = oui
    expect(ids).not.toContain('source'); // question de qualification (cabinet)
    expect(ids).not.toContain('mandatBB'); // qualification, pas clientData
  });

  it('dateNotification n’apparaît pas si pas de décision', () => {
    const ids = intakeQuestions(T, { ...base, decisionTaxation: 'non' }).map((q) => q.id);
    expect(ids).not.toContain('dateNotification');
  });

  it('intakeComplete : vrai seulement si toutes les questions visibles sont répondues', () => {
    expect(intakeComplete(T, base)).toBe(false);
    const filled: Record<string, unknown> = { ...base };
    for (const q of intakeQuestions(T, base)) filled[q.id] = q.answerType === 'number' ? 2024 : 'x';
    expect(intakeComplete(T, filled as never)).toBe(true);
  });

  it('intakeSummary résout les libellés de choix', () => {
    const rows = intakeSummary(T, { ...base, etatCivil: 'marie_pacs' });
    const etat = rows.find((r) => r.label.includes('état civil'));
    expect(etat?.value).toBe('Marié·e / partenariat');
  });
});
