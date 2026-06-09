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
    <div className="mx-auto max-w-sm py-6">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">
          B
        </span>
        <h1 className="text-2xl font-bold text-slate-900">{t('activateTitle')}</h1>
      </div>
      {error && (
        <p className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error === 'weak' ? t('errorWeak') : t('errorToken')}
        </p>
      )}
      <form action={activateClient} className="card space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="token" value={token ?? ''} />
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">{t('newPassword')}</span>
          <input type="password" name="password" required minLength={8} autoComplete="new-password" className="input" />
        </label>
        <button type="submit" className="btn btn-primary w-full">
          {t('activate')}
        </button>
      </form>
    </div>
  );
}
