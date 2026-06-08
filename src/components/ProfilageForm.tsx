'use client';

import { useMemo, useState, useTransition } from 'react';
import { PIECE_REFERENTIAL } from '@/data/piece-referential';
import { selectRequiredPieces, type ClientProfile } from '@/lib/checklist/profiling';
import { resolveLocalized, type AppLocale } from '@/lib/i18n/locales';
import { createCampaign } from '@/app/actions/campaign';

// Libellés de profilage en 3 langues (§3). Gardés ici pour ne pas alourdir les
// catalogues globaux ; les noms de pièces, eux, viennent du référentiel trilingue.
type Dict = Record<AppLocale, string>;
const L: Record<string, Dict> = {
  title: { fr: 'Ouvrir une campagne — profilage', en: 'Open a campaign — profiling', de: 'Kampagne eröffnen — Profilierung' },
  intro: {
    fr: 'Répondez aux questions : la checklist se génère en direct (§4.1).',
    en: 'Answer the questions: the checklist is generated live (§4.1).',
    de: 'Beantworten Sie die Fragen: Die Checkliste wird live erstellt (§4.1).',
  },
  client: { fr: 'Client', en: 'Client', de: 'Kunde' },
  fiscalYear: { fr: 'Année fiscale', en: 'Tax year', de: 'Steuerjahr' },
  type: { fr: 'Type de contribuable', en: 'Taxpayer type', de: 'Steuerpflichtiger Typ' },
  residence: { fr: 'Statut de résidence', en: 'Residence status', de: 'Wohnsitzstatus' },
  logement: { fr: 'Logement', en: 'Housing', de: 'Wohnsituation' },
  none: { fr: '—', en: '—', de: '—' },
  nbEnfants: { fr: "Nombre d'enfants à charge", en: 'Dependent children', de: 'Unterhaltsberechtigte Kinder' },
  situation: { fr: 'Situation', en: 'Situation', de: 'Situation' },
  revenus: { fr: 'Revenus', en: 'Income', de: 'Einkommen' },
  fortune: { fr: 'Titres & fortune', en: 'Securities & wealth', de: 'Wertschriften & Vermögen' },
  deductions: { fr: 'Déductions', en: 'Deductions', de: 'Abzüge' },
  preview: { fr: 'Checklist générée', en: 'Generated checklist', de: 'Erstellte Checkliste' },
  pieces: { fr: 'pièce(s)', en: 'item(s)', de: 'Posten' },
  required: { fr: 'Obligatoire', en: 'Required', de: 'Erforderlich' },
  optional: { fr: 'Facultatif', en: 'Optional', de: 'Optional' },
  submit: { fr: 'Créer la campagne', en: 'Create campaign', de: 'Kampagne erstellen' },
  // champs booléens
  nouveauClient: { fr: 'Nouveau client', en: 'New client', de: 'Neukunde' },
  enfantsMajeursACharge: { fr: 'Enfants majeurs à charge', en: 'Dependent adult children', de: 'Volljährige unterhaltsber. Kinder' },
  revenuSalarie: { fr: 'Revenu salarié', en: 'Salaried income', de: 'Lohneinkommen' },
  revenuIndependant: { fr: 'Revenu indépendant', en: 'Self-employed income', de: 'Selbständiges Einkommen' },
  rentes: { fr: 'Rentes (AVS/LPP)', en: 'Pensions (AVS/LPP)', de: 'Renten (AHV/BVG)' },
  immoLocatif: { fr: 'Revenus locatifs', en: 'Rental income', de: 'Mieteinnahmen' },
  titres: { fr: 'Titres / comptes bancaires', en: 'Securities / bank accounts', de: 'Wertschriften / Bankkonten' },
  compteEtranger: { fr: 'Compte à l’étranger', en: 'Foreign account', de: 'Auslandskonto' },
  crypto: { fr: 'Cryptomonnaies', en: 'Cryptocurrencies', de: 'Kryptowährungen' },
  pilier3a: { fr: '3e pilier A (3a)', en: '3rd pillar A (3a)', de: 'Säule 3a' },
  pilier3b: { fr: '3e pilier B (3b)', en: '3rd pillar B (3b)', de: 'Säule 3b' },
  rachatLpp: { fr: 'Rachat 2e pilier (LPP)', en: '2nd pillar buy-in', de: 'Einkauf 2. Säule' },
  fraisGarde: { fr: 'Frais de garde', en: 'Childcare costs', de: 'Betreuungskosten' },
  formation: { fr: 'Frais de formation', en: 'Training costs', de: 'Ausbildungskosten' },
  fraisProEffectifs: { fr: 'Frais professionnels effectifs', en: 'Actual professional expenses', de: 'Effektive Berufskosten' },
  dons: { fr: 'Dons', en: 'Donations', de: 'Spenden' },
  pensions: { fr: 'Pensions alimentaires', en: 'Alimony', de: 'Unterhaltsbeiträge' },
  dettes: { fr: 'Dettes / intérêts', en: 'Debts / interest', de: 'Schulden / Zinsen' },
  assujettiTva: { fr: 'Assujetti TVA', en: 'VAT liable', de: 'MWST-pflichtig' },
};

