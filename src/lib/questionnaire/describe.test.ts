import { describe, it, expect } from 'vitest';
import { describeCondition, templateResolvers } from './describe';
import { RECTIFICATIVE_TEMPLATE } from '@/data/templates/declaration-rectificative';

const r = templateResolvers(RECTIFICATIVE_TEMPLATE);

describe('describeCondition', () => {
  it('rend une égalité avec les libellés du template', () => {
    expect(describeCondition({ q: 'source', eq: 'oui' }, r)).toBe(
      'Votre demande concerne-t-elle une personne imposée à la source ? = Oui',
    );
  });
  it('rend un ET de conditions', () => {
    const s = describeCondition({ all: [{ q: 'source', eq: 'oui' }, { q: 'dejaDeposee', eq: 'oui' }] }, r);
    expect(s).toContain(' ET ');
  });
  it('rend une appartenance ∈', () => {
    expect(describeCondition({ q: 'motif', in: ['immobilier'] }, r)).toContain('∈ {Bien immobilier}');
  });
  it('« Toujours » si pas de condition (socle)', () => {
    expect(describeCondition(undefined, r)).toBe('Toujours');
  });
});
