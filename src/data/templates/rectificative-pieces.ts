// Matérialise les documents du template « Déclaration rectificative » en
// PieceDefinition, afin que les campagnes rectificatives réutilisent INTÉGRALEMENT
// le pipeline existant : ChecklistItem → Document → upload → analyse IA → validation
// → export OneDrive. Aucune divergence du flux de dépôt.

import type { PieceCategoryKey, PieceReferentialEntry } from '@/data/piece-referential';
import type { LocalizedText } from '@/lib/i18n/locales';
import { RECTIFICATIVE_TEMPLATE } from './declaration-rectificative';

/** Tag de profil réservé : empêche toute sélection par le profilage ordinaire à tags. */
export const RECTIFICATIVE_TAG = '__RECTIFICATIVE__';

/** Code stable d'une pièce rectificative dérivé de l'id du document du template. */
export function rectPieceCode(docId: string): string {
  return `RECT-${docId}`;
}

// Catégorie fiscale (libellé template) → catégorie d'arborescence OneDrive (enum).
const CATEGORY_MAP: Record<string, PieceCategoryKey> = {
  'Identification du dossier': 'A_TRIER',
  'Pièces administratives': 'A_TRIER',
  'Événements familiaux': 'FAMILLE',
  Revenus: 'REVENUS',
  'Fortune et comptes': 'TITRES_FORTUNE',
  Immobilier: 'IMMOBILIER',
  Dettes: 'DEDUCTIONS',
  'Assurances et prévoyance': 'DEDUCTIONS',
  Déductions: 'DEDUCTIONS',
};

// FR-first : EN/DE reprennent le FR en attendant la traduction du template.
function loc(s: string): LocalizedText {
  return { fr: s, en: s, de: s };
}

/** Entrées PieceDefinition (forme du référentiel) dérivées du template rectificative. */
export function rectificativePieceEntries(): PieceReferentialEntry[] {
  return RECTIFICATIVE_TEMPLATE.documents.map((d) => ({
    code: rectPieceCode(d.id),
    category: CATEGORY_MAP[d.category] ?? 'A_TRIER',
    profils: [RECTIFICATIVE_TAG],
    requiredByDefault: d.obligation === 'obligatoire',
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: d.acceptedFormats,
    expectedYearOffset: 0,
    nom: loc(d.clientLabel),
    description: loc(d.reason),
    texteAide: loc(d.reminderMessage),
  }));
}
