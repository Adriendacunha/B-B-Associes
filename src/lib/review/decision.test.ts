import { describe, it, expect } from 'vitest';
import { humanAgreesWithAi, reviewOutcome, campaignStatusFrom } from './decision';

describe('humanAgreesWithAi (§15.3.2)', () => {
  it('VALIDE confirme un verdict conforme', () => {
    expect(humanAgreesWithAi('VALIDE', true)).toBe(true);
    expect(humanAgreesWithAi('VALIDE', false)).toBe(false); // collab valide malgré IA non conforme
  });
  it('REJETE confirme un verdict non conforme', () => {
    expect(humanAgreesWithAi('REJETE', false)).toBe(true);
    expect(humanAgreesWithAi('REJETE', true)).toBe(false); // collab rejette malgré IA conforme
  });
});

describe('reviewOutcome', () => {
  it('mappe la décision vers les statuts', () => {
    expect(reviewOutcome('VALIDE')).toEqual({ documentStatus: 'DEPOSE_ONEDRIVE', itemStatus: 'CONFORME' });
    expect(reviewOutcome('REJETE')).toEqual({ documentStatus: 'REJETE', itemStatus: 'NON_CONFORME' });
  });
});

describe('campaignStatusFrom (§11)', () => {
  it('COMPLET si toutes les obligatoires sont conformes', () => {
    expect(campaignStatusFrom(['CONFORME', 'CONFORME'], false)).toBe('COMPLET');
  });
  it('A_VALIDER s’il reste des pièces en validation', () => {
    expect(campaignStatusFrom(['CONFORME', 'MANQUANT'], true)).toBe('A_VALIDER');
  });
  it('EN_COURS sinon', () => {
    expect(campaignStatusFrom(['CONFORME', 'MANQUANT'], false)).toBe('EN_COURS');
  });
  it('pas COMPLET si aucune pièce obligatoire', () => {
    expect(campaignStatusFrom([], false)).toBe('EN_COURS');
  });
});
