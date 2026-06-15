import { getTranslations, setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/session';
import { createClient } from '@/app/actions/client';
import { baseUrl } from '@/lib/url';
import { Link } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const { locale } = await params;
  const { error, created } = await searchParams;
  setRequestLocale(locale);
  await requireStaff(locale);
  const t = await getTranslations('clients');

  const [clients, staff] = await Promise.all([
    prisma.client.findMany({
      orderBy: { clientCode: 'asc' },
      include: { gestionnaire: true, campaigns: { select: { id: true, status: true } } },
    }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  const APP_URL = await baseUrl();
  const activationUrl = (loc: string, token: string) =>
    `${APP_URL}/${loc.toLowerCase()}/activation?token=${token}`;
  const activeCount = (cs: { status: string }[]) => cs.filter((c) => c.status !== 'COMPLET' && c.status !== 'NON_COMMENCE').length;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
        <p className="text-sm text-slate-600">{t('subtitle')}</p>
      </header>

      {error && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error === 'existe' ? t('errExiste') : t('errChamps')}
        </p>
      )}
      {created && (
        <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">{t('createdOk')}</p>
      )}

      {/* Formulaire de création — onglet Identité */}
      <form action={createClient} className="card grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="uiLocale" value={locale} />
        <h2 className="text-sm font-semibold text-slate-700 sm:col-span-2">Identité</h2>

        <Field label="Nom *"><input name="lastName" required className="input" placeholder="ex. Meyer" /></Field>
        <Field label="Prénom *"><input name="firstName" required className="input" placeholder="ex. Thomas" /></Field>

        <Field label="Date de naissance"><input type="date" name="birthDate" className="input" /></Field>
        <Field label="État civil">
          <select name="civilStatus" className="select" defaultValue="">
            <option value="">Sélectionner…</option>
            <option value="celibataire">Célibataire</option>
            <option value="marie">Marié·e</option>
            <option value="partenariat">Partenariat enregistré</option>
            <option value="separe">Séparé·e</option>
            <option value="divorce">Divorcé·e</option>
            <option value="veuf">Veuf·ve</option>
          </select>
        </Field>

        <div className="sm:col-span-2">
          <Field label="Rue"><input name="street" className="input" placeholder="ex. Bahnhofstrasse 42" /></Field>
        </div>

        <Field label="NPA"><input name="postalCode" className="input" placeholder="8001" /></Field>
        <Field label="Ville"><input name="city" className="input" placeholder="Zürich" /></Field>

        <Field label="Nationalité"><input name="nationality" className="input" placeholder="ex. CH, FR, DE" /></Field>
        <Field label="Type de permis"><input name="permitType" className="input" placeholder="ex. B, C, L" /></Field>

        <Field label="Numéro AVS"><input name="avsNumber" className="input" placeholder="756.XXXX.XXXX.XX" /></Field>
        <Field label="Religion"><input name="religion" className="input" placeholder="Pour l'impôt ecclésiastique" /></Field>

        <Field label="Téléphone"><input name="phone" className="input" placeholder="+41 XX XXX XX XX" /></Field>
        <Field label="E-mail du client *"><input type="email" name="email" required className="input" placeholder="ex. client@email.com" /></Field>

        <Field label="Langue">
          <select name="locale" className="select" defaultValue="FR">
            <option value="FR">Français</option>
            <option value="EN">English</option>
            <option value="DE">Deutsch</option>
          </select>
        </Field>
        <Field label="Collaborateur responsable">
          <select name="gestionnaireId" className="select" defaultValue={staff[0]?.id ?? ''}>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" className="btn btn-primary">
            {t('create')}
          </button>
        </div>
      </form>

      {/* Liste des clients */}
      <ul className="space-y-3">
        {clients.map((c) => {
          const activated = Boolean(c.passwordHash);
          return (
            <li key={c.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="font-mono text-xs text-slate-400">{c.clientCode}</span>{' '}
                  <span className="font-semibold text-slate-800">{c.displayName}</span>{' '}
                  <span className="text-slate-500">· {c.email}</span>{' '}
                  <span className="text-xs text-slate-400">· {c.locale}</span>
                </div>
                <span
                  className={`badge ${activated ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}
                >
                  {activated ? t('activated') : t('pending')}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {t('manager')} : {c.gestionnaire?.name ?? '—'}
                {c.canton ? ` · ${c.canton}` : ''}
                {' · '}
                {activeCount(c.campaigns) === 0 ? (
                  <span className="text-slate-400">Aucune campagne active</span>
                ) : (
                  <span className="font-medium text-slate-600">{activeCount(c.campaigns)} campagne(s) active(s)</span>
                )}
              </div>

              {!activated && c.activationToken && (
                <div className="mt-2">
                  <label className="mb-1 block text-xs font-medium text-slate-500">{t('activationLink')}</label>
                  <input
                    readOnly
                    value={activationUrl(c.locale, c.activationToken)}
                    className="input w-full font-mono text-xs"
                  />
                </div>
              )}

              <div className="mt-2">
                <Link href={`/clients/${c.id}`} className="text-xs font-medium text-brand hover:underline">
                  Ouvrir la fiche →
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
