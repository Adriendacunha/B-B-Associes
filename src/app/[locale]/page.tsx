import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LayoutDashboard, Users, ClipboardList, CheckCircle2, FolderUp, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { getCurrentPrincipal } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

type Card = {
  href: string;
  title: string;
  desc: string;
  Icon: typeof Users;
};

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tc = await getTranslations('campagne');
  const tcl = await getTranslations('clients');
  const principal = await getCurrentPrincipal();

  const staffCards: Card[] = [
    { href: '/tableau-de-bord', title: t('dashboard'), desc: t('dashboardDesc'), Icon: LayoutDashboard },
    { href: '/clients', title: tcl('title'), desc: t('clientsDesc'), Icon: Users },
    { href: '/profilage', title: tc('newCampaign'), desc: t('newCampaignDesc'), Icon: ClipboardList },
    { href: '/validation', title: t('validation'), desc: t('validationDesc'), Icon: CheckCircle2 },
  ];
  const clientCards: Card[] = [
    { href: '/espace', title: t('clientSpace'), desc: t('clientSpaceDesc'), Icon: FolderUp },
  ];
  const cards =
    principal?.type === 'STAFF' ? staffCards : principal?.type === 'CLIENT' ? clientCards : [...staffCards, ...clientCards];

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <span className="badge bg-brand/10 text-brand">B&amp;B Associés</span>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{t('title')}</h1>
        <p className="max-w-2xl text-lg text-slate-600">{t('subtitle')}</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ href, title, desc, Icon }) => (
          <Link key={href} href={href} className="card group flex flex-col transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-white">
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 flex-1 text-sm text-slate-500">{desc}</p>
            <ArrowRight
              className="mt-4 h-5 w-5 text-brand transition group-hover:translate-x-1"
              strokeWidth={2}
            />
            <span className="sr-only">{title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
