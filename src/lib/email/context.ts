// Helpers partagés pour la composition des e-mails de campagne (§6), réutilisés
// par les actions manuelles (app/actions/email) et le moteur automatique
// (lib/reminders/run).

import type { Locale } from '@prisma/client';
import { prisma } from '@/lib/db';
import { formatMissingPieces } from './compose';
import type { AppLocale, LocalizedText } from '@/lib/i18n/locales';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}

export function clientLink(locale: Locale): string {
  return `${APP_URL}/${locale.toLowerCase()}/espace`;
}

/** Lien d'activation de compte (première connexion d'un bêta-testeur, §8/§15.2). */
export function activationLink(locale: Locale, token: string): string {
  return `${APP_URL}/${locale.toLowerCase()}/activation?token=${token}`;
}

export function missingItems(
  items: { status: string; pieceDefinition: { nom: unknown } }[],
  locale: Locale,
): string {
  const mapped = items.map((i) => ({ status: i.status, nom: i.pieceDefinition.nom as unknown as LocalizedText }));
  return formatMissingPieces(mapped, locale.toLowerCase() as AppLocale);
}

export function loadCampaignContext(campaignId: string) {
  return prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      client: { include: { gestionnaire: true } },
      checklistItems: { include: { pieceDefinition: true } },
    },
  });
}
