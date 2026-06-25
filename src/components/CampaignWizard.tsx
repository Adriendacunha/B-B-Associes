'use client';

import { useMemo, useState, useTransition } from 'react';
import { ArrowLeft, ArrowRight, Check, FileText, Send, FileBox } from 'lucide-react';
import type { Answers, DocObligation, Section } from '@/lib/questionnaire/types';
import { groupByCategory, requestedDocuments, visibleSections } from '@/lib/questionnaire/engine';
import { RECTIFICATIVE_TEMPLATE as T } from '@/data/templates/declaration-rectificative';
import { QuestionField } from '@/components/questionnaire/QuestionField';
import { createClientQuick } from '@/app/actions/client';
import { wizardCreateAndSend } from '@/app/actions/campaign';
import type { AppLocale } from '@/lib/i18n/locales';

interface ClientLite {
  clientCode: string;
  displayName: string;
}

const STEPS = ['Client', 'Modèle', 'Questions', 'Aperçu & envoi'];

const OBLIGATION_BADGE: Record<DocObligation, { cls: string; label: string }> = {
  obligatoire: { cls: 'bg-red-100 text-red-700', label: 'Obligatoire' },
  conditionnel: { cls: 'bg-amber-100 text-amber-800', label: 'Conditionnel' },
  recommande: { cls: 'bg-slate-200 text-slate-600', label: 'Recommandé' },
};

/** Modèles proposés. Seul « Déclaration d'impôt » est actif (assistant guidé). */
const MODELS = [
  { key: 'declaration-impot', name: 'Déclaration d’impôt', desc: 'Assistant guidé : questions courtes → liste de documents.', active: true },
  { key: 'bouclement', name: 'Bouclement annuel', desc: 'Bientôt disponible.', active: false },
  { key: 'tva', name: 'TVA', desc: 'Bientôt disponible.', active: false },
  { key: 'perso', name: 'Demande personnalisée', desc: 'Bientôt disponible.', active: false },
];

