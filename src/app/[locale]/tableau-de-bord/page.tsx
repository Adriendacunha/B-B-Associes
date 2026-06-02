import { getTranslations, setRequestLocale } from 'next-intl/server';
import { demoDashboard } from '@/lib/demo/sample';

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-2xl font-bold text-brand">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');
  const d = demoDashboard();
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-brand">{t('title')}</h1>
        <p className="text-xs italic text-slate-400">{t('demoNote')}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={t('metrics.autonomy')} value={pct(d.autonomyRate)} />
        <Metric label={t('metrics.reliability')} value={pct(d.reliabilityRate)} />
        <Metric label={t('metrics.timeSaved')} value={`${Math.round(d.minutesSaved / 60)} h`} />
        <Metric label={t('metrics.complete')} value={`${d.completeCount}/${d.clients.length}`} />
      </div>

      {/* Tableau (≥ sm) avec défilement horizontal si l'écran est étroit. */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white sm:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">{t('clients')}</th>
              <th className="px-4 py-3">{t('manager')}</th>
              <th className="px-4 py-3">{t('completude')}</th>
              <th className="px-4 py-3">{t('nextReminder')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {d.clients.map((c) => (
              <tr key={c.clientCode}>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-slate-400">{c.clientCode}</span> {c.displayName}
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
                <td className="px-4 py-3 text-slate-600">
                  {c.nextReminderDays === null ? '—' : `J+${c.nextReminderDays}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cartes empilées (< sm) : plus lisibles que le tableau sur mobile. */}
      <ul className="space-y-3 sm:hidden">
        {d.clients.map((c) => (
          <li key={c.clientCode} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">{c.displayName}</span>
              <span className="font-mono text-xs text-slate-400">{c.clientCode}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {t('manager')} : {c.manager}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded bg-slate-100">
                <div className="h-full rounded bg-brand" style={{ width: `${Math.round(c.completude.ratio * 100)}%` }} />
              </div>
              <span className="text-xs font-medium text-slate-600">{c.completude.label}</span>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {t('nextReminder')} : {c.nextReminderDays === null ? '—' : `J+${c.nextReminderDays}`}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
