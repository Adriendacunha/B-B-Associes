// Checklist documentaire dynamique (§4 du brief).
//
// Le profil du client (réponses de profilage §4.1) est converti en un ensemble de
// "tags". Chaque pièce du référentiel porte des tags requis (`profils`). Une pièce
// est incluse dans la checklist si TOUS ses tags requis sont présents dans le profil
// du client (sémantique ET). Une pièce sans tag est universelle.

/** Vocabulaire de tags de profilage (stable : sert de clé au référentiel). */
export const PROFILE_TAGS = {
  // Type de contribuable
  PARTICULIER: 'PARTICULIER',
  INDEPENDANT: 'INDEPENDANT',
  SOCIETE: 'SOCIETE',
  HOIRIE: 'HOIRIE',
  // Résidence
  RESIDENT_CH: 'RESIDENT_CH',
  FRONTALIER: 'FRONTALIER',
  QUASI_RESIDENT: 'QUASI_RESIDENT',
  // Situation
  NOUVEAU_CLIENT: 'NOUVEAU_CLIENT',
  PROPRIETAIRE: 'PROPRIETAIRE',
  LOCATAIRE: 'LOCATAIRE',
  ENFANTS: 'ENFANTS',
  ENFANTS_MAJEURS: 'ENFANTS_MAJEURS',
  // Revenus
  REVENU_SALARIE: 'REVENU_SALARIE',
  REVENU_INDEP: 'REVENU_INDEP',
  RENTES: 'RENTES',
  IMMO_LOCATIF: 'IMMO_LOCATIF',
  // Fortune
  TITRES: 'TITRES',
  COMPTE_ETRANGER: 'COMPTE_ETRANGER',
  CRYPTO: 'CRYPTO',
  // Déductions
  PILIER_3A: 'PILIER_3A',
  PILIER_3B: 'PILIER_3B',
  RACHAT_LPP: 'RACHAT_LPP',
  FRAIS_GARDE: 'FRAIS_GARDE',
  FORMATION: 'FORMATION',
  FRAIS_PRO: 'FRAIS_PRO',
  DONS: 'DONS',
  PENSIONS: 'PENSIONS',
  DETTES: 'DETTES',
  ASSUJETTI_TVA: 'ASSUJETTI_TVA',
} as const;

export type ProfileTag = (typeof PROFILE_TAGS)[keyof typeof PROFILE_TAGS];

/** Réponses de profilage (§4.1). */
export interface ClientProfile {
  type: 'PARTICULIER' | 'INDEPENDANT' | 'SOCIETE' | 'HOIRIE';
  residence: 'RESIDENT_CH' | 'FRONTALIER' | 'QUASI_RESIDENT';
  nouveauClient?: boolean;
  logement?: 'PROPRIETAIRE' | 'LOCATAIRE';
  nbEnfants?: number;
  enfantsMajeursACharge?: boolean;
  revenuSalarie?: boolean;
  revenuIndependant?: boolean;
  rentes?: boolean;
  immoLocatif?: boolean;
  titres?: boolean;
  compteEtranger?: boolean;
  crypto?: boolean;
  pilier3a?: boolean;
  pilier3b?: boolean;
  rachatLpp?: boolean;
  fraisGarde?: boolean;
  formation?: boolean;
  fraisProEffectifs?: boolean;
  dons?: boolean;
  pensions?: boolean;
  dettes?: boolean;
  assujettiTva?: boolean;
}

/** Convertit un profil en ensemble de tags pour la sélection des pièces. */
export function deriveProfileTags(p: ClientProfile): Set<ProfileTag> {
  const tags = new Set<ProfileTag>();
  tags.add(p.type as ProfileTag);
  tags.add(p.residence as ProfileTag);
  if (p.nouveauClient) tags.add(PROFILE_TAGS.NOUVEAU_CLIENT);
  if (p.logement) tags.add(p.logement as ProfileTag);
  if ((p.nbEnfants ?? 0) > 0) tags.add(PROFILE_TAGS.ENFANTS);
  if (p.enfantsMajeursACharge) tags.add(PROFILE_TAGS.ENFANTS_MAJEURS);
  if (p.revenuSalarie) tags.add(PROFILE_TAGS.REVENU_SALARIE);
  if (p.revenuIndependant) tags.add(PROFILE_TAGS.REVENU_INDEP);
  if (p.rentes) tags.add(PROFILE_TAGS.RENTES);
  if (p.immoLocatif) tags.add(PROFILE_TAGS.IMMO_LOCATIF);
  if (p.titres) tags.add(PROFILE_TAGS.TITRES);
  if (p.compteEtranger) tags.add(PROFILE_TAGS.COMPTE_ETRANGER);
  if (p.crypto) tags.add(PROFILE_TAGS.CRYPTO);
  if (p.pilier3a) tags.add(PROFILE_TAGS.PILIER_3A);
  if (p.pilier3b) tags.add(PROFILE_TAGS.PILIER_3B);
  if (p.rachatLpp) tags.add(PROFILE_TAGS.RACHAT_LPP);
  if (p.fraisGarde) tags.add(PROFILE_TAGS.FRAIS_GARDE);
  if (p.formation) tags.add(PROFILE_TAGS.FORMATION);
  if (p.fraisProEffectifs) tags.add(PROFILE_TAGS.FRAIS_PRO);
  if (p.dons) tags.add(PROFILE_TAGS.DONS);
  if (p.pensions) tags.add(PROFILE_TAGS.PENSIONS);
  if (p.dettes) tags.add(PROFILE_TAGS.DETTES);
  if (p.assujettiTva) tags.add(PROFILE_TAGS.ASSUJETTI_TVA);
  return tags;
}

/** Pièce telle qu'utilisée par la sélection (sous-ensemble de PieceDefinition). */
export interface SelectablePiece {
  code: string;
  profils: string[]; // tags requis (ET). [] = universelle pour tous.
  active?: boolean;
}

/**
 * Une pièce s'applique si tous ses tags requis sont satisfaits par le profil.
 */
export function pieceApplies(piece: SelectablePiece, tags: Set<ProfileTag>): boolean {
  if (piece.active === false) return false;
  return piece.profils.every((t) => tags.has(t as ProfileTag));
}

/** Génère la liste des codes de pièces requis pour un profil donné (§4.1). */
export function selectRequiredPieces<T extends SelectablePiece>(
  definitions: T[],
  profile: ClientProfile,
): T[] {
  const tags = deriveProfileTags(profile);
  return definitions.filter((d) => pieceApplies(d, tags));
}

/**
 * Report d'une année sur l'autre (§4.3) : on repart du profil précédent et on
 * met à jour l'année fiscale attendue. Le profil peut être ajusté avant génération.
 */
export function carryOverProfile(
  previous: ClientProfile,
  overrides: Partial<ClientProfile> = {},
): ClientProfile {
  return { ...previous, ...overrides };
}
