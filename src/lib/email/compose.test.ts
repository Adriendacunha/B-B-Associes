import { describe, it, expect } from 'vitest';
import { pendingPieces, formatMissingPieces, buildEmailVars, renderEmail } from './compose';
import type { LocalizedText } from '@/lib/i18n/locales';

const nom = (fr: string): LocalizedText => ({ fr, en: fr, de: fr });
const items = [
  { nom: nom('Certificat de salaire'), status: 'CONFORME' },
  { nom: nom('Attestation 3a'), status: 'MANQUANT' },
  { nom: nom('État des titres'), status: 'NON_CONFORME' },
  { nom: nom('Relevé bancaire'), status: 'EN_VALIDATION' },
];

describe('pendingPieces / formatMissingPieces (§6.1)', () => {
  it('ne retient que manquant + non conforme', () => {
    expect(pendingPieces(items).map((i) => i.status)).toEqual(['MANQUANT', 'NON_CONFORME']);
  });
  it('formate une liste à puces dans la langue', () => {
    expect(formatMissingPieces(items, 'fr')).toBe('- Attestation 3a\n- État des titres');
  });
});

describe('buildEmailVars / renderEmail (§6.3)', () => {
  it('remplit les variables de gabarit', () => {
    const vars = buildEmailVars({ clientName: 'Dupont Jean', missingPieces: '- 3a', link: 'https://x', dueDate: '31.03.2026', managerName: 'Collab' });
    const out = renderEmail(
      { subject: 'Rappel — {{client}}', body: 'Pièces:\n{{piecesManquantes}}\nLien: {{lien}} échéance {{echeance}} ({{collaborateur}})' },
      vars,
    );
    expect(out.subject).toBe('Rappel — Dupont Jean');
    expect(out.body).toContain('- 3a');
    expect(out.body).toContain('https://x');
    expect(out.body).toContain('31.03.2026');
    expect(out.body).toContain('Collab');
  });
  it('remplace les variables absentes par du vide', () => {
    const out = renderEmail({ subject: 's', body: 'r={{raison}}' }, buildEmailVars({ clientName: 'X' }));
    expect(out.body).toBe('r=');
  });
});
