// Arborescence OneDrive et convention de nommage des fichiers (§5 du brief).
//
// - Arborescence créée à l'ouverture d'une campagne (§5.1/§5.2).
// - Nom de fichier normalisé : pas d'accents ni d'espaces (§5.3) ; les accents
//   restent affichés dans l'app, jamais dans le nom de fichier physique.
// - Gestion des doublons par suffixe _v2, _v3 (§5.3).

// Catégories = noms des valeurs de l'enum Prisma PieceCategory (mêmes chaînes),
// redéfinies localement pour garder ce module testable sans le client généré.
export type PieceCategory =
  | 'REVENUS'
  | 'TITRES_FORTUNE'
  | 'IMMOBILIER'
  | 'DEDUCTIONS'
  | 'FAMILLE'
  | 'INDEP_SOCIETE'
  | 'A_TRIER';

/** Racine de la collecte fiscale sur OneDrive Business. */
export const ROOT_FOLDER = 'Clients fiscaux';

/**
 * Libellés des sous-dossiers (§5.2). Le préfixe numérique fixe l'ordre d'affichage.
 * `99 - A trier-Non classe` reçoit ce qui n'est rattaché à aucune catégorie.
 */
export const CATEGORY_FOLDERS: Record<PieceCategory, string> = {
  REVENUS: '01 - Revenus',
  TITRES_FORTUNE: '02 - Titres et fortune',
  IMMOBILIER: '03 - Immobilier',
  DEDUCTIONS: '04 - Deductions',
  FAMILLE: '05 - Famille',
  INDEP_SOCIETE: '06 - Independant-Societe',
  A_TRIER: '99 - A trier-Non classe',
};

/** Sous-dossiers dans l'ordre, pour la création initiale de l'arborescence. */
export const ORDERED_CATEGORIES: PieceCategory[] = [
  'REVENUS',
  'TITRES_FORTUNE',
  'IMMOBILIER',
  'DEDUCTIONS',
  'FAMILLE',
  'INDEP_SOCIETE',
  'A_TRIER',
];

/**
 * Normalise un segment pour un nom de fichier/dossier : retire les accents,
 * remplace les espaces par des tirets, ne conserve que [A-Za-z0-9-].
 * Ex. "Dupont Jean" -> "Dupont-Jean", "Société" -> "Societe".
 */
export function normalizeSegment(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacritiques combinants
    .replace(/['’]/g, '') // apostrophes droites et typographiques
    .replace(/\s+/g, '-') // espaces -> tirets
    .replace(/[^A-Za-z0-9-]/g, '') // tout le reste
    .replace(/-+/g, '-') // tirets multiples
    .replace(/^-|-$/g, ''); // tirets en bordure
}

export interface CampaignFolderParams {
  clientCode: string;
  clientDisplayName: string;
  fiscalYear: number;
}

/**
 * Chemin racine du dossier de campagne (§5.2) :
 *   /Clients fiscaux/[ID-Client] - [Nom Client]/[Année fiscale]/
 * Les segments client gardent un format lisible (le nom du fichier, lui, est strict).
 */
export function campaignRootPath(p: CampaignFolderParams): string {
  const clientFolder = `${p.clientCode} - ${p.clientDisplayName}`;
  return `/${ROOT_FOLDER}/${clientFolder}/${p.fiscalYear}`;
}

/** Liste complète des dossiers à créer pour une campagne (racine + sous-catégories). */
export function campaignFolderTree(p: CampaignFolderParams): string[] {
  const root = campaignRootPath(p);
  return [root, ...ORDERED_CATEGORIES.map((c) => `${root}/${CATEGORY_FOLDERS[c]}`)];
}

export interface FileNameParams {
  fiscalYear: number;
  clientDisplayName: string;
  pieceCode: string;
  /** Date de dépôt ; défaut = maintenant. */
  depositDate?: Date;
  version?: number; // 1 = pas de suffixe ; 2 -> _v2, etc.
  extension?: string; // défaut "pdf"
}

function formatYyyymmdd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * Nom de fichier normalisé (§5.3) :
 *   [AnneeFiscale]_[NomClient]_[CodePiece]_[AAAAMMJJ-depot].pdf
 * Ex. 2025_Dupont-Jean_CERT-SALAIRE_20260114.pdf
 * Doublons : version >= 2 ajoute _v2, _v3 avant l'extension.
 */
export function buildFileName(p: FileNameParams): string {
  const date = p.depositDate ?? new Date();
  const ext = (p.extension ?? 'pdf').replace(/^\./, '').toLowerCase();
  const name = p.clientDisplayName ? normalizeSegment(p.clientDisplayName) : '';
  const code = normalizeSegment(p.pieceCode);
  const parts = [String(p.fiscalYear), name, code, formatYyyymmdd(date)].filter(Boolean);
  const versionSuffix = p.version && p.version >= 2 ? `_v${p.version}` : '';
  return `${parts.join('_')}${versionSuffix}.${ext}`;
}

/** Chemin OneDrive final complet d'un document validé. */
export function buildFinalPath(
  campaign: CampaignFolderParams,
  category: PieceCategory,
  file: FileNameParams,
): string {
  return `${campaignRootPath(campaign)}/${CATEGORY_FOLDERS[category]}/${buildFileName(file)}`;
}
