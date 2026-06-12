import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Gauge, ShieldCheck, Clock, FolderCheck, type LucideIcon } from 'lucide-react';
import { getDashboardData } from '@/lib/dashboard/data';
import { processDueReminders } from '@/app/actions/email';
import { requireStaff } from '@/lib/auth/session';
import { Link } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

function Metric({ label, value, Icon }: { label: string; value: string; Icon: LucideIcon }) {
  return (
    <div className="card flex items-center gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="mt-0.5 text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale); // tableau de bord cabinet (§11)
  const t = await getTranslations('dashboard');
  const tR = await getTranslations('relances');
  const d = await getDashboardData();
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  // Badge de déclaration client (null = pas de réponse → tiret).
  const declMeta = (decl: (typeof d.clients)[number]['clientDeclaration']) => {
    switch (decl) {
      case 'OUI':
        return { cls: 'bg-green-100 text-green-700', label: t('declOui') };
      case 'NON_CONCERNE':
        return { cls: 'bg-slate-200 text-slate-600', label: t('declNonConcerne') };
      case 'NON':
        return { cls: 'bg-amber-100 text-amber-800', label: t('declNon') };
      default:
        return null;
    }
  };
  const readyCount = d.clients.filter((c) => c.clientDeclaration === 'OUI').length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
        <div className="flex items-center gap-3">
          <Link href="/emails" className="text-xs font-medium text-brand hover:underline">
            {tR('outbox')} →
          </Link>
          <form action={processDueReminders}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="btn btn-primary btn-sm">
              {tR('processDue')}
            </button>
          </form>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={t('metrics.autonomy')} value={pct(d.autonomyRate)} Icon={Gauge} />
        <Metric label={t('metrics.reliability')} value={pct(d.overallReliability)} Icon={ShieldCheck} />
        <Metric label={t('metrics.timeSaved')} value={`${Math.round(d.minutesSaved / 60)} h`} Icon={Clock} />
        <Metric label={t('metrics.complete')} value={`${d.completeCount}/${d.totalCampaigns}`} Icon={FolderCheck} />
      </div>

      {/* Dossiers déclarés terminés par le client → à traiter (UX §7). */}
      {readyCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <FolderCheck className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>{t('declReadyCount', { count: readyCount })}</span>
        </div>
      )}

      {/* Tableau (≥ sm) avec défilement horizontal si l'écran est étroit. */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white sm:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">{t('clients')}</th>
              <th className="px-4 py-3">{t('manager')}</th>
              <th className="px-4 py-3">{t('completude')}</th>
              <th className="px-4 py-3">{t('declaration')}</th>
              <th className="px-4 py-3">{t('nextReminder')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {d.clients.map((c) => {
              const decl = declMeta(c.clientDeclaration);
              return (
                <tr key={c.clientCode} className={c.clientDeclaration === 'OUI' ? 'bg-green-50/60' : undefined}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-400">{c.clientCode}</span> {c.displayName}
                    <span className="ml-2 text-[10px] uppercase text-slate-400">{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.manager}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded bg-slate-100">
                        <div className="h-full rounded bg-brand" style={{ width: `${Math.round(c.completude.ratio * 100)}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{c.completude.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {decl ? <span className={`badge ${decl.cls}`}>{decl.label}</span> : <span className="text-xs text-slate-400">{t('declNone')}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.nextReminderDays === null ? '—' : `J+${c.nextReminderDays}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cartes empilées (< sm). */}
      <ul className="space-y-3 sm:hidden">
        {d.clients.map((c) => (
          <li key={c.clientCode} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">{c.displayName}</span>
              <span className="font-mono text-xs text-slate-400">{c.clientCode}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {t('manager')} : {c.manager} · {c.status}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded bg-slate-100">
                <div className="h-full rounded bg-brand" style={{ width: `${Math.round(c.completude.ratio * 100)}%` }} />
              </div>
              <span className="text-xs font-medium text-slate-600">{c.completude.label}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>
                {t('nextReminder')} : {c.nextReminderDays === null ? '—' : `J+${c.nextReminderDays}`}
              </span>
              {(() => {
                const decl = declMeta(c.clientDeclaration);
                return decl ? <span className={`badge ${decl.cls}`}>{decl.label}</span> : null;
              })()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
