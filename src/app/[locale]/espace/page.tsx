import { getTranslations, setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { clientLogin } from '@/app/actions/auth';
import { getCurrentPrincipal } from '@/lib/auth/session';
import { CampaignChecklist } from '@/components/CampaignChecklist';
import { ClientIdentityFields } from '@/components/ClientIdentityFields';
import { updateOwnIdentity } from '@/app/actions/client';
import { ValidatedInput } from '@/components/ValidatedInput';
import { ClientDeclarationForm } from '@/components/questionnaire/ClientDeclarationForm';
import { Logo } from '@/components/Logo';
import { RECTIFICATIVE_TEMPLATE } from '@/data/templates/declaration-rectificative';
import type { Answers } from '@/lib/questionnaire/types';
import type { AppLocale } from '@/lib/i18n/locales';

export const dynamic = 'force-dynamic';

export default async function EspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; idok?: string; iderror?: string }>;
}) {
  const { locale } = await params;
  const { error, idok, iderror } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  const te = await getTranslations('espace');

  const principal = await getCurrentPrincipal();

  // Non connecté → formulaire de connexion client.
  if (!principal || principal.type !== 'CLIENT') {
    return (
      <div className="mx-auto max-w-sm py-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo className="mb-3 h-12 w-auto" />
          <h1 className="text-2xl font-bold text-slate-900">{t('clientTitle')}</h1>
        </div>
        {error && (
          <p className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error === 'locked' ? t('errorLocked') : error === 'token' ? t('errorToken') : t('errorInvalid')}
          </p>
        )}
        <form action={clientLogin} className="card space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">{t('email')}</span>
            <ValidatedInput type="email" name="email" required autoComplete="username" className="input" requiredMessage={t('fieldRequired')} typeMismatchMessage={t('emailInvalid')} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">{t('password')}</span>
            <ValidatedInput type="password" name="password" required autoComplete="current-password" className="input" requiredMessage={t('fieldRequired')} />
          </label>
          <button type="submit" className="btn btn-primary w-full">
            {t('signIn')}
          </button>
        </form>
        <p className="mt-3 text-center text-xs text-slate-500">{t('firstConnection')}</p>
      </div>
    );
  }

  // Connecté → sa campagne la plus récente.
  const campaign = await prisma.campaign.findFirst({
    where: { clientId: principal.client.id },
    orderBy: { fiscalYear: 'desc' },
    select: { id: true, fiscalYear: true, profile: true, templateId: true },
  });

  // Libellé du modèle → titre « Documents pour votre {label} {année} », identique
  // à l'aperçu client côté cabinet.
  const template = campaign?.templateId
    ? await prisma.campaignTemplate.findUnique({ where: { key: campaign.templateId }, select: { name: true } })
    : null;
  const declarationLabel = template?.name ?? 'déclaration';

  // Déclaration : le client répond lui-même à toutes les questions que le cabinet
  // a laissées sans réponse (verrou = cabinetKeys). Sa checklist se met à jour.
  let declaration: { initial: Answers; lockedIds: string[] } | null = null;
  if (campaign?.templateId === RECTIFICATIVE_TEMPLATE.id) {
    const profile = (campaign.profile as { answers?: Answers; cabinetKeys?: string[] } | null) ?? {};
    const initial = profile.answers ?? {};
    declaration = { initial, lockedIds: profile.cabinetKeys ?? Object.keys(initial) };
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          {campaign ? te('checklistTitle', { label: declarationLabel, year: String(campaign.fiscalYear) }) : te('title')}
        </h1>
        <p className="text-sm text-slate-600">{te('intro')}</p>
      </header>

      {idok && (
        <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">
          Vos informations ont été enregistrées. Merci !
        </p>
      )}
      {iderror && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          Veuillez renseigner au moins votre nom et votre prénom.
        </p>
      )}

      {/* Mes informations d'identité — le client complète/corrige sa fiche. */}
      <details className="card" open={Boolean(iderror)}>
        <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">
          Mes informations
        </summary>
        <p className="mt-1 text-xs text-slate-500">
          Complétez ou corrigez vos informations d’identité. Elles facilitent la préparation de votre déclaration.
        </p>
        <form action={updateOwnIdentity} className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="uiLocale" value={locale} />
          <ClientIdentityFields client={principal.client} omitGestionnaire emailReadOnly />
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" className="btn btn-primary">
              Enregistrer mes informations
            </button>
          </div>
        </form>
      </details>

      {campaign ? (
        <>
          {declaration && (
            <ClientDeclarationForm
              locale={locale as AppLocale}
              campaignId={campaign.id}
              initial={declaration.initial}
              lockedIds={declaration.lockedIds}
            />
          )}
          <CampaignChecklist campaignId={campaign.id} locale={locale as AppLocale} showMeta={false} />
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {t('noCampaign')}
        </p>
      )}
    </div>
  );
}
