import { getTranslations, setRequestLocale } from 'next-intl/server';
import { activateClient } from '@/app/actions/auth';

export const dynamic = 'force-dynamic';

export default async function ActivationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { locale } = await params;
  const { token, error } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-2xl font-bold text-brand">{t('activateTitle')}</h1>
      {error && (
        <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error === 'weak' ? t('errorWeak') : t('errorToken')}
        </p>
      )}
      <form action={activateClient} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="token" value={token ?? ''} />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">{t('newPassword')}</span>
          <input type="password" name="password" required minLength={8} autoComplete="new-password" className="select" />
        </label>
        <button type="submit" className="w-full rounded bg-brand px-4 py-2 font-medium text-white hover:bg-brand-light">
          {t('activate')}
        </button>
      </form>
    </div>
  );
}
