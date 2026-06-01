import { getTranslations, setRequestLocale } from 'next-intl/server';
import { demoChecklist, demoCompletude, type DemoStatus } from '@/lib/demo/sample';
import { resolveLocalized, type AppLocale } from '@/lib/i18n/locales';

const STATUS_STYLE: Record<DemoStatus, string> = {
  MANQUANT: 'bg-slate-100 text-slate-600',
  DEPOSE: 'bg-blue-100 text-blue-700',
  EN_VALIDATION: 'bg-amber-100 text-amber-800',
  CONFORME: 'bg-green-100 text-green-700',
  NON_CONFORME: 'bg-red-100 text-red-700',
};

export default async function EspacePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('espace');
  const items = demoChecklist();
  const comp = demoCompletude();
  const loc = locale as AppLocale;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-brand">{t('title')}</h1>
        <p className="text-slate-600">{t('intro')}</p>
        <p className="text-xs italic text-slate-400">{t('demoNote')}</p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium">{t('completude')}</span>
          <span className="font-semibold text-brand">{comp.label}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
          <div className="h-full rounded bg-brand" style={{ width: `${Math.round(comp.ratio * 100)}%` }} />
        </div>
      </div>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.code} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-800">{resolveLocalized(item.nom, loc)}</h2>
                  <span className="text-xs text-slate-400">
                    {item.required ? t('required') : t('optional')}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{resolveLocalized(item.description, loc)}</p>
                <p className="mt-1 text-xs text-slate-400">{resolveLocalized(item.texteAide, loc)}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLE[item.status]}`}>
                  {t(`status.${item.status}`)}
                </span>
                {item.status !== 'CONFORME' && (
                  <button className="rounded bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand-light">
                    {t('upload')}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
