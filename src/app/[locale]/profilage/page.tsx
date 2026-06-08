import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { ProfilageForm } from '@/components/ProfilageForm';
import type { AppLocale } from '@/lib/i18n/locales';

// Données dynamiques (lecture DB) — pas de pré-rendu statique.
export const dynamic = 'force-dynamic';

export default async function ProfilagePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const clients = await prisma.client.findMany({
    select: { clientCode: true, displayName: true },
    orderBy: { clientCode: 'asc' },
  });

  // Échéance fiscale genevoise : déclarations de l'année précédente (§15.5).
  const defaultFiscalYear = new Date().getUTCFullYear() - 1;

  return (
    <ProfilageForm locale={locale as AppLocale} clients={clients} defaultFiscalYear={defaultFiscalYear} />
  );
}
