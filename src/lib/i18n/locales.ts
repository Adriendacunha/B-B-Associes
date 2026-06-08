// Langues supportées par l'interface client et les e-mails (§3 du brief).
// Le français est la langue par défaut.

export const LOCALES = ['fr', 'en', 'de'] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'fr';

/** Texte multilingue tel que stocké en base (champs JSON des PieceDefinition, etc.). */
export type LocalizedText = Record<AppLocale, string>;

export function isAppLocale(value: string): value is AppLocale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Résout un texte multilingue avec repli sur le français (§3 : FR par défaut).
 */
export function resolveLocalized(
  text: Partial<LocalizedText> | null | undefined,
  locale: AppLocale,
): string {
  if (!text) return '';
  return text[locale] ?? text[DEFAULT_LOCALE] ?? '';
}
