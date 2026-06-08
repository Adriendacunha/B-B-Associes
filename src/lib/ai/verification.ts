// Vérification automatique des documents par IA (§7 du brief).
//
// Ce module définit LE CONTRAT entre l'app et l'API Claude :
//  - le schéma JSON structuré attendu en sortie (§7.2) ;
//  - la construction d'un prompt déterministe à partir de la définition de pièce.
//
// En MVP (humain dans la boucle, §15.1), ce verdict est PROPOSÉ : un collaborateur
// tranche avant dépôt OneDrive. La sortie est volontairement structurée pour
// alimenter les métriques de fiabilité par CodePiece (§15.3).

import { z } from 'zod';
import type { AppLocale, LocalizedText } from '@/lib/i18n/locales';

/** Schéma de la sortie JSON demandée au modèle (§7.2). */
export const AiVerdictSchema = z.object({
  conforme: z.boolean(),
  type_detecte: z.string().nullable(),
  annee_detectee: z.number().int().nullable(),
  score_lisibilite: z.number().min(0).max(1),
  // Codes d'anomalie normalisés (voir ANOMALY_CODES) + éventuel texte libre.
  anomalies: z.array(z.string()),
  // Message destiné au client, dans sa langue (§7.3).
  message_client: z.string(),
});

export type AiVerdict = z.infer<typeof AiVerdictSchema>;

/** Anomalies normalisées — réutilisées pour l'aide client et les métriques (§7.1/§15.3). */
export const ANOMALY_CODES = {
  MAUVAIS_TYPE: 'mauvais_type', // ne correspond pas à la pièce demandée
  MAUVAISE_ANNEE: 'mauvaise_annee', // année fiscale incorrecte
  ILLISIBLE: 'illisible', // flou, tronqué, pages manquantes
  MAUVAIS_FORMAT: 'mauvais_format', // format non exploitable
  TITULAIRE_INCOHERENT: 'titulaire_incoherent', // nom ne correspond pas au client
  SIGNATURE_MANQUANTE: 'signature_manquante', // signature requise absente
} as const;

export type AnomalyCode = (typeof ANOMALY_CODES)[keyof typeof ANOMALY_CODES];

/** Contexte de la pièce attendue, fourni au modèle pour cadrer l'analyse. */
export interface ExpectedPiece {
  code: string; // CodePiece
  nom: string; // libellé dans la langue cible
  description: string;
  expectedFiscalYear: number;
  clientDisplayName: string;
  acceptedFormats: string[];
  signatureRequired?: boolean;
}

const LOCALE_LABEL: Record<AppLocale, string> = {
  fr: 'français',
  en: 'anglais',
  de: 'allemand',
};

/**
 * Construit le prompt structuré d'analyse (§7.2). Le texte extrait/OCR du
 * document est passé séparément (variable `documentText`). Le modèle DOIT
 * répondre exclusivement par un objet JSON conforme à AiVerdictSchema.
 */
export function buildVerificationPrompt(
  piece: ExpectedPiece,
  documentText: string,
  clientLocale: AppLocale,
): string {
  const formats = piece.acceptedFormats.join(', ');
  return [
    `Tu es un assistant de contrôle documentaire pour une fiduciaire genevoise.`,
    `Tu analyses une pièce déposée par un client en vue de sa déclaration fiscale.`,
    ``,
    `PIÈCE ATTENDUE`,
    `- Code: ${piece.code}`,
    `- Libellé: ${piece.nom}`,
    `- Description: ${piece.description}`,
    `- Année fiscale attendue: ${piece.expectedFiscalYear}`,
    `- Titulaire attendu: ${piece.clientDisplayName}`,
    `- Formats acceptés: ${formats}`,
    piece.signatureRequired ? `- Une signature est requise sur ce document.` : ``,
    ``,
    `CRITÈRES DE CONFORMITÉ (§7.1)`,
    `1. Bon type de pièce (pas un document approchant).`,
    `2. Bonne année fiscale (= ${piece.expectedFiscalYear}).`,
    `3. Lisibilité: net, non tronqué, pages complètes, orientation correcte.`,
    `4. Cohérence du titulaire avec « ${piece.clientDisplayName} » quand détectable.`,
    piece.signatureRequired ? `5. Présence de la signature requise.` : ``,
    ``,
    `CONTENU EXTRAIT DU DOCUMENT (OCR/texte)`,
    `"""`,
    documentText.slice(0, 20000),
    `"""`,
    ``,
    `RÉPONDS UNIQUEMENT par un objet JSON valide, sans texte autour, au format:`,
    `{`,
    `  "conforme": boolean,`,
    `  "type_detecte": string | null,`,
    `  "annee_detectee": number | null,`,
    `  "score_lisibilite": number (0 à 1),`,
    `  "anomalies": string[] (codes parmi: ${Object.values(ANOMALY_CODES).join(', ')}),`,
    `  "message_client": string (en ${LOCALE_LABEL[clientLocale]}, ton formel, explique`,
    `     la raison d'un rejet et comment corriger; si conforme, message neutre de réception)`,
    `}`,
  ]
    .filter((line) => line !== ``)
    .join('\n');
}

/**
 * Parse et valide la réponse brute du modèle. Tolère un éventuel bloc ```json.
 * Lève une erreur si la sortie n'est pas conforme au schéma (sécurité §7.2).
 */
export function parseVerdict(raw: string): AiVerdict {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const json = JSON.parse(cleaned);
  return AiVerdictSchema.parse(json);
}

/**
 * Décide du traitement aval à partir du verdict ET du mode de validation de la
 * pièce croisé avec le niveau de service du client (§4.2/§15).
 *
 * En MVP : pièces en HUMAIN_REQUIS -> toujours `EN_VALIDATION` (humain tranche).
 * L'auto-validation n'est possible que si la pièce est AUTO_AUTORISE et le client AUTO.
 */
export function decideRouting(args: {
  verdict: AiVerdict;
  pieceMode: 'HUMAIN_REQUIS' | 'AUTO_AUTORISE';
  clientNiveau: 'EXPERT' | 'AUTO';
}): 'AUTO_VALIDE' | 'AUTO_REJETE' | 'EN_VALIDATION' {
  const autoEligible = args.pieceMode === 'AUTO_AUTORISE' && args.clientNiveau === 'AUTO';
  if (!autoEligible) return 'EN_VALIDATION';
  return args.verdict.conforme ? 'AUTO_VALIDE' : 'AUTO_REJETE';
}
