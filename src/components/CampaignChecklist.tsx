import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { resolveLocalized, type AppLocale, type LocalizedText } from '@/lib/i18n/locales';
import { completude } from '@/lib/metrics/mvp';
import { CATEGORY_FOLDERS, ORDERED_CATEGORIES } from '@/lib/onedrive/paths';
import { uploadDocument, renameDocument, bulkUpload } from '@/app/actions/document';
import { setClientDeclaration } from '@/app/actions/campaign';
import { formatAnomalies } from '@/lib/ai/anomalies';
import { UploadButton } from '@/components/UploadButton';
import { Dropzone } from '@/components/Dropzone';
import { sendInvitation, sendReminderNow } from '@/app/actions/email';
import { Link } from '@/i18n/routing';

const STATUS_STYLE: Record<string, string> = {
  MANQUANT: 'bg-slate-100 text-slate-600',
  DEPOSE: 'bg-blue-100 text-blue-700',
  EN_VALIDATION: 'bg-amber-100 text-amber-800',
  CONFORME: 'bg-green-100 text-green-700',
  NON_CONFORME: 'bg-red-100 text-red-700',
};

/**
 * Vue de la checklist d'une campagne, réutilisée par l'espace client (§4/§7) et
 * par la vue cabinet (§11). `showMeta` affiche l'en-tête de suivi (cabinet).
 */
