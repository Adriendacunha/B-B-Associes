// Analyseur documentaire de DÉMONSTRATION (§7), utilisé quand aucune clé API
// Claude n'est configurée (et/ou pas d'OCR). Déterministe et explicable : il
// cherche l'année fiscale attendue et un mot-clé dérivé du code de pièce dans le
// nom de fichier / le texte. Le vrai pipeline (OCR + API Claude) est dans
// `ai/client.ts` ; ce module garantit que le flux « humain dans la boucle » est
// démontrable et testable sans secret externe.

import type { LocalizedText } from '@/lib/i18n/locales';
import { ANOMALY_CODES } from './verification';

export interface StubInput {
  pieceCode: string;
  expectedFiscalYear: number;
  filename: string;
  text?: string;
}

export interface StubVerdict {
  conforme: boolean;
  type_detecte: string | null;
  annee_detectee: number | null;
  score_lisibilite: number;
  anomalies: string[];
  message_client: LocalizedText;
}

const ANOMALY_MSG: Record<string, LocalizedText> = {
  [ANOMALY_CODES.MAUVAISE_ANNEE]: {
    fr: "l'année du document ne correspond pas à l'année fiscale demandée",
    en: 'the document year does not match the requested tax year',
    de: 'das Dokumentjahr stimmt nicht mit dem verlangten Steuerjahr überein',
  },
  [ANOMALY_CODES.MAUVAIS_TYPE]: {
    fr: 'le document ne semble pas correspondre à la pièce demandée',
    en: 'the document does not appear to match the requested item',
    de: 'das Dokument scheint nicht zum verlangten Posten zu passen',
  },
};

/** Détecte une année 20xx dans une chaîne (la première rencontrée). */
export function detectYear(haystack: string): number | null {
  // Lookarounds sur les chiffres : tolère séparateurs « _ », « - », espaces…
  const m = haystack.match(/(?<!\d)(20\d{2})(?!\d)/);
  return m ? Number(m[1]) : null;
}

/** Tokens significatifs (≥ 4 lettres) dérivés du code de pièce. */
export function codeKeywords(code: string): string[] {
  return code
    .toLowerCase()
    .split(/[-_]/)
    .filter((t) => t.length >= 4);
}

function composeMessage(anomalies: string[]): LocalizedText {
  if (anomalies.length === 0) {
    return {
      fr: 'Document reçu et jugé conforme par l’analyse automatique (à confirmer par un collaborateur).',
      en: 'Document received and considered compliant by automatic analysis (to be confirmed by a staff member).',
      de: 'Dokument erhalten und durch die automatische Analyse als konform eingestuft (von einem Mitarbeiter zu bestätigen).',
    };
  }
  const reasons = (loc: keyof LocalizedText) => anomalies.map((a) => ANOMALY_MSG[a]?.[loc]).filter(Boolean).join(' ; ');
  return {
    fr: `Document non validé : ${reasons('fr')}. Merci de corriger et redéposer.`,
    en: `Document not validated: ${reasons('en')}. Please correct and re-upload.`,
    de: `Dokument nicht validiert: ${reasons('de')}. Bitte korrigieren und erneut hochladen.`,
  };
}

export function stubVerdict(input: StubInput): StubVerdict {
  const hay = `${input.filename} ${input.text ?? ''}`.toLowerCase();
  const annee = detectYear(hay);
  const keywords = codeKeywords(input.pieceCode);

  // Type : si aucun mot-clé exploitable, on ne peut pas l'infirmer (typeOk = vrai).
  const typeOk = keywords.length === 0 ? true : keywords.some((k) => hay.includes(k));
  const anneeOk = annee !== null && annee === input.expectedFiscalYear;

  const anomalies: string[] = [];
  if (!anneeOk) anomalies.push(ANOMALY_CODES.MAUVAISE_ANNEE);
  if (!typeOk) anomalies.push(ANOMALY_CODES.MAUVAIS_TYPE);

  return {
    conforme: anomalies.length === 0,
    type_detecte: typeOk ? input.pieceCode : null,
    annee_detectee: annee,
    score_lisibilite: 0.9, // l'OCR réel renseignera ce score ; stub = lisible
    anomalies,
    message_client: composeMessage(anomalies),
  };
}
