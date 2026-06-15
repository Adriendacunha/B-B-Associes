import { getTranslations, setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { clientLogin } from '@/app/actions/auth';
import { getCurrentPrincipal } from '@/lib/auth/session';
import { CampaignChecklist } from '@/components/CampaignChecklist';
import { IntakeForm } from '@/components/questionnaire/IntakeForm';
import { intakeQuestions } from '@/lib/questionnaire/intake';
import { RECTIFICATIVE_TEMPLATE } from '@/data/templates/declaration-rectificative';
import type { AppLocale } from '@/lib/i18n/locales';

export const dynamic = 'force-dynamic';

export default async function EspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  const te = await getTranslations('espace');

  const principal = await getCurrentPrincipal();

  // Non connecté → formulaire de connexion client.
  if (!principal || principal.type !== 'CLIENT') {
    return (
      <div className="mx-auto max-w-sm py-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">
            B
          </span>
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
            <input type="email" name="email" required autoComplete="username" className="input" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">{t('password')}</span>
            <input type="password" name="password" required autoComplete="current-password" className="input" />
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
    select: { id: true, profile: true, templateId: true },
  });

  // Intake : questions « données du dossier » à remplir par le client (rectificative).
  let intake: { questions: import('@/lib/questionnaire/types').Question[]; initial: Record<string, unknown> } | null = null;
  if (campaign?.templateId === RECTIFICATIVE_TEMPLATE.id) {
    const answers = ((campaign.profile as { answers?: Record<string, unknown> } | null)?.answers ?? {}) as never;
    const questions = intakeQuestions(RECTIFICATIVE_TEMPLATE, answers);
    if (questions.length > 0) intake = { questions, initial: answers };
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">{te('title')}</h1>
        <p className="text-sm text-slate-600">{te('intro')}</p>
      </header>
      {campaign ? (
        <>
          {intake && (
            <IntakeForm
              locale={locale as AppLocale}
              campaignId={campaign.id}
              questions={intake.questions}
              initial={intake.initial as never}
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
