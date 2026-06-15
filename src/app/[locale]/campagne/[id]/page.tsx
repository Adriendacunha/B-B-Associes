import { setRequestLocale } from 'next-intl/server';
import { CampaignChecklist } from '@/components/CampaignChecklist';
import { requireStaff } from '@/lib/auth/session';
import type { AppLocale } from '@/lib/i18n/locales';

export const dynamic = 'force-dynamic';

export default async function CampagnePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { locale, id } = await params;
  const { mode } = await searchParams;
  setRequestLocale(locale);
  await requireStaff(locale); // vue cabinet — réservée aux collaborateurs (§2/§8)

  return <CampaignChecklist campaignId={id} locale={locale as AppLocale} showMeta advanced={mode === 'avance'} />;
}
