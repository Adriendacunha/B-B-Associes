import { describe, it, expect } from 'vitest';
import { evalCondition, isQuestionVisible, requestedDocuments, visibleSections, qualificationComplete } from './engine';
import type { Template } from './types';
import {
  RECTIFICATIVE_TEMPLATE,
  QUALIFYING_IDS,
  drisToTouAlert,
  notEligibleTouAlert,
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
  it('la branche DRIS n’apparaît que pour source=oui + démarche de rectification', () => {
    const drisVisible = (answers: Record<string, unknown>) =>
      visibleSections(tmpl, answers as never).some((s) => s.id === 'dris');
    expect(drisVisible({ source: 'oui', typeDeclaration: 'rectification' })).toBe(true);
    expect(drisVisible({ source: 'non', typeDeclaration: 'rectification' })).toBe(false);
    expect(drisVisible({ source: 'oui', typeDeclaration: 'ordinaire' })).toBe(false); // ordinaire → TOU
  });
  it('la branche TOU apparaît pour source=non OU déclaration ordinaire', () => {
    const touVisible = (answers: Record<string, unknown>) =>
      visibleSections(tmpl, answers as never).some((s) => s.id === 'tou');
    expect(touVisible({ source: 'non', typeDeclaration: 'rectification' })).toBe(true);
    expect(touVisible({ source: 'oui', typeDeclaration: 'ordinaire' })).toBe(true);
    expect(touVisible({ source: 'oui', typeDeclaration: 'rectification' })).toBe(false); // → DRIS
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
      typeDeclaration: 'rectification',
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
      typeDeclaration: 'ordinaire',
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
  it('gate quasi-résident : non-résident avec < 90 % → non éligible TOU', () => {
    expect(notEligibleTouAlert({ statutResidence: 'non_resident', touQuasiResident: 'non' })).toBe(true);
    expect(notEligibleTouAlert({ statutResidence: 'non_resident', touQuasiResident: 'oui' })).toBe(false);
    expect(notEligibleTouAlert({ statutResidence: 'resident_ch', touQuasiResident: 'non' })).toBe(false);
  });
});

describe('qualification', () => {
  it('complète quand les questions d’orientation visibles sont répondues', () => {
    // orientation : source, typeDeclaration, decisionTaxation, motif (ces 2 derniers visibles si rectification)
    const answers = { source: 'non', typeDeclaration: 'rectification', decisionTaxation: 'non', motif: ['immobilier'] };
    expect(qualificationComplete(RECTIFICATIVE_TEMPLATE, answers, QUALIFYING_IDS)).toBe(true);
  });
  it('incomplète si un motif manque', () => {
    const answers = { source: 'non', typeDeclaration: 'rectification', decisionTaxation: 'non' };
    expect(qualificationComplete(RECTIFICATIVE_TEMPLATE, answers, QUALIFYING_IDS)).toBe(false);
  });
  it('déclaration ordinaire : qualifiée sans motif/décision (questions masquées)', () => {
    // En mode ordinaire, decisionTaxation et motif sont masqués → non requis.
    const answers = { source: 'non', typeDeclaration: 'ordinaire' };
    expect(qualificationComplete(RECTIFICATIVE_TEMPLATE, answers, QUALIFYING_IDS)).toBe(true);
  });
});
