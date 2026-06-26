import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { resolveLocalized, type AppLocale, type LocalizedText } from '@/lib/i18n/locales';
import { completude } from '@/lib/metrics/mvp';
import { CATEGORY_FOLDERS, ORDERED_CATEGORIES } from '@/lib/onedrive/paths';
import { uploadDocument, renameDocument, bulkUpload } from '@/app/actions/document';
import { setClientDeclaration, setItemConcern } from '@/app/actions/campaign';
import { setItemRequired, deleteItem, updateItemDetails, addItemFromCatalogue } from '@/app/actions/checklist';
import { formatAnomalies } from '@/lib/ai/anomalies';
import { intakeSummary } from '@/lib/questionnaire/intake';
import { baseUrl } from '@/lib/url';
import { RECTIFICATIVE_TEMPLATE } from '@/data/templates/declaration-rectificative';
import { Dropzone } from '@/components/Dropzone';
import { CopyLink } from '@/components/CopyLink';
import { sendInvitation, sendReminderNow } from '@/app/actions/email';
import { Link } from '@/i18n/routing';

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  NON_COMMENCE: 'Brouillon',
  EN_COURS: 'En préparation',
  EN_ATTENTE_CLIENT: 'Envoyée — en attente du client',
  A_VALIDER: 'À contrôler',
  COMPLET: 'Prête à traiter',
  SUSPENDU: 'Suspendue',
};

const STATUS_STYLE: Record<string, string> = {
  MANQUANT: 'bg-slate-100 text-slate-600',
  DEPOSE: 'bg-blue-100 text-blue-700',
  EN_VALIDATION: 'bg-amber-100 text-amber-800',
  CONFORME: 'bg-green-100 text-green-700',
  NON_CONFORME: 'bg-red-100 text-red-700',
  NON_CONCERNE: 'bg-slate-200 text-slate-500',
};

// Badge de niveau d'exigence (§4.2) — couleur + libellé tri-langue.
const REQ_STYLE: Record<string, string> = {
  OBLIGATOIRE: 'text-rose-600',
  SI_CONCERNE: 'text-amber-700',
  OPTIONNEL: 'text-slate-400',
};
const REQ_LABEL: Record<string, Record<AppLocale, string>> = {
  OBLIGATOIRE: { fr: 'Obligatoire', en: 'Required', de: 'Erforderlich' },
  SI_CONCERNE: { fr: 'Si concerné', en: 'If applicable', de: 'Falls betroffen' },
  OPTIONNEL: { fr: 'Optionnel', en: 'Optional', de: 'Optional' },
};

/**
 * Vue de la checklist d'une campagne, réutilisée par l'espace client (§4/§7) et
 * par la vue cabinet (§11). `showMeta` affiche l'en-tête de suivi (cabinet).
 */