export function CampaignWizard({
  locale,
  clients,
  defaultFiscalYear,
}: {
  locale: AppLocale;
  clients: ClientLite[];
  defaultFiscalYear: number;
}) {
  const [step, setStep] = useState(0);

  // Étape 1 — Client
  const [clientMode, setClientMode] = useState<'existing' | 'new'>(clients.length ? 'existing' : 'new');
  const [search, setSearch] = useState('');
  const [client, setClient] = useState<ClientLite | null>(null);
  const [nc, setNc] = useState({ lastName: '', firstName: '', email: '', canton: 'GE', locale: 'FR', type: 'PARTICULIER' });
  const [clientErr, setClientErr] = useState<string | null>(null);
  const [creatingClient, startClient] = useTransition();

  // Étape 2 — Modèle
  const [model, setModel] = useState<string | null>(null);

  // Étape 3 — Questions
  const [answers, setAnswers] = useState<Answers>({});
  const [fiscalYear, setFiscalYear] = useState(defaultFiscalYear);
  const set = (id: string, v: Answers[string]) => setAnswers((a) => ({ ...a, [id]: v }));

  // Étape 4 — Envoi
  const [sending, startSend] = useTransition();
  const [result, setResult] = useState<{ campaignId: string } | null>(null);
  const [sendErr, setSendErr] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      clients
        .filter((c) => `${c.displayName} ${c.clientCode}`.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 8),
    [clients, search],
  );
  const sections = useMemo(
    () =>
      visibleSections(T, answers)
        .map((s) => ({ ...s, questions: s.questions.filter((q) => !q.clientData) }))
        .filter((s) => s.questions.length > 0),
    [answers],
  );
  const docs = useMemo(() => requestedDocuments(T, answers), [answers]);
  const grouped = useMemo(() => groupByCategory(docs), [docs]);
  const counts = {
    obligatoire: docs.filter((d) => d.obligation === 'obligatoire').length,
    conditionnel: docs.filter((d) => d.obligation === 'conditionnel').length,
    recommande: docs.filter((d) => d.obligation === 'recommande').length,
  };

  const createClient = () =>
    startClient(async () => {
      setClientErr(null);
      const r = await createClientQuick({
        uiLocale: locale,
        firstName: nc.firstName,
        lastName: nc.lastName,
        email: nc.email,
        locale: nc.locale,
        canton: nc.canton,
        type: nc.type,
      });
      if (r.ok) {
        setClient({ clientCode: r.clientCode, displayName: r.displayName });
        setClientMode('existing');
      } else {
        setClientErr(r.error === 'existe' ? 'Un client avec ce code ou cet e-mail existe déjà.' : 'Renseignez nom, prénom et e-mail.');
      }
    });

  const submit = () =>
    startSend(async () => {
      setSendErr(null);
      if (!client) return;
      const r = await wizardCreateAndSend({ locale, clientCode: client.clientCode, fiscalYear, answers });
      if (r.ok) setResult({ campaignId: r.campaignId });
      else setSendErr('La création a échoué. Vérifiez le client et l’année, puis réessayez.');
    });

  const canNext = step === 0 ? !!client : step === 1 ? model === 'declaration-impot' : true;

  // ─────────── Écran de succès ───────────
  if (result) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
          <Check className="h-6 w-6" strokeWidth={2} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Campagne envoyée</h1>
        <p className="text-sm text-slate-600">
          Le lien sécurisé a été transmis à <span className="font-medium text-slate-800">{client?.displayName}</span>.
          Vous suivrez les pièces déposées depuis la campagne.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <a href={`/${locale}/campagne/${result.campaignId}`} className="btn btn-primary">
            Ouvrir la campagne
          </a>
          <a href={`/${locale}/tableau-de-bord`} className="btn btn-secondary">
            Retour au tableau de bord
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Créer une campagne</h1>
        <p className="text-sm text-slate-600">Créez une campagne, envoyez un lien sécurisé, suivez les pièces manquantes.</p>
      </header>

      {/* Stepper */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                i < step ? 'bg-brand text-white' : i === step ? 'bg-brand/10 text-brand ring-2 ring-brand' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {i < step ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
            </span>
            <span className={i === step ? 'font-semibold text-slate-900' : 'text-slate-500'}>{label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 text-slate-300">→</span>}
          </li>
        ))}
      </ol>

      {/* ───────── Étape 1 : Client ───────── */}
      {step === 0 && (
        <div className="card space-y-4">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setClientMode('existing')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${clientMode === 'existing' ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Client existant
            </button>
            <button
              type="button"
              onClick={() => setClientMode('new')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${clientMode === 'new' ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Nouveau client
            </button>
          </div>

          {clientMode === 'existing' ? (
            <div className="space-y-3">
              <input
                className="input"
                placeholder="Rechercher un client (nom ou code)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
                {filtered.map((c) => (
                  <li key={c.clientCode}>
                    <button
                      type="button"
                      onClick={() => setClient(c)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ${client?.clientCode === c.clientCode ? 'bg-brand/5' : ''}`}
                    >
                      <span>
                        <span className="font-mono text-xs text-slate-400">{c.clientCode}</span> {c.displayName}
                      </span>
                      {client?.clientCode === c.clientCode && <Check className="h-4 w-4 text-brand" strokeWidth={2.5} />}
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">Aucun client. Créez-en un nouveau.</li>}
              </ul>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Nom *</span>
                <input className="input" value={nc.lastName} onChange={(e) => setNc({ ...nc, lastName: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Prénom *</span>
                <input className="input" value={nc.firstName} onChange={(e) => setNc({ ...nc, firstName: e.target.value })} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-slate-600">E-mail *</span>
                <input type="email" className="input" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Type</span>
                <select className="select" value={nc.type} onChange={(e) => setNc({ ...nc, type: e.target.value })}>
                  <option value="PARTICULIER">Particulier</option>
                  <option value="INDEPENDANT">Indépendant</option>
                  <option value="SOCIETE">Société</option>
                  <option value="HOIRIE">Hoirie</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Canton</span>
                <select className="select" value={nc.canton} onChange={(e) => setNc({ ...nc, canton: e.target.value })}>
                  <option value="GE">Genève</option>
                  <option value="VD">Vaud</option>
                  <option value="autre">Autre</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Langue</span>
                <select className="select" value={nc.locale} onChange={(e) => setNc({ ...nc, locale: e.target.value })}>
                  <option value="FR">Français</option>
                  <option value="EN">English</option>
                  <option value="DE">Deutsch</option>
                </select>
              </label>
              {clientErr && <p className="text-xs text-red-600 sm:col-span-2">{clientErr}</p>}
              <div className="sm:col-span-2">
                <button type="button" onClick={createClient} disabled={creatingClient} className="btn btn-secondary btn-sm">
                  {creatingClient ? 'Création…' : 'Créer le client'}
                </button>
              </div>
            </div>
          )}

          {client && (
            <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-800">
              Client sélectionné : <span className="font-medium">{client.displayName}</span>{' '}
              <span className="font-mono text-xs text-green-700">{client.clientCode}</span>
            </p>
          )}
        </div>
      )}

      {/* ───────── Étape 2 : Modèle ───────── */}
      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {MODELS.map((m) => (
            <button
              key={m.key}
              type="button"
              disabled={!m.active}
              onClick={() => m.active && setModel(m.key)}
              className={`card flex flex-col text-left transition ${
                !m.active
                  ? 'cursor-not-allowed opacity-60'
                  : model === m.key
                    ? 'ring-2 ring-brand'
                    : 'hover:-translate-y-0.5 hover:shadow-md'
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <FileBox className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <h2 className="mt-3 text-base font-semibold text-slate-900">{m.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{m.desc}</p>
              {!m.active && <span className="mt-2 badge bg-slate-200 text-slate-600">Bientôt</span>}
            </button>
          ))}
        </div>
      )}

      {/* ───────── Étape 3 : Questions ───────── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="card grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Année fiscale</span>
              <input
                type="number"
                min={2015}
                max={new Date().getFullYear() + 1}
                className="input"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(Number(e.target.value))}
              />
            </label>
          </div>
          {sections.map((s: Section) => (
            <section key={s.id} className="card space-y-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{s.clientTitle ?? s.title}</h2>
              {s.questions.map((q) => (
                <QuestionField key={q.id} q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
              ))}
            </section>
          ))}
          <p className="text-xs text-slate-500">
            Vous pouvez laisser des questions sans réponse : le client les complétera lui-même dans son espace.
          </p>
        </div>
      )}

      {/* ───────── Étape 4 : Aperçu & envoi ───────── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold text-slate-900">Ce que le client recevra</h2>
              <span className="badge bg-brand/10 text-brand">{docs.length} document(s)</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge bg-red-100 text-red-700">{counts.obligatoire} obligatoire(s)</span>
              <span className="badge bg-amber-100 text-amber-800">{counts.conditionnel} conditionnel(s)</span>
              <span className="badge bg-slate-200 text-slate-600">{counts.recommande} recommandé(s)</span>
            </div>
            <div className="space-y-4">
              {grouped.map((g) => (
                <div key={g.category}>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{g.category}</h3>
                  <ul className="space-y-2">
                    {g.docs.map((d) => {
                      const b = OBLIGATION_BADGE[d.obligation];
                      return (
                        <li key={d.id} className="rounded-lg border border-slate-200 p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                              <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} />
                              {d.clientLabel}
                            </span>
                            <span className={`badge shrink-0 ${b.cls}`}>{b.label}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{d.reason}</p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Vous pourrez ajuster finement cette liste (inclure/exclure, notes, échéances) en « mode avancé » sur la
              campagne après l’envoi.
            </p>
          </div>

          {sendErr && <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{sendErr}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand/5 p-4">
            <p className="text-sm text-slate-600">
              {docs.length} document(s) seront demandés à <span className="font-medium text-slate-800">{client?.displayName}</span> pour {fiscalYear}.
            </p>
            <button type="button" onClick={submit} disabled={sending || !client} className="btn btn-primary">
              <Send className="h-4 w-4" strokeWidth={2} />
              {sending ? 'Envoi…' : 'Créer et envoyer le lien'}
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="btn btn-ghost btn-sm disabled:invisible"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Précédent
        </button>
        {step < STEPS.length - 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={!canNext}
            className="btn btn-primary btn-sm"
          >
            Suivant
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}
