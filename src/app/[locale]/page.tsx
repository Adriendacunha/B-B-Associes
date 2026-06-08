import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tc = await getTranslations('campagne');

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold text-brand">{t('title')}</h1>
        <p className="max-w-2xl text-slate-600">{t('subtitle')}</p>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/profilage"
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand hover:shadow"
        >
          <h2 className="text-lg font-semibold text-brand">{tc('newCampaign')}</h2>
        </Link>
        <Link
          href="/espace"
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand hover:shadow"
        >
          <h2 className="text-lg font-semibold text-brand">{t('clientSpace')}</h2>
        </Link>
        <Link
          href="/tableau-de-bord"
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand hover:shadow"
        >
          <h2 className="text-lg font-semibold text-brand">{t('dashboard')}</h2>
        </Link>
      </div>
    </div>
  );
}
