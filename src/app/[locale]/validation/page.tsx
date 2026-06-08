import { getTranslations, setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { reviewDocument } from '@/app/actions/document';
import { requireStaff } from '@/lib/auth/session';
import { resolveLocalized, type AppLocale, type LocalizedText } from '@/lib/i18n/locales';

export const dynamic = 'force-dynamic';

export default async function ValidationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale); // file de validation — collaborateurs (§15.1)
  const loc = locale as AppLocale;
  const t = await getTranslations('validation');

  const docs = await prisma.document.findMany({
    where: { status: 'EN_VALIDATION' },
    orderBy: { uploadedAt: 'asc' },
    include: {
      aiVerdict: true,
      checklistItem: { include: { pieceDefinition: true, campaign: { include: { client: true } } } },
    },
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-brand">{t('title')}</h1>
        <p className="text-sm text-slate-600">{t('subtitle')}</p>
      </header>

      {docs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {t('empty')}
        </p>
      ) : (
        <ul className="space-y-4">
          {docs.map((doc) => {
            const item = doc.checklistItem;
            const client = item.campaign.client;
            const v = doc.aiVerdict!;
            return (
              <li key={doc.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                  <span>
                    <span className="text-slate-400">{t('client')} :</span>{' '}
                    <span className="font-mono text-xs text-slate-400">{client.clientCode}</span> {client.displayName}
                  </span>
                  <span>
                    <span className="text-slate-400">{t('piece')} :</span>{' '}
                    {resolveLocalized(item.pieceDefinition.nom as unknown as LocalizedText, loc)}{' '}
                    <span className="font-mono text-[10px] text-slate-300">{item.pieceCode}</span>
                  </span>
                  <span className="text-slate-400">{doc.originalFilename}</span>
                </div>

                <div className="mt-3 rounded bg-slate-50 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-semibold text-slate-700">{t('ai')} :</span>
                    <span className={v.conforme ? 'font-medium text-green-700' : 'font-medium text-red-700'}>
                      {v.conforme ? '✓ conforme' : '✗ non conforme'}
                    </span>
                    {v.anneeDetectee != null && <span className="text-slate-500">année : {v.anneeDetectee}</span>}
                    {v.scoreLisibilite != null && (
                      <span className="text-slate-500">
                        {t('readability')} : {Math.round(v.scoreLisibilite * 100)}%
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {t('model')} : {v.model}
                    </span>
                  </div>
                  {Array.isArray(v.anomalies) && (v.anomalies as string[]).length > 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      {t('anomalies')} : {(v.anomalies as string[]).join(', ')}
                    </p>
                  )}
                  <p className="mt-1 text-xs italic text-slate-500">
                    {resolveLocalized(v.messageClient as unknown as LocalizedText, loc)}
                  </p>
                </div>

                {/* Décision humaine (un seul formulaire, deux boutons) */}
                <form action={reviewDocument} className="mt-3 flex gap-2">
                  <input type="hidden" name="documentId" value={doc.id} />
                  <input type="hidden" name="locale" value={locale} />
                  <button
                    type="submit"
                    name="decision"
                    value="VALIDE"
                    className="rounded bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                  >
                    {t('validate')}
                  </button>
                  <button
                    type="submit"
                    name="decision"
                    value="REJETE"
                    className="rounded bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                  >
                    {t('reject')}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
