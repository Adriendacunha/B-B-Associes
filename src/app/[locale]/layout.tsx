import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, Link } from '@/i18n/routing';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { getCurrentPrincipal } from '@/lib/auth/session';
import { logout } from '@/app/actions/auth';
import '../globals.css';

export const metadata: Metadata = {
  title: 'B&B Associés — Espace de collecte',
  description: 'Espace client de collecte documentaire — fiduciaire B&B Associés, Carouge / Genève.',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('common');
  const tAuth = await getTranslations('auth');
  const principal = await getCurrentPrincipal();
  const principalName =
    principal?.type === 'STAFF' ? principal.user.name : principal?.type === 'CLIENT' ? principal.client.displayName : null;

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <Link href="/" className="font-semibold text-brand">
                {t('appName')}
              </Link>
              <div className="flex items-center gap-3">
                {principalName && (
                  <>
                    <span className="hidden text-xs text-slate-500 sm:inline">
                      {tAuth('loggedInAs')} {principalName}
                    </span>
                    <form action={logout}>
                      <input type="hidden" name="locale" value={locale} />
                      <button type="submit" className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                        {tAuth('signOut')}
                      </button>
                    </form>
                  </>
                )}
                <LanguageSwitcher />
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
          <footer className="mx-auto max-w-5xl px-4 py-8 text-xs text-slate-500">
            {t('cabinet')} — Route des Acacias 24, 1227 Carouge · Données hébergées en Suisse (nLPD/RGPD).
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
