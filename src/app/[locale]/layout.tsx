import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, Link } from '@/i18n/routing';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Logo } from '@/components/Logo';
import { MainNav, type NavItem } from '@/components/MainNav';
import { MobileNav } from '@/components/MobileNav';
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

  const tHome = await getTranslations('home');
  const tCampagne = await getTranslations('campagne');
  const tClients = await getTranslations('clients');
  let navItems: NavItem[] = [];
  if (principal?.type === 'STAFF') {
    navItems = [
      { href: '/tableau-de-bord', label: tHome('dashboard') },
      { href: '/clients', label: tClients('title') },
      { href: '/profilage', label: tCampagne('newCampaign') },
      { href: '/validation', label: tHome('validation') },
      { href: '/baremes', label: tHome('baremes') },
      { href: '/analytics', label: tHome('aiUsage') },
    ];
  } else if (principal?.type === 'CLIENT') {
    navItems = [{ href: '/espace', label: tHome('clientSpace') }];
  }

  return (
    <html lang={locale}>
      <body className="min-h-screen">
        <NextIntlClientProvider>
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="relative mx-auto flex max-w-6xl items-center gap-x-6 px-4 py-2.5">
              <Link href="/" className="flex items-center" aria-label={t('appName')}>
                <Logo className="h-8 w-auto" />
              </Link>
              <div className="hidden md:block">
                <MainNav items={navItems} />
              </div>
              <div className="ml-auto flex items-center gap-3">
                {principalName && (
                  <>
                    <span className="hidden text-xs text-slate-500 lg:inline">
                      {tAuth('loggedInAs')} <span className="font-medium text-slate-700">{principalName}</span>
                    </span>
                    <form action={logout}>
                      <input type="hidden" name="locale" value={locale} />
                      <button type="submit" className="btn btn-secondary btn-sm">
                        {tAuth('signOut')}
                      </button>
                    </form>
                  </>
                )}
                <LanguageSwitcher />
                <MobileNav items={navItems} />
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-slate-400">
            {t('cabinet')} — Route des Acacias 24, 1227 Carouge · Données hébergées en Suisse (nLPD/RGPD).
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