const CATEGORY_LABEL: Record<string, Dict> = {
  REVENUS: { fr: 'Revenus', en: 'Income', de: 'Einkommen' },
  TITRES_FORTUNE: { fr: 'Titres & fortune', en: 'Securities & wealth', de: 'Wertschriften & Vermögen' },
  IMMOBILIER: { fr: 'Immobilier', en: 'Real estate', de: 'Immobilien' },
  DEDUCTIONS: { fr: 'Déductions', en: 'Deductions', de: 'Abzüge' },
  FAMILLE: { fr: 'Famille', en: 'Family', de: 'Familie' },
  INDEP_SOCIETE: { fr: 'Indépendant / Société', en: 'Self-employed / Company', de: 'Selbständig / Gesellschaft' },
  A_TRIER: { fr: 'À trier', en: 'To sort', de: 'Zu sortieren' },
};

const BOOLEAN_FIELDS = {
  situation: ['nouveauClient', 'enfantsMajeursACharge'],
  revenus: ['revenuSalarie', 'revenuIndependant', 'rentes', 'immoLocatif'],
  fortune: ['titres', 'compteEtranger', 'crypto'],
  deductions: ['pilier3a', 'pilier3b', 'rachatLpp', 'fraisGarde', 'formation', 'fraisProEffectifs', 'dons', 'pensions', 'dettes', 'assujettiTva'],
} as const;

interface Props {
  locale: AppLocale;
  clients: { clientCode: string; displayName: string }[];
  defaultFiscalYear: number;
}

export function ProfilageForm({ locale, clients, defaultFiscalYear }: Props) {
  const t = (k: string) => L[k]?.[locale] ?? k;
  const [isPending, startTransition] = useTransition();

  const [clientCode, setClientCode] = useState(clients[0]?.clientCode ?? '');
  const [fiscalYear, setFiscalYear] = useState(defaultFiscalYear);
  const [profile, setProfile] = useState<ClientProfile>({
    type: 'PARTICULIER',
    residence: 'RESIDENT_CH',
    revenuSalarie: true,
    logement: 'LOCATAIRE',
  });

  const set = (patch: Partial<ClientProfile>) => setProfile((p) => ({ ...p, ...patch }));

  const preview = useMemo(() => selectRequiredPieces(PIECE_REFERENTIAL, profile), [profile]);

  const onSubmit = () =>
    startTransition(async () => {
      await createCampaign({ locale, clientCode, fiscalYear, profile });
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Colonne formulaire */}
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-brand">{t('title')}</h1>
          <p className="text-sm text-slate-600">{t('intro')}</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <Field label={t('client')}>
            <select className="select" value={clientCode} onChange={(e) => setClientCode(e.target.value)}>
              {clients.map((c) => (
                <option key={c.clientCode} value={c.clientCode}>
                  {c.clientCode} — {c.displayName}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('fiscalYear')}>
            <input
              type="number"
              className="select"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
            />
          </Field>
          <Field label={t('type')}>
            <select className="select" value={profile.type} onChange={(e) => set({ type: e.target.value as ClientProfile['type'] })}>
              <option value="PARTICULIER">Particulier</option>
              <option value="INDEPENDANT">Indépendant</option>
              <option value="SOCIETE">Société</option>
              <option value="HOIRIE">Hoirie</option>
            </select>
          </Field>
          <Field label={t('residence')}>
            <select className="select" value={profile.residence} onChange={(e) => set({ residence: e.target.value as ClientProfile['residence'] })}>
              <option value="RESIDENT_CH">Résident CH</option>
              <option value="FRONTALIER">Frontalier</option>
              <option value="QUASI_RESIDENT">Quasi-résident</option>
            </select>
          </Field>
          <Field label={t('logement')}>
            <select
              className="select"
              value={profile.logement ?? ''}
              onChange={(e) => set({ logement: (e.target.value || undefined) as ClientProfile['logement'] })}
            >
              <option value="">{t('none')}</option>
              <option value="PROPRIETAIRE">Propriétaire</option>
              <option value="LOCATAIRE">Locataire</option>
            </select>
          </Field>
          <Field label={t('nbEnfants')}>
            <input
              type="number"
              min={0}
              className="select"
              value={profile.nbEnfants ?? 0}
              onChange={(e) => set({ nbEnfants: Number(e.target.value) })}
            />
          </Field>
        </section>

        {(Object.keys(BOOLEAN_FIELDS) as (keyof typeof BOOLEAN_FIELDS)[]).map((group) => (
          <fieldset key={group} className="rounded-lg border border-slate-200 bg-white p-4">
            <legend className="px-1 text-xs font-semibold uppercase text-slate-500">{t(group)}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {BOOLEAN_FIELDS[group].map((field) => (
                <label key={field} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean((profile as unknown as Record<string, unknown>)[field])}
                    onChange={(e) => set({ [field]: e.target.checked } as Partial<ClientProfile>)}
                  />
                  {t(field)}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <button onClick={onSubmit} disabled={isPending || !clientCode} className="rounded bg-brand px-4 py-2 font-medium text-white hover:bg-brand-light disabled:opacity-50">
          {isPending ? '…' : t('submit')}
        </button>
      </div>

      {/* Colonne aperçu live */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold text-slate-800">{t('preview')}</h2>
            <span className="text-sm font-bold text-brand">
              {preview.length} {t('pieces')}
            </span>
          </div>
          <ul className="space-y-2">
            {preview.map((p) => (
              <li key={p.code} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-700">{resolveLocalized(p.nom, locale)}</span>
                  <span className={`shrink-0 text-[10px] uppercase ${p.requiredByDefault ? 'text-rose-500' : 'text-slate-400'}`}>
                    {p.requiredByDefault ? t('required') : t('optional')}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">{CATEGORY_LABEL[p.category]?.[locale] ?? p.category}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
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
