// Décision humaine sur un document (§15.1 — humain dans la boucle). Logique pure.
//
// `agreedWithAi` est la donnée centrale des métriques de fiabilité par CodePiece
// (§15.3.2 / §15.4) : le collaborateur a-t-il confirmé le verdict de l'IA ?

export type ReviewDecision = 'VALIDE' | 'REJETE';

/**
 * Le collaborateur « confirme » l'IA si sa décision finale coïncide avec le verdict :
 *  - VALIDE  ⇔ l'IA disait conforme,
 *  - REJETE  ⇔ l'IA disait non conforme.
 */
export function humanAgreesWithAi(decision: ReviewDecision, aiConforme: boolean): boolean {
  return (decision === 'VALIDE') === aiConforme;
}

export interface ReviewOutcome {
  documentStatus: 'DEPOSE_ONEDRIVE' | 'REJETE';
  itemStatus: 'CONFORME' | 'NON_CONFORME';
}

/** Statuts résultant d'une décision (validé → dépôt OneDrive ; rejeté → à refournir). */
export function reviewOutcome(decision: ReviewDecision): ReviewOutcome {
  return decision === 'VALIDE'
    ? { documentStatus: 'DEPOSE_ONEDRIVE', itemStatus: 'CONFORME' }
    : { documentStatus: 'REJETE', itemStatus: 'NON_CONFORME' };
}

/**
 * Statut global d'une campagne d'après ses pièces obligatoires (§11).
 * - COMPLET si toutes les obligatoires sont CONFORME ;
 * - A_VALIDER s'il reste des pièces en attente de décision humaine ;
 * - EN_COURS sinon.
 */
export function campaignStatusFrom(
  requiredStatuses: string[],
  anyInValidation: boolean,
): 'COMPLET' | 'A_VALIDER' | 'EN_COURS' {
  if (requiredStatuses.length > 0 && requiredStatuses.every((s) => s === 'CONFORME')) return 'COMPLET';
  if (anyInValidation) return 'A_VALIDER';
  return 'EN_COURS';
}
