import { describe, it, expect } from 'vitest';
import { evalCondition, isQuestionVisible, requestedDocuments, visibleSections, qualificationComplete } from './engine';
import type { Template } from './types';
import {
  RECTIFICATIVE_TEMPLATE,
  QUALIFYING_IDS,
  drisToTouAlert,
  notRectificativeAlert,
} from '@/data/templates/declaration-rectificative';

describe('evalCondition', () => {
  it('eq / in / answered + combinateurs', () => {
    const a = { source: 'oui', motif: ['immobilier', 'enfant_charge'], nom: 'Dupont' };
    expect(evalCondition({ q: 'source', eq: 'oui' }, a)).toBe(true);
    expect(evalCondition({ q: 'source', eq: 'non' }, a)).toBe(false);
    expect(evalCondition({ q: 'motif', in: ['immobilier'] }, a)).toBe(true); // multi ∩
    expect(evalCondition({ q: 'motif', in: ['dette_interets'] }, a)).toBe(false);
    expect(evalCondition({ q: 'nom', answered: true }, a)).toBe(true);
    expect(evalCondition({ q: 'absent', answered: true }, a)).toBe(false);
    expect(evalCondition({ all: [{ q: 'source', eq: 'oui' }, { q: 'nom', answered: true }] }, a)).toBe(true);
    expect(evalCondition({ any: [{ q: 'source', eq: 'non' }, { q: 'nom', answered: true }] }, a)).toBe(true);
    expect(evalCondition({ not: { q: 'source', eq: 'oui' } }, a)).toBe(false);
  });
  it('condition absente = vrai (socle)', () => {
    expect(evalCondition(undefined, {})).toBe(true);
  });
});

describe('visibilité des questions / sections', () => {
  const tmpl: Template = RECTIFICATIVE_TEMPLATE;
  it('la branche DRIS n’apparaît que pour source=oui + déclaration déposée', () => {
    const drisVisible = (answers: Record<string, unknown>) =>
      visibleSections(tmpl, answers as never).some((s) => s.id === 'dris');
    expect(drisVisible({ source: 'oui', dejaDeposee: 'oui' })).toBe(true);
    expect(drisVisible({ source: 'non', dejaDeposee: 'oui' })).toBe(false);
    expect(drisVisible({ source: 'oui', dejaDeposee: 'non' })).toBe(false);
  });
  it('la branche TOU n’apparaît que pour source=non', () => {
    const touVisible = (answers: Record<string, unknown>) =>
      visibleSections(tmpl, answers as never).some((s) => s.id === 'tou');
    expect(touVisible({ source: 'non', dejaDeposee: 'oui' })).toBe(true);
    expect(touVisible({ source: 'oui', dejaDeposee: 'oui' })).toBe(false);
  });
  it('question conditionnelle (quasi-résident) visible seulement si non-résident', () => {
    const q = tmpl.sections.flatMap((s) => s.questions).find((x) => x.id === 'touQuasiResident')!;
    expect(isQuestionVisible(q, { statutResidence: 'non_resident' })).toBe(true);
    expect(isQuestionVisible(q, { statutResidence: 'resident_ch' })).toBe(false);
  });
});

describe('documents demandés (checklist conditionnelle)', () => {
  it('un dossier DRIS simple demande les pièces source, pas les déductions TOU', () => {
    const docs = requestedDocuments(RECTIFICATIVE_TEMPLATE, {
      source: 'oui',
      dejaDeposee: 'oui',
      decisionTaxation: 'oui',
      drisSalaireCorrect: 'non',
    }).map((d) => d.id);
    expect(docs).toContain('dris-certificats-salaire');
    expect(docs).toContain('dris-attestation-source');
    expect(docs).toContain('dris-decomptes-mensuels'); // car salaire incorrect
    expect(docs).toContain('decision-taxation');
    expect(docs).not.toContain('tou-certificats-salaire');
    expect(docs).not.toContain('immo-estimation');
  });

  it('un dossier TOU propriétaire demande les pièces immobilières', () => {
    const docs = requestedDocuments(RECTIFICATIVE_TEMPLATE, {
      source: 'non',
      dejaDeposee: 'oui',
      touProprietaire: 'oui',
    }).map((d) => d.id);
    expect(docs).toContain('tou-certificats-salaire');
    expect(docs).toContain('immo-estimation');
    expect(docs).toContain('immo-interets');
    expect(docs).not.toContain('dris-certificats-salaire');
  });
});

describe('alertes métier', () => {
  it('alerte DRIS → TOU si déductions effectives cochées en branche source', () => {
    expect(drisToTouAlert({ source: 'oui', drisDeductionsEffectives: ['3a'] })).toBe(true);
    expect(drisToTouAlert({ source: 'oui', drisDeductionsEffectives: [] })).toBe(false);
    expect(drisToTouAlert({ source: 'non', drisDeductionsEffectives: ['3a'] })).toBe(false);
  });
  it('alerte « pas une rectification » si déclaration initiale non déposée', () => {
    expect(notRectificativeAlert({ dejaDeposee: 'non' })).toBe(true);
    expect(notRectificativeAlert({ dejaDeposee: 'oui' })).toBe(false);
  });
});

describe('qualification', () => {
  it('complète quand les questions d’orientation visibles sont répondues', () => {
    // source=non → pas de question DRIS ; orientation : source, dejaDeposee, decisionTaxation, motif
    const answers = { source: 'non', dejaDeposee: 'oui', decisionTaxation: 'non', motif: ['immobilier'] };
    expect(qualificationComplete(RECTIFICATIVE_TEMPLATE, answers, QUALIFYING_IDS)).toBe(true);
  });
  it('incomplète si un motif manque', () => {
    const answers = { source: 'non', dejaDeposee: 'oui', decisionTaxation: 'non' };
    expect(qualificationComplete(RECTIFICATIVE_TEMPLATE, answers, QUALIFYING_IDS)).toBe(false);
  });
});
