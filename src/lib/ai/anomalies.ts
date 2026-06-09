// Libellés lisibles des anomalies de vérification (§7.1/§7.3), pour expliquer au
// client la raison d'un refus en langage clair (et non par codes techniques).

import { resolveLocalized, type AppLocale, type LocalizedText } from '@/lib/i18n/locales';
import { ANOMALY_CODES } from './verification';

export const ANOMALY_LABELS: Record<string, LocalizedText> = {
  [ANOMALY_CODES.MAUVAIS_TYPE]: {
    fr: 'Ne correspond pas à la pièce demandée',
    en: 'Does not match the requested document',
    de: 'Entspricht nicht dem angeforderten Dokument',
  },
  [ANOMALY_CODES.MAUVAISE_ANNEE]: {
    fr: 'Mauvaise année fiscale',
    en: 'Wrong tax year',
    de: 'Falsches Steuerjahr',
  },
  [ANOMALY_CODES.ILLISIBLE]: {
    fr: 'Document illisible (flou, tronqué ou incomplet)',
    en: 'Unreadable document (blurry, cropped or incomplete)',
    de: 'Unleserliches Dokument (unscharf, beschnitten oder unvollständig)',
  },
  [ANOMALY_CODES.MAUVAIS_FORMAT]: {
    fr: 'Format de fichier non exploitable',
    en: 'Unusable file format',
    de: 'Unbrauchbares Dateiformat',
  },
  [ANOMALY_CODES.TITULAIRE_INCOHERENT]: {
    fr: 'Le titulaire ne correspond pas au client',
    en: 'The holder does not match the client',
    de: 'Der Inhaber stimmt nicht mit dem Kunden überein',
  },
  [ANOMALY_CODES.SIGNATURE_MANQUANTE]: {
    fr: 'Signature requise manquante',
    en: 'Required signature missing',
    de: 'Erforderliche Unterschrift fehlt',
  },
};

/** Transforme une liste de codes d'anomalie en texte lisible dans la langue. */
export function formatAnomalies(codes: string[], locale: AppLocale): string {
  return codes
    .map((c) => {
      const label = ANOMALY_LABELS[c];
      return label ? resolveLocalized(label, locale) : c; // texte libre de Claude éventuel
    })
    .join(' · ');
}
