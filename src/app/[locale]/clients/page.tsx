import { getTranslations, setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/session';
import { createClient } from '@/app/actions/client';
import { Link } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

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

  const clients = await prisma.client.findMany({
    orderBy: { clientCode: 'asc' },
    include: { gestionnaire: true },
  });

  const activationUrl = (loc: string, token: string) =>
    `${APP_URL}/${loc.toLowerCase()}/activation?token=${token}`;

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

      {/* Formulaire de création */}
      <form action={createClient} className="card grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="uiLocale" value={locale} />
        <h2 className="text-sm font-semibold text-slate-700 sm:col-span-2">{t('new')}</h2>
        <Field label={t('code')}><input name="clientCode" required className="select" placeholder="C0123" /></Field>
        <Field label={t('name')}><input name="displayName" required className="select" placeholder="Dupont Jean" /></Field>
        <Field label={t('email')}><input type="email" name="email" required className="select" /></Field>
        <Field label={t('language')}>
          <select name="locale" className="select" defaultValue="FR">
            <option value="FR">Français</option>
            <option value="EN">English</option>
            <option value="DE">Deutsch</option>
          </select>
        </Field>
        <Field label={t('type')}>
          <select name="type" className="select" defaultValue="PARTICULIER">
            <option value="PARTICULIER">Particulier</option>
            <option value="INDEPENDANT">Indépendant</option>
            <option value="SOCIETE">Société</option>
            <option value="HOIRIE">Hoirie</option>
          </select>
        </Field>
        <Field label={t('residence')}>
          <select name="residence" className="select" defaultValue="RESIDENT_CH">
            <option value="RESIDENT_CH">Résident CH</option>
            <option value="FRONTALIER">Frontalier</option>
            <option value="QUASI_RESIDENT">Quasi-résident</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
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
              </div>

              {!activated && c.activationToken && (
                <div className="mt-2">
                  <label className="mb-1 block text-xs font-medium text-slate-500">{t('activationLink')}</label>
                  <input
                    readOnly
                    value={activationUrl(c.locale, c.activationToken)}
                    className="select w-full font-mono text-xs"
                  />
                </div>
              )}

              <div className="mt-2">
                <Link href="/profilage" className="text-xs text-brand hover:underline">
                  {t('openCampaign')} →
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
