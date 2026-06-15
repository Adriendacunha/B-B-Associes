import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/session';
import { CopyLink } from '@/components/CopyLink';
import { Link } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const STATUS_LABEL: Record<string, string> = {
  NON_COMMENCE: 'Non commencée',
  EN_COURS: 'En cours',
  EN_ATTENTE_CLIENT: 'En attente client',
  A_VALIDER: 'À valider',
  COMPLET: 'Complète',
  SUSPENDU: 'Suspendue',
};

export default async function ClientFichePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireStaff(locale);

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      gestionnaire: true,
      campaigns: { orderBy: { fiscalYear: 'desc' }, include: { _count: { select: { checklistItems: true } } } },
    },
  });
  if (!client) notFound();

  const templates = await prisma.campaignTemplate.findMany({ select: { key: true, name: true } });
  const templateName = new Map(templates.map((t) => [t.key, t.name]));

  const activated = Boolean(client.passwordHash);
  const clientLink = activated
    ? `${APP_URL}/${client.locale.toLowerCase()}/espace`
    : client.activationToken
      ? `${APP_URL}/${client.locale.toLowerCase()}/activation?token=${client.activationToken}`
      : null;

  const CIVIL_LABEL: Record<string, string> = {
    celibataire: 'Célibataire',
    marie: 'Marié·e',
    partenariat: 'Partenariat enregistré',
    separe: 'Séparé·e',
    divorce: 'Divorcé·e',
    veuf: 'Veuf·ve',
  };
  const fmtDate = (d: Date | null) =>
    d ? `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}` : '—';
  const address = [client.street, [client.postalCode, client.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—';

  const info: [string, string][] = [
    ['Code', client.clientCode],
    ['E-mail', client.email],
    ['Téléphone', client.phone ?? '—'],
    ['Date de naissance', fmtDate(client.birthDate)],
    ['État civil', client.civilStatus ? (CIVIL_LABEL[client.civilStatus] ?? client.civilStatus) : '—'],
    ['Adresse', address],
    ['Nationalité', client.nationality ?? '—'],
    ['Type de permis', client.permitType ?? '—'],
    ['Numéro AVS', client.avsNumber ?? '—'],
    ['Religion', client.religion ?? '—'],
    ['Langue', client.locale],
    ['Collaborateur', client.gestionnaire?.name ?? '—'],
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/clients" className="text-xs font-medium text-brand hover:underline">
            ← Clients
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{client.displayName}</h1>
          <p className="text-sm text-slate-500">
            <span className="font-mono text-xs text-slate-400">{client.clientCode}</span> ·{' '}
            <span className={`badge ${activated ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
              {activated ? 'Activé' : 'En attente d’activation'}
            </span>
          </p>
        </div>
        <Link href={`/clients/${client.id}/nouvelle-campagne`} className="btn btn-primary">
          <Plus className="h-4 w-4" strokeWidth={2} />
          Créer une campagne
        </Link>
      </header>

      {/* Informations essentielles */}
      <section className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Informations</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          {info.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-slate-400">{k}</dt>
              <dd className="text-sm text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
        {clientLink && (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {activated ? 'Lien de l’espace client (à transmettre)' : 'Lien d’activation (à transmettre au client)'}
            </label>
            <CopyLink url={clientLink} />
          </div>
        )}
      </section>

      {/* Campagnes */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Campagnes</h2>
        {client.campaigns.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            Aucune campagne active. Cliquez sur « Créer une campagne » pour démarrer.
          </p>
        ) : (
          <ul className="space-y-2">
            {client.campaigns.map((camp) => (
              <li key={camp.id} className="card flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium text-slate-800">
                    {camp.templateId ? (templateName.get(camp.templateId) ?? camp.templateId) : 'Déclaration ordinaire'}
                  </span>{' '}
                  <span className="text-sm text-slate-500">· {camp.fiscalYear}</span>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {camp._count.checklistItems} pièce(s) · {STATUS_LABEL[camp.status] ?? camp.status}
                  </div>
                </div>
                <Link href={`/campagne/${camp.id}`} className="btn btn-secondary btn-sm">
                  Ouvrir
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
