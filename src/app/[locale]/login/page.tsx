import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { staffLogin } from '@/app/actions/auth';
import { getCurrentPrincipal } from '@/lib/auth/session';
import { ValidatedInput } from '@/components/ValidatedInput';
import { Logo } from '@/components/Logo';

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
    <div className="mx-auto max-w-sm py-6">
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo className="mb-3 h-12 w-auto" />
        <h1 className="text-2xl font-bold text-slate-900">{t('staffTitle')}</h1>
      </div>
      {error && (
        <p className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error === 'locked' ? t('errorLocked') : t('errorInvalid')}
        </p>
      )}
      <form action={staffLogin} className="card space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">{t('email')}</span>
          <ValidatedInput type="email" name="email" required autoComplete="username" className="input" requiredMessage={t('fieldRequired')} typeMismatchMessage={t('emailInvalid')} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">{t('password')}</span>
          <ValidatedInput type="password" name="password" required autoComplete="current-password" className="input" requiredMessage={t('fieldRequired')} />
        </label>
        <button type="submit" className="btn btn-primary w-full">
          {t('signIn')}
        </button>
      </form>
    </div>
  );
}
