import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { staffLogin } from '@/app/actions/auth';
import { getCurrentPrincipal } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  const principal = await getCurrentPrincipal();
  if (principal?.type === 'STAFF') redirect(`/${locale}/tableau-de-bord`);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-2xl font-bold text-brand">{t('staffTitle')}</h1>
      {error && (
        <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error === 'locked' ? t('errorLocked') : t('errorInvalid')}
        </p>
      )}
      <form action={staffLogin} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
        <input type="hidden" name="locale" value={locale} />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">{t('email')}</span>
          <input type="email" name="email" required autoComplete="username" className="select" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">{t('password')}</span>
          <input type="password" name="password" required autoComplete="current-password" className="select" />
        </label>
        <button type="submit" className="w-full rounded bg-brand px-4 py-2 font-medium text-white hover:bg-brand-light">
          {t('signIn')}
        </button>
      </form>
    </div>
  );
}