export async function CampaignChecklist({
  campaignId,
  locale,
  showMeta,
  advanced = false,
}: {
  campaignId: string;
  locale: AppLocale;
  showMeta: boolean;
  /** Mode avancé (cabinet) : active l'édition de la checklist (écran 3). */
  advanced?: boolean;
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

  // Titre cohérent avec l'aperçu / l'espace client : « {modèle} {année} »
  // (ex. « Déclaration d'impôt 2025 »), sinon titre générique.
  const template = campaign.templateId
    ? await prisma.campaignTemplate.findUnique({ where: { key: campaign.templateId }, select: { name: true } })
    : null;
  const campaignTitle = template ? `${template.name} ${campaign.fiscalYear}` : t('title');

  const items = campaign.checklistItems;
  const requiredItems = items.filter((i) => i.required);
  // Une pièce « non concernée » est résolue (au même titre que validée).
  const isResolved = (s: string) => s === 'CONFORME' || s === 'NON_CONCERNE';
  const comp = completude({
    requiredTotal: requiredItems.length,
    conformes: requiredItems.filter((i) => isResolved(i.status)).length,
  });

  // Synthèse du dossier (vue cabinet) — statuts réels des documents (§ rectificative).
  const synthese = {
    recus: items.filter((i) => i.status === 'DEPOSE' || i.status === 'EN_VALIDATION').length,
    manquants: items.filter((i) => i.status === 'MANQUANT').length,
    aCorriger: items.filter((i) => i.status === 'NON_CONFORME').length,
    valides: items.filter((i) => i.status === 'CONFORME').length,
    nonConcerne: items.filter((i) => i.status === 'NON_CONCERNE').length,
  };
  const isRectificative = campaign.templateId !== null;

  // Lien à transmettre au client pour qu'il complète sa campagne.
  const APP_URL = showMeta ? await baseUrl() : process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const clientLocale = campaign.client.locale.toLowerCase();
  const clientActivated = Boolean(campaign.client.passwordHash);
  const clientLink = clientActivated
    ? `${APP_URL}/${clientLocale}/espace`
    : campaign.client.activationToken
      ? `${APP_URL}/${clientLocale}/activation?token=${campaign.client.activationToken}`
      : null;

  // Informations fournies par le client (intake) — vue cabinet, lecture seule.
  const intakeRows =
    showMeta && campaign.templateId === RECTIFICATIVE_TEMPLATE.id
      ? intakeSummary(RECTIFICATIVE_TEMPLATE, ((campaign.profile as { answers?: Record<string, unknown> } | null)?.answers ?? {}) as never)
      : [];

  // Compteurs relances (vue cabinet uniquement).
  const pendingCount = items.filter((i) => i.status === 'MANQUANT' || i.status === 'NON_CONFORME').length;
  const isComplete = requiredItems.length > 0 && requiredItems.every((i) => isResolved(i.status));
  const [invitationCount, reminderCount] = showMeta
    ? await Promise.all([
        prisma.emailMessage.count({ where: { campaignId, templateKey: 'INVITATION' } }),
        prisma.emailMessage.count({ where: { campaignId, templateKey: { in: ['RELANCE_1', 'RELANCE_2', 'RELANCE_3'] } } }),
      ])
    : [0, 0];

  const byCategory = ORDERED_CATEGORIES.map((cat) => {
    const catItems = items.filter((i) => i.category === cat);
    const resolved = catItems.filter((i) => isResolved(i.status)).length;
    return {
      category: cat,
      label: CATEGORY_FOLDERS[cat],
      items: catItems,
      resolved,
      total: catItems.length,
      ratio: catItems.length > 0 ? resolved / catItems.length : 0,
    };
  }).filter((g) => g.items.length > 0);

  // Catalogue disponible pour « ajouter une pièce » (mode avancé cabinet).
  const presentDefIds = new Set(items.map((i) => i.pieceDefinitionId));
  const availablePieces =
    showMeta && advanced
      ? (await prisma.pieceDefinition.findMany({ where: { active: true }, orderBy: { code: 'asc' } }))
          .filter((d) => !presentDefIds.has(d.id))
          .map((d) => ({ id: d.id, code: d.code, nom: resolveLocalized(d.nom as unknown as LocalizedText, locale) }))
      : [];

  const fmtDate = (d: Date | null) =>
    d ? `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}` : '';
  const dateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

  return (
    <div className="space-y-6">
      {showMeta && (
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">{campaignTitle}</h1>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
            <span>
              <span className="text-slate-400">{t('client')} :</span>{' '}
              <span className="font-mono text-xs text-slate-400">{campaign.client.clientCode}</span> {campaign.client.displayName}
            </span>
            <span>
              <span className="text-slate-400">{t('fiscalYear')} :</span> {campaign.fiscalYear}
            </span>
            <span>
              <span className="text-slate-400">{t('statusLabel')} :</span>{' '}
              <span className="font-medium text-slate-700">
                {isComplete ? 'Prête à traiter' : (CAMPAIGN_STATUS_LABEL[campaign.status] ?? campaign.status)}
              </span>
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

          {/* Barre d'outils : personnalisation (écran 3) + prévisualisation (écran 4) */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
              <Link
                href={`/campagne/${campaignId}`}
                className={`rounded-md px-2.5 py-1 font-medium ${!advanced ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Mode simple
              </Link>
              <Link
                href={`/campagne/${campaignId}?mode=avance`}
                className={`rounded-md px-2.5 py-1 font-medium ${advanced ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Mode avancé
              </Link>
            </div>
            <Link href={`/campagne/${campaignId}/apercu`} className="btn btn-secondary btn-sm">
              Prévisualiser (côté client)
            </Link>
          </div>
          <p className="text-xs text-slate-400">
            {advanced
              ? 'Mode avancé : ajoutez/retirez des pièces, basculez obligatoire/optionnel, ajoutez notes et dates limites.'
              : 'Mode simple : consultez le dossier. Passez en mode avancé pour personnaliser la checklist.'}
          </p>
        </header>
      )}

      {/* Lien à transmettre au client pour compléter sa campagne. */}
      {showMeta && clientLink && (
        <div className="card border-brand/30 bg-brand/5">
          <h2 className="text-sm font-semibold text-slate-900">Lien pour le client</h2>
          <p className="mb-2 text-xs text-slate-500">
            {clientActivated
              ? 'Transmettez ce lien au client pour qu’il accède à son espace et dépose ses pièces.'
              : 'Première connexion : ce lien permet au client d’activer son compte, puis de compléter sa campagne.'}
          </p>
          <CopyLink url={clientLink} />
        </div>
      )}

      <div className="card">
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">
            {t('completude')}
            {showMeta && <span className="ml-1 text-xs font-normal text-slate-400">(pièces obligatoires)</span>}
          </span>
          <span className="font-semibold text-brand">{comp.label}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand transition-all duration-500"
            style={{ width: `${Math.round(comp.ratio * 100)}%` }}
          />
        </div>
      </div>

      {/* Synthèse du dossier (cabinet) : statuts réels des documents. */}
      {showMeta && (
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Synthèse du dossier</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { k: 'Reçus', v: synthese.recus, cls: 'text-blue-700' },
              { k: 'Manquants', v: synthese.manquants, cls: 'text-slate-700' },
              { k: 'À corriger', v: synthese.aCorriger, cls: 'text-red-700' },
              { k: 'Validés', v: synthese.valides, cls: 'text-green-700' },
              { k: 'Non concerné', v: synthese.nonConcerne, cls: 'text-slate-400' },
            ].map((s) => (
              <div key={s.k} className="rounded-lg border border-slate-200 p-3 text-center">
                <div className={`text-2xl font-bold ${s.cls}`}>{s.v}</div>
                <div className="text-[11px] text-slate-500">{s.k}</div>
              </div>
            ))}
          </div>
          {isRectificative && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span className="font-semibold">Risque de délai :</span> à Genève, le dépôt DRIS/TOU doit intervenir au plus
              tard le <strong>31 mars</strong> de l’année suivant l’imposition, même si tous les justificatifs ne sont pas
              encore disponibles.
            </p>
          )}
        </div>
      )}

      {/* Informations fournies par le client (intake), lecture seule — cabinet. */}
      {showMeta && intakeRows.length > 0 && (
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Informations fournies par le client</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {intakeRows.map((r) => (
              <div key={r.label}>
                <dt className="text-xs text-slate-400">{r.label}</dt>
                <dd className="text-sm text-slate-800">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Dépôt groupé : tous les documents d'un coup, triés automatiquement par l'IA (§7). */}
      <div className="rounded-xl border border-brand/30 bg-brand/5 p-5">
        <h2 className="text-sm font-semibold text-brand">{tUp('bulkTitle')}</h2>
        <p className="text-xs text-slate-600">{tUp('bulkHint')}</p>
        <Dropzone
          action={bulkUpload}
          fields={{ campaignId, locale }}
          prompt={tUp('bulkDropzone')}
          idle={tUp('bulkSend')}
          pending={tUp('uploading')}
        />
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
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</h2>
              <span className="text-xs font-medium text-slate-400">
                {group.resolved}/{group.total}
              </span>
            </div>
            <div className="mb-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  group.ratio === 1 ? 'bg-green-500' : 'bg-brand'
                }`}
                style={{ width: `${Math.round(group.ratio * 100)}%` }}
              />
            </div>
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
                          <span className={`text-[10px] font-medium uppercase tracking-wide ${REQ_STYLE[item.pieceDefinition.requirement] ?? 'text-slate-400'}`}>
                            {REQ_LABEL[item.pieceDefinition.requirement]?.[locale] ?? (item.required ? tStatus('required') : tStatus('optional'))}
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

                    {/* Explication client + échéance (visibles côté client et cabinet) */}
                    {item.clientNote && (
                      <p className="mt-2 rounded-md border border-blue-100 bg-blue-50 px-2 py-1.5 text-xs text-blue-800">
                        {item.clientNote}
                      </p>
                    )}
                    {item.dueDate && (
                      <p className="mt-1 text-[11px] font-medium text-slate-500">Échéance : {fmtDate(item.dueDate)}</p>
                    )}

                    {/* Éditeur cabinet (écran 3 — personnalisation), mode avancé. */}
                    {showMeta && advanced && (
                      <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <form action={setItemRequired}>
                            <input type="hidden" name="itemId" value={item.id} />
                            <input type="hidden" name="locale" value={locale} />
                            <input type="hidden" name="required" value={(!item.required).toString()} />
                            <button type="submit" className="btn btn-secondary btn-sm">
                              {item.required ? 'Rendre optionnel' : 'Rendre obligatoire'}
                            </button>
                          </form>
                          <form action={deleteItem}>
                            <input type="hidden" name="itemId" value={item.id} />
                            <input type="hidden" name="locale" value={locale} />
                            <button type="submit" className="btn btn-sm bg-red-600 px-3 py-1.5 text-white hover:bg-red-700">
                              Supprimer
                            </button>
                          </form>
                        </div>
                        <form action={updateItemDetails} className="grid gap-2 sm:grid-cols-2">
                          <input type="hidden" name="itemId" value={item.id} />
                          <input type="hidden" name="locale" value={locale} />
                          <label className="block sm:col-span-2">
                            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">Explication client</span>
                            <input name="clientNote" defaultValue={item.clientNote ?? ''} className="input text-xs" placeholder="Pourquoi / comment fournir cette pièce" />
                          </label>
                          <label className="block sm:col-span-2">
                            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">Note interne (cabinet)</span>
                            <input name="internalNote" defaultValue={item.internalNote ?? ''} className="input text-xs" placeholder="Non visible par le client" />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">Date limite</span>
                            <input type="date" name="dueDate" defaultValue={dateInput(item.dueDate)} className="input text-xs" />
                          </label>
                          <div className="flex items-end">
                            <button type="submit" className="btn btn-primary btn-sm">Enregistrer</button>
                          </div>
                        </form>
                      </div>
                    )}

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

                    {/* « Je ne suis pas concerné » par cette pièce (côté client). */}
                    {!showMeta && item.status === 'MANQUANT' && (
                      <form action={setItemConcern} className="mt-1">
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="concerned" value="false" />
                        <button type="submit" className="text-xs text-slate-500 underline hover:text-slate-700">
                          {tStatus('notConcerned')}
                        </button>
                      </form>
                    )}
                    {!showMeta && item.status === 'NON_CONCERNE' && (
                      <form action={setItemConcern} className="mt-1">
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="concerned" value="true" />
                        <button type="submit" className="text-xs text-brand underline hover:text-brand-light">
                          {tStatus('concernedAfterAll')}
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* Ajouter une pièce du référentiel (écran 3 — mode avancé). */}
      {showMeta && advanced && availablePieces.length > 0 && (
        <form action={addItemFromCatalogue} className="card flex flex-wrap items-end gap-2">
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="locale" value={locale} />
          <label className="block flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">Ajouter une pièce</span>
            <select name="pieceDefinitionId" className="select" defaultValue="">
              <option value="" disabled>
                Choisir une pièce du référentiel…
              </option>
              {availablePieces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom} ({p.code})
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary btn-sm">
            Ajouter
          </button>
        </form>
      )}

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
