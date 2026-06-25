'use client';

import { useMemo, useState, useTransition } from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import type { Answers, DocObligation, Section } from '@/lib/questionnaire/types';
import { groupByCategory, isAnswered, qualificationComplete, requestedDocuments, visibleSections } from '@/lib/questionnaire/engine';
import {
  RECTIFICATIVE_TEMPLATE as T,
  QUALIFYING_IDS,
  drisToTouAlert,
  notEligibleTouAlert,
} from '@/data/templates/declaration-rectificative';
import { createRectificativeCampaign } from '@/app/actions/campaign';
import { QuestionField } from '@/components/questionnaire/QuestionField';
import type { AppLocale } from '@/lib/i18n/locales';

interface Props {
  locale: AppLocale;
  clients: { clientCode: string; displayName: string }[];
  defaultFiscalYear: number;
}

const OBLIGATION_BADGE: Record<DocObligation, { cls: string; label: string }> = {
  obligatoire: { cls: 'bg-red-100 text-red-700', label: 'Obligatoire' },
  conditionnel: { cls: 'bg-amber-100 text-amber-800', label: 'Conditionnel' },
  recommande: { cls: 'bg-slate-200 text-slate-600', label: 'Recommandé' },
};

export function RectificativeQuestionnaire({ locale, clients, defaultFiscalYear }: Props) {
  const [answers, setAnswers] = useState<Answers>({});
  const set = (id: string, v: Answers[string]) => setAnswers((a) => ({ ...a, [id]: v }));
  const [clientCode, setClientCode] = useState(clients[0]?.clientCode ?? '');
  const [fiscalYear, setFiscalYear] = useState(defaultFiscalYear);
  const [isPending, startTransition] = useTransition();

  const createCampaign = () =>
    startTransition(async () => {
      await createRectificativeCampaign({ locale, clientCode, fiscalYear, answers });
    });

  // Côté cabinet : on ne montre QUE les questions de qualification (celles qui
  // déterminent les documents). Les données du dossier (clientData) sont fournies
  // par le client en déposant ses pièces — le cabinet ne remplit pas à sa place.
  const sections = useMemo(
    () =>
      visibleSections(T, answers)
        .map((s) => ({ ...s, questions: s.questions.filter((q) => !q.clientData) }))
        .filter((s) => s.questions.length > 0),
    [answers],
  );
  const qualified = useMemo(() => qualificationComplete(T, answers, QUALIFYING_IDS), [answers]);
  const docs = useMemo(() => requestedDocuments(T, answers), [answers]);
  const grouped = useMemo(() => groupByCategory(docs), [docs]);

  const touAlert = drisToTouAlert(answers);
  const notEligibleTou = notEligibleTouAlert(answers);

  const orientation = sections.find((s) => s.id === 'orientation');
  const otherSections = sections.filter((s) => s.id !== 'orientation');

  // Questions de qualification visibles encore sans réponse (pour guider le cabinet).
  const missingQualif = sections
    .flatMap((s) => s.questions)
    .filter((q) => QUALIFYING_IDS.includes(q.id) && !isAnswered(answers[q.id]));

  const counts = {
    obligatoire: docs.filter((d) => d.obligation === 'obligatoire').length,
    conditionnel: docs.filter((d) => d.obligation === 'conditionnel').length,
    recommande: docs.filter((d) => d.obligation === 'recommande').length,
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <span className="badge bg-brand/10 text-brand">Qualification</span>
        <h1 className="text-2xl font-bold text-slate-900">{T.title}</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Répondez à ces quelques questions : elles déterminent la <strong>liste de documents à demander au client</strong>.
          Vous ne remplissez pas le dossier — le client fournira ses informations en déposant ses pièces.
        </p>
      </header>

      {/* Client + année (création de la campagne) */}
      <section className="card grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Client</span>
          <select className="select" value={clientCode} onChange={(e) => setClientCode(e.target.value)}>
            {clients.map((c) => (
              <option key={c.clientCode} value={c.clientCode}>
                {c.clientCode} — {c.displayName}
              </option>
            ))}
          </select>
        </label>
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
      </section>

      {/* Étape 1 — qualification (orientation) */}
      {orientation && (
        <section className="card space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{orientation.clientTitle ?? orientation.title}</h2>
          {orientation.questions.map((q) => (
            <QuestionField key={q.id} q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
          ))}
        </section>
      )}

      {/* Étapes suivantes : une fois la qualification renseignée. */}
      {qualified && (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Colonne questionnaire détaillé */}
          <div className="space-y-6">
            {touAlert && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
                <p>
                  Cette demande relève probablement d’une <strong>TOU (déclaration ordinaire)</strong>, pas d’une simple DRIS :
                  à Genève, les déductions effectives (3e pilier, rachats LPP, garde, formation…) ne se font pas via l’impôt à la source.
                </p>
              </div>
            )}

            {notEligibleTou && (
              <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
                <p>
                  <strong>Quasi-résident non éligible</strong> : moins de 90 % des revenus mondiaux du foyer sont imposables
                  en Suisse. La déclaration ordinaire (TOU) n’est pas ouverte → rabattre sur l’<strong>impôt à la source (DRIS)</strong>
                  {' '}standard et arrêter la collecte TOU.
                </p>
              </div>
            )}

            {otherSections.map((s: Section) => (
              <section key={s.id} className="card space-y-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{s.clientTitle ?? s.title}</h2>
                {s.questions.map((q) => (
                  <QuestionField key={q.id} q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
                ))}
              </section>
            ))}
          </div>

          {/* Colonne checklist personnalisée générée en direct */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="card space-y-4">
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold text-slate-900">Documents demandés au client</h2>
                <span className="badge bg-brand/10 text-brand">{docs.length} document(s)</span>
              </div>

              {/* Synthèse */}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="badge bg-red-100 text-red-700">{counts.obligatoire} obligatoire(s)</span>
                <span className="badge bg-amber-100 text-amber-800">{counts.conditionnel} conditionnel(s)</span>
                <span className="badge bg-slate-200 text-slate-600">{counts.recommande} recommandé(s)</span>
              </div>
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                À Genève, le dépôt doit intervenir au plus tard le <strong>31 mars</strong> de l’année suivant l’imposition,
                même si tous les justificatifs ne sont pas encore disponibles.
              </p>

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
                            <p className="mt-1 text-xs text-slate-500">
                              <span className="font-medium text-slate-600">Pourquoi&nbsp;:</span> {d.reason}
                            </p>
                            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                              {d.acceptedFormats.join(' · ')}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Invitation à finir la qualification : on indique ce qui reste à répondre. */}
      {!qualified && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
          {missingQualif.length > 0 ? (
            <>
              <p className="mb-1 font-medium">Pour générer la liste de documents, répondez encore à :</p>
              <ul className="list-disc pl-5 text-slate-500">
                {missingQualif.map((q) => (
                  <li key={q.id}>{q.clientLabel}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-center text-slate-500">Continuez à répondre : la liste de documents s’affichera ensuite.</p>
          )}
        </div>
      )}

      {/* Création de la campagne (persistance). Possible même sans qualification
          complète : le client répondra lui-même aux questions restantes dans son
          espace, et sa liste de documents se mettra à jour. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">
          {qualified ? (
            <>
              {docs.length} document(s) seront demandés à <span className="font-medium text-slate-800">{clientCode}</span> pour {fiscalYear}.
            </>
          ) : (
            <>
              Vous pouvez créer la campagne maintenant : <span className="font-medium text-slate-800">{clientCode}</span> complétera
              lui-même les questions restantes dans son espace.
            </>
          )}
        </p>
        <button type="button" onClick={createCampaign} disabled={isPending || !clientCode} className="btn btn-primary">
          {isPending ? 'Création…' : 'Créer la campagne'}
        </button>
      </div>
    </div>
  );
}
