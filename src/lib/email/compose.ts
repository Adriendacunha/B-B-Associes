// Composition des e-mails de collecte (§6.3). Logique pure et testable :
// construction de la liste des pièces manquantes et des variables de gabarit,
// puis rendu. Le rendu réutilise renderTemplate (data/email-templates).

import { resolveLocalized, type AppLocale, type LocalizedText } from '@/lib/i18n/locales';
import { renderTemplate } from '@/data/email-templates';

/** Une pièce candidate à la relance (manquante ou non conforme, §6.1). */
export interface RelancePiece {
  nom: LocalizedText;
  status: string;
}

const RELANCE_STATUSES = new Set(['MANQUANT', 'NON_CONFORME']);

/** Pièces à relancer = manquantes ou non conformes (§6.1). */
export function pendingPieces<T extends { status: string }>(items: T[]): T[] {
  return items.filter((i) => RELANCE_STATUSES.has(i.status));
}

/** Liste à puces des pièces manquantes/non conformes, dans la langue du client. */
export function formatMissingPieces(items: RelancePiece[], locale: AppLocale): string {
  return pendingPieces(items)
    .map((i) => `- ${resolveLocalized(i.nom, locale)}`)
    .join('\n');
}

export interface EmailVarsInput {
  clientName: string;
  missingPieces?: string;
  link?: string;
  dueDate?: string;
  managerName?: string;
  reason?: string;
}

/** Variables de gabarit (§6.3) : {{client}}, {{piecesManquantes}}, {{lien}}, … */
export function buildEmailVars(input: EmailVarsInput): Record<string, string> {
  return {
    client: input.clientName,
    piecesManquantes: input.missingPieces ?? '',
    lien: input.link ?? '',
    echeance: input.dueDate ?? '',
    collaborateur: input.managerName ?? '',
    raison: input.reason ?? '',
  };
}

/** Rend l'objet et le corps d'un e-mail à partir d'un gabarit et des variables. */
export function renderEmail(
  template: { subject: string; body: string },
  vars: Record<string, string>,
): { subject: string; body: string } {
  return {
    subject: renderTemplate(template.subject, vars),
    body: renderTemplate(template.body, vars),
  };
}