export async function CampaignChecklist({
  campaignId,
  locale,
  showMeta,
}: {
  campaignId: string;
  locale: AppLocale;
  showMeta: boolean;
}) {
  const t = await getTranslations('campagne');
  const tStatus = await getTranslations('espace');
  const tUp = await getTranslations('upload');
  const tR = await getTranslations('relances');
  const tX = await getTranslations('export');

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      client: { include: { gestionnaire: true } },
      checklistItems: {
        include: {
          pieceDefinition: true,
          documents: { orderBy: { version: 'desc' }, take: 1, include: { aiVerdict: true } },
        },
      },
    },
  });
  if (!campaign) notFound();

  const items = campaign.checklistItems;
  const requiredItems = items.filter((i) => i.required);
  const comp = completude({
    requiredTotal: requiredItems.length,
    conformes: requiredItems.filter((i) => i.status === 'CONFORME').length,
  });

  // Compteurs relances (vue cabinet uniquement).
  const pendingCount = items.filter((i) => i.status === 'MANQUANT' || i.status === 'NON_CONFORME').length;
  const isComplete = requiredItems.length > 0 && requiredItems.every((i) => i.status === 'CONFORME');
  const [invitationCount, reminderCount] = showMeta
    ? await Promise.all([
        prisma.emailMessage.count({ where: { campaignId, templateKey: 'INVITATION' } }),
        prisma.emailMessage.count({ where: { campaignId, templateKey: { in: ['RELANCE_1', 'RELANCE_2', 'RELANCE_3'] } } }),
      ])
    : [0, 0];

  const byCategory = ORDERED_CATEGORIES.map((cat) => ({
    category: cat,
    label: CATEGORY_FOLDERS[cat],
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {showMeta && (
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
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
          {/* Déclaration de complétude du client (UX §7) */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">{t('declarationLabel')} :</span>
            <span
              className={`badge ${
                campaign.clientDeclaration === 'OUI'
                  ? 'bg-green-100 text-green-700'
                  : campaign.clientDeclaration === 'NON_CONCERNE'
                    ? 'bg-slate-200 text-slate-700'
                    : campaign.clientDeclaration === 'NON'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-500'
              }`}
            >
              {campaign.clientDeclaration === 'OUI'
                ? t('declOui')
                : campaign.clientDeclaration === 'NON_CONCERNE'
                  ? t('declNonConcerne')
                  : campaign.clientDeclaration === 'NON'
                    ? t('declNon')
                    : t('declNone')}
            </span>
          </div>
        </header>
      )}

      <div className="card">
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">{t('completude')}</span>
          <span className="font-semibold text-brand">{comp.label}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand transition-all duration-500"
            style={{ width: `${Math.round(comp.ratio * 100)}%` }}
          />
        </div>
      </div>

      {/* Dépôt groupé : tous les documents d'un coup, triés automatiquement par l'IA (§7). */}
      <div className="rounded-xl border border-dashed border-brand/40 bg-brand/5 p-5">
        <h2 className="text-sm font-semibold text-brand">{tUp('bulkTitle')}</h2>
        <p className="mb-3 text-xs text-slate-600">{tUp('bulkHint')}</p>
        <form action={bulkUpload} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="locale" value={locale} />
          <input
            type="file"
            name="file"
            multiple
            required
            className="text-xs file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-light"
          />
          <UploadButton idle={tUp('bulkSend')} pending={tUp('uploading')} className="btn btn-primary btn-sm" />
        </form>
      </div>

      {showMeta && (
        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">{tR('title')}</h2>
            <Link href="/emails" className="text-xs font-medium text-brand hover:underline">
              {tR('outbox')} →
            </Link>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            {pendingCount} {tR('pending')} · {invitationCount} {tR('invitationSent')} · {reminderCount} {tR('remindersSent')}
          </p>
          {isComplete ? (
            <p className="text-xs font-medium text-green-700">{tR('complete')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <form action={sendInvitation}>
                <input type="hidden" name="campaignId" value={campaignId} />
                <input type="hidden" name="locale" value={locale} />
                <button type="submit" className="btn btn-secondary btn-sm">
                  {tR('sendInvitation')}
                </button>
              </form>
              <form action={sendReminderNow}>
                <input type="hidden" name="campaignId" value={campaignId} />
                <input type="hidden" name="locale" value={locale} />
                <button type="submit" disabled={pendingCount === 0} className="btn btn-primary btn-sm">
                  {tR('remindNow')}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {showMeta && (
        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">{tX('title')}</h2>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/export/dossier/${campaignId}?locale=${locale}`} className="btn btn-secondary btn-sm">
              {tX('zip')}
            </a>
            <a href={`/api/export/dossier/${campaignId}?format=csv&locale=${locale}`} className="btn btn-secondary btn-sm">
              {tX('csv')}
            </a>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {byCategory.map((group) => (
          <section key={group.category}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</h2>
            <ul className="space-y-2">
              {group.items.map((item) => {
                const latest = item.documents[0];
                const verdict = latest?.aiVerdict;
                // On autorise aussi le remplacement d'une pièce encore en validation
                // (ex. signalée « non conforme » par l'IA) sans attendre le cabinet.
                const canUpload =
                  item.status === 'MANQUANT' || item.status === 'NON_CONFORME' || item.status === 'EN_VALIDATION';
                return (
                  <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">
                            {resolveLocalized(item.pieceDefinition.nom as unknown as LocalizedText, locale)}
                          </span>
                          <span className="font-mono text-[10px] text-slate-300">{item.pieceCode}</span>
                          <span className="text-[10px] uppercase tracking-wide text-slate-400">
                            {item.required ? tStatus('required') : tStatus('optional')}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {resolveLocalized(item.pieceDefinition.description as unknown as LocalizedText, locale)}
                        </p>
                      </div>
                      <span className={`badge shrink-0 ${STATUS_STYLE[item.status]}`}>
                        {tStatus(`status.${item.status}`)}
                      </span>
                    </div>

                    {item.status === 'EN_VALIDATION' && verdict && (
                      <p className="mt-2 text-xs text-amber-700">
                        {tUp('aiProposes')} :{' '}
                        <span className="font-medium">{verdict.conforme ? tUp('conforme') : tUp('nonConforme')}</span>
                        {Array.isArray(verdict.anomalies) && (verdict.anomalies as string[]).length > 0 && (
                          <span className="text-slate-500"> · {formatAnomalies(verdict.anomalies as string[], locale)}</span>
                        )}
                      </p>
                    )}

                    {/* Motif de refus expliqué au client (§7.3). */}
                    {item.status === 'NON_CONFORME' && verdict && (
                      <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs">
                        <p className="font-semibold text-red-700">{tUp('rejectReason')}</p>
                        <p className="text-red-700">
                          {resolveLocalized(verdict.messageClient as unknown as LocalizedText, locale)}
                        </p>
                        {Array.isArray(verdict.anomalies) && (verdict.anomalies as string[]).length > 0 && (
                          <p className="mt-1 text-red-600">• {formatAnomalies(verdict.anomalies as string[], locale)}</p>
                        )}
                        <p className="mt-1 text-slate-600">
                          <span className="font-medium">{tUp('help')} :</span>{' '}
                          {resolveLocalized(item.pieceDefinition.texteAide as unknown as LocalizedText, locale)}
                        </p>
                      </div>
                    )}

                    {item.status === 'CONFORME' && latest?.finalFilename && (
                      <p className="mt-2 break-all text-xs text-green-700">
                        {tUp('depositedAs')} <span className="font-mono">{latest.finalFilename}</span>
                      </p>
                    )}

                    {/* Consultation du document, quel que soit le statut (§15.1). */}
                    {latest && (
                      <a
                        href={`/api/document/${latest.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs text-brand underline hover:text-brand-light"
                      >
                        📄 {tUp('view')}
                      </a>
                    )}

                    {/* Renommage manuel d'une pièce en cours de validation. */}
                    {latest && item.status === 'EN_VALIDATION' && (
                      <form action={renameDocument} className="mt-1 flex flex-wrap items-center gap-2">
                        <input type="hidden" name="documentId" value={latest.id} />
                        <input type="hidden" name="locale" value={locale} />
                        <input
                          type="text"
                          name="newName"
                          defaultValue={latest.originalFilename}
                          placeholder={tUp('renamePlaceholder')}
                          className="select max-w-[14rem] text-xs"
                        />
                        <button type="submit" className="btn btn-secondary btn-sm">
                          {tUp('rename')}
                        </button>
                      </form>
                    )}

                    {canUpload && (
                      <Dropzone
                        action={uploadDocument}
                        fields={{ checklistItemId: item.id, locale }}
                        prompt={tUp('dropzone')}
                        multiHint={tUp('multiHint')}
                        idle={item.status === 'EN_VALIDATION' ? tUp('replace') : tUp('send')}
                        pending={tUp('uploading')}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* Déclaration de complétude — vue client (UX §7). */}
      {!showMeta && (
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-900">{tStatus('declQuestion')}</h2>
          <p className="mt-1 text-xs text-slate-500">{tStatus('declHint')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(['NON', 'OUI', 'NON_CONCERNE'] as const).map((value) => {
              const selected = campaign.clientDeclaration === value;
              const label =
                value === 'NON' ? tStatus('declNon') : value === 'OUI' ? tStatus('declOui') : tStatus('declNonConcerne');
              return (
                <form action={setClientDeclaration} key={value}>
                  <input type="hidden" name="campaignId" value={campaignId} />
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="declaration" value={value} />
                  <button type="submit" className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-secondary'}`}>
                    {label}
                  </button>
                </form>
              );
            })}
          </div>
          {campaign.clientDeclaration === 'OUI' && (
            <p className="mt-3 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">
              {tStatus('declDoneOui')}
            </p>
          )}
          {campaign.clientDeclaration === 'NON_CONCERNE' && (
            <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {tStatus('declDoneNonConcerne')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
