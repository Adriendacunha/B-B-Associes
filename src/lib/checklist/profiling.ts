// Checklist documentaire dynamique (§4 du brief).
//
// Le profil du client (réponses de profilage §4.1) est converti en un ensemble de
// "tags". Chaque pièce du référentiel porte des tags requis (`profils`). Une pièce
// est incluse dans la checklist si TOUS ses tags requis sont présents dans le profil
// du client (sémantique ET). Une pièce sans tag est universelle.

/** Vocabulaire de tags de profilage (stable : sert de clé au référentiel). */
export const PROFILE_TAGS = {
  // Niveau 1 — Profil de déclarant : type de contribuable
  PARTICULIER: 'PARTICULIER',
  INDEPENDANT: 'INDEPENDANT',
  SOCIETE: 'SOCIETE',
  HOIRIE: 'HOIRIE',
  // Niveau 1 — Profil de déclarant : situation de famille (état civil)
  CELIBATAIRE: 'CELIBATAIRE',
  MARIE_PACS: 'MARIE_PACS',
  SEPARE_DIVORCE: 'SEPARE_DIVORCE',
  VEUF: 'VEUF',
  // Niveau 1 — Profil de déclarant : retraité
  RETRAITE: 'RETRAITE',
  // Niveau 1 — Profil de déclarant : logement
  PROPRIETAIRE: 'PROPRIETAIRE',
  LOCATAIRE: 'LOCATAIRE',
  // Résidence (transversal Niveau 1)
  RESIDENT_CH: 'RESIDENT_CH',
  FRONTALIER: 'FRONTALIER',
  QUASI_RESIDENT: 'QUASI_RESIDENT',
  // Situation
  NOUVEAU_CLIENT: 'NOUVEAU_CLIENT',
  ENFANTS: 'ENFANTS',
  ENFANTS_MAJEURS: 'ENFANTS_MAJEURS',
  // Niveau 2 — Situations fiscales : revenus
  REVENU_SALARIE: 'REVENU_SALARIE',
  REVENU_INDEP: 'REVENU_INDEP',
  ACTIVITE_ACCESSOIRE: 'ACTIVITE_ACCESSOIRE',
  RENTES: 'RENTES',
  IMMO_LOCATIF: 'IMMO_LOCATIF',
  // Niveau 2 — Situations fiscales : fortune
  TITRES: 'TITRES',
  COMPTE_ETRANGER: 'COMPTE_ETRANGER',
  CRYPTO: 'CRYPTO',
  // Niveau 2 — Situations fiscales : déductions
  PILIER_3A: 'PILIER_3A',
  PILIER_3B: 'PILIER_3B',
  RACHAT_LPP: 'RACHAT_LPP',
  FRAIS_GARDE: 'FRAIS_GARDE',
  FRAIS_MEDICAUX: 'FRAIS_MEDICAUX',
  FORMATION: 'FORMATION',
  FRAIS_PRO: 'FRAIS_PRO',
  DONS: 'DONS',
  PENSIONS: 'PENSIONS',
  DETTES: 'DETTES',
  ASSUJETTI_TVA: 'ASSUJETTI_TVA',
} as const;

export type ProfileTag = (typeof PROFILE_TAGS)[keyof typeof PROFILE_TAGS];

/** État civil / situation de famille (Niveau 1). */
export type SituationFamille = 'CELIBATAIRE' | 'MARIE_PACS' | 'SEPARE_DIVORCE' | 'VEUF';

/** Réponses de profilage (§4.1). */
export interface ClientProfile {
  // Niveau 1 — Profil de déclarant
  type: 'PARTICULIER' | 'INDEPENDANT' | 'SOCIETE' | 'HOIRIE';
  residence: 'RESIDENT_CH' | 'FRONTALIER' | 'QUASI_RESIDENT';
  situationFamille?: SituationFamille;
  retraite?: boolean;
  nouveauClient?: boolean;
  logement?: 'PROPRIETAIRE' | 'LOCATAIRE';
  nbEnfants?: number;
  enfantsMajeursACharge?: boolean;
  // Niveau 2 — Situations fiscales
  revenuSalarie?: boolean;
  revenuIndependant?: boolean;
  activiteAccessoire?: boolean;
  rentes?: boolean;
  immoLocatif?: boolean;
  titres?: boolean;
  compteEtranger?: boolean;
  crypto?: boolean;
  pilier3a?: boolean;
  pilier3b?: boolean;
  rachatLpp?: boolean;
  fraisGarde?: boolean;
  fraisMedicaux?: boolean;
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
  // Niveau 1 — Profil de déclarant
  tags.add(p.type as ProfileTag);
  tags.add(p.residence as ProfileTag);
  if (p.situationFamille) tags.add(p.situationFamille as ProfileTag);
  // Un retraité a, par définition, des revenus de rente : on inclut l'attestation
  // de rentes sans qu'il faille cocher séparément la situation « rentes ».
  if (p.retraite) {
    tags.add(PROFILE_TAGS.RETRAITE);
    tags.add(PROFILE_TAGS.RENTES);
  }
  if (p.nouveauClient) tags.add(PROFILE_TAGS.NOUVEAU_CLIENT);
  if (p.logement) tags.add(p.logement as ProfileTag);
  if ((p.nbEnfants ?? 0) > 0) tags.add(PROFILE_TAGS.ENFANTS);
  if (p.enfantsMajeursACharge) tags.add(PROFILE_TAGS.ENFANTS_MAJEURS);
  // Niveau 2 — Situations fiscales
  if (p.revenuSalarie) tags.add(PROFILE_TAGS.REVENU_SALARIE);
  if (p.revenuIndependant) tags.add(PROFILE_TAGS.REVENU_INDEP);
  if (p.activiteAccessoire) tags.add(PROFILE_TAGS.ACTIVITE_ACCESSOIRE);
  if (p.rentes) tags.add(PROFILE_TAGS.RENTES);
  if (p.immoLocatif) tags.add(PROFILE_TAGS.IMMO_LOCATIF);
  if (p.titres) tags.add(PROFILE_TAGS.TITRES);
  if (p.compteEtranger) tags.add(PROFILE_TAGS.COMPTE_ETRANGER);
  if (p.crypto) tags.add(PROFILE_TAGS.CRYPTO);
  if (p.pilier3a) tags.add(PROFILE_TAGS.PILIER_3A);
  if (p.pilier3b) tags.add(PROFILE_TAGS.PILIER_3B);
  if (p.rachatLpp) tags.add(PROFILE_TAGS.RACHAT_LPP);
  if (p.fraisGarde) tags.add(PROFILE_TAGS.FRAIS_GARDE);
  if (p.fraisMedicaux) tags.add(PROFILE_TAGS.FRAIS_MEDICAUX);
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
