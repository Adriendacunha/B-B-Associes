import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Eye } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/session';
import { CampaignChecklist } from '@/components/CampaignChecklist';
import { RECTIFICATIVE_TEMPLATE } from '@/data/templates/declaration-rectificative';
import { pendingClientQuestions } from '@/lib/questionnaire/intake';
import { Link } from '@/i18n/routing';
import type { AppLocale } from '@/lib/i18n/locales';

export const dynamic = 'force-dynamic';

export default async function ApercuPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireStaff(locale);
  const te = await getTranslations('espace');

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, fiscalYear: true, templateId: true, profile: true },
  });
  if (!campaign) notFound();

  const template = campaign.templateId
    ? await prisma.campaignTemplate.findUnique({ where: { key: campaign.templateId }, select: { name: true } })
    : null;
  const label = template?.name ?? 'déclaration';

  // Questions que le client devra renseigner lui-même (le cabinet ne les a pas remplies).
  const profileBlob = (campaign.profile as { answers?: Record<string, unknown>; cabinetKeys?: string[] } | null) ?? {};
  const pending =
    campaign.templateId === RECTIFICATIVE_TEMPLATE.id
      ? pendingClientQuestions(
          RECTIFICATIVE_TEMPLATE,
          (profileBlob.answers ?? {}) as never,
          profileBlob.cabinetKeys ?? Object.keys(profileBlob.answers ?? {}),
        )
      : [];

  return (
    <div className="space-y-4">
      <Link href={`/campagne/${campaign.id}`} className="text-xs font-medium text-brand hover:underline">
        ← Retour à la campagne
      </Link>

      {/* Bandeau : aperçu de l'expérience client */}
      <div className="flex items-start gap-2 rounded-xl border border-brand/30 bg-brand/5 p-4 text-sm text-slate-700">
        <Eye className="mt-0.5 h-5 w-5 shrink-0 text-brand" strokeWidth={1.75} />
        <div>
          <p className="font-semibold text-slate-900">Aperçu — ce que verra le client</p>
          <p className="text-xs text-slate-500">Vérifiez la clarté avant d’envoyer la campagne.</p>
        </div>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">
          {te('checklistTitle', { label, year: String(campaign.fiscalYear) })}
        </h1>
        <p className="text-sm text-slate-600">{te('intro')}</p>
      </header>

      {/* Le client répondra d'abord à ces questions (elles génèrent sa liste). */}
      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Le client commencera par répondre à {pending.length} question(s)</p>
          <p className="mt-0.5 text-amber-800">
            Sa liste de documents se génère à partir de ses réponses :{' '}
            {pending.slice(0, 4).map((q) => q.clientLabel).join(' · ')}
            {pending.length > 4 ? '…' : ''}.
          </p>
        </div>
      )}

      {/* Rendu réel de la checklist côté client (showMeta=false). */}
      <CampaignChecklist campaignId={campaign.id} locale={locale as AppLocale} showMeta={false} />
    </div>
  );
}
