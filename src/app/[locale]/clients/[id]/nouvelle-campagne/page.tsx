import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/session';
import { NewCampaignFlow } from '@/components/NewCampaignFlow';
import { Link } from '@/i18n/routing';
import type { AppLocale } from '@/lib/i18n/locales';

export const dynamic = 'force-dynamic';

export default async function NouvelleCampagnePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireStaff(locale);

  const [client, templates] = await Promise.all([
    prisma.client.findUnique({ where: { id }, select: { id: true, clientCode: true, displayName: true } }),
    prisma.campaignTemplate.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
  ]);
  if (!client) notFound();

  const defaultFiscalYear = new Date().getUTCFullYear() - 1;

  return (
    <div className="space-y-4">
      <Link href={`/clients/${client.id}`} className="text-xs font-medium text-brand hover:underline">
        ← Retour à la fiche
      </Link>
      <NewCampaignFlow
        locale={locale as AppLocale}
        client={{ clientCode: client.clientCode, displayName: client.displayName }}
        templates={templates.map((t) => ({ key: t.key, name: t.name, description: t.description, engine: t.engine }))}
        defaultFiscalYear={defaultFiscalYear}
      />
    </div>
  );
}
