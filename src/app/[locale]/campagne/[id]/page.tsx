import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { resolveLocalized, type AppLocale, type LocalizedText } from '@/lib/i18n/locales';
import { completude } from '@/lib/metrics/mvp';
import { CATEGORY_FOLDERS, ORDERED_CATEGORIES } from '@/lib/onedrive/paths';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  MANQUANT: 'bg-slate-100 text-slate-600',
  DEPOSE: 'bg-blue-100 text-blue-700',
  EN_VALIDATION: 'bg-amber-100 text-amber-800',
  CONFORME: 'bg-green-100 text-green-700',
  NON_CONFORME: 'bg-red-100 text-red-700',
};

export default async function CampagnePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const loc = locale as AppLocale;
  const t = await getTranslations('campagne');
  const tStatus = await getTranslations('espace');

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      client: { include: { gestionnaire: true } },
      checklistItems: { include: { pieceDefinition: true } },
    },
  });
  if (!campaign) notFound();

  const items = campaign.checklistItems;
  const requiredItems = items.filter((i) => i.required);
  const comp = completude({
    requiredTotal: requiredItems.length,
    conformes: requiredItems.filter((i) => i.status === 'CONFORME').length,
  });

  // Regroupement par sous-catégorie OneDrive (§5.2), dans l'ordre de l'arborescence.
  const byCategory = ORDERED_CATEGORIES.map((cat) => ({
    category: cat,
    label: CATEGORY_FOLDERS[cat],
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-brand">{t('title')}</h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
          <span>
            <span className="text-slate-400">{t('client')} :</span>{' '}
            <span className="font-mono text-xs text-slate-400">{campaign.client.clientCode}</span> {campaign.client.displayName}
          </span>
          <span>
            <span className="text-slate-400">{t('fiscalYear')} :</span> {campaign.fiscalYear}
          </span>
          <span>
            <span className="text-slate-400">{t('statusLabel')} :</span> {campaign.status}
          </span>
          {campaign.client.gestionnaire && (
            <span>
              <span className="text-slate-400">{t('manager')} :</span> {campaign.client.gestionnaire.name}
            </span>
          )}
        </div>
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

      <div className="space-y-5">
        {byCategory.map((group) => (
          <section key={group.category}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</h2>
            <ul className="space-y-2">
              {group.items.map((item) => (
                <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">
                          {resolveLocalized(item.pieceDefinition.nom as unknown as LocalizedText, loc)}
                        </span>
                        <span className="font-mono text-[10px] text-slate-300">{item.pieceCode}</span>
                        <span className="text-[10px] uppercase text-slate-400">
                          {item.required ? tStatus('required') : tStatus('optional')}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {resolveLocalized(item.pieceDefinition.description as unknown as LocalizedText, loc)}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLE[item.status]}`}>
                      {tStatus(`status.${item.status}`)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
