import { AlertTriangle, FileText } from 'lucide-react';
import type { DocObligation, RiskLevel } from '@/lib/questionnaire/types';
import { describeCondition, templateResolvers } from '@/lib/questionnaire/describe';
import { RECTIFICATIVE_TEMPLATE as T } from '@/data/templates/declaration-rectificative';

const RISK_BADGE: Record<RiskLevel, { cls: string; label: string }> = {
  low: { cls: 'bg-slate-100 text-slate-600', label: 'Risque faible' },
  medium: { cls: 'bg-amber-100 text-amber-800', label: 'Risque moyen' },
  high: { cls: 'bg-red-100 text-red-700', label: 'Risque élevé' },
};

const OBLIGATION_BADGE: Record<DocObligation, { cls: string; label: string }> = {
  obligatoire: { cls: 'bg-red-100 text-red-700', label: 'Obligatoire' },
  conditionnel: { cls: 'bg-amber-100 text-amber-800', label: 'Conditionnel' },
  recommande: { cls: 'bg-slate-200 text-slate-600', label: 'Recommandé' },
};

const ANSWER_TYPE_LABEL: Record<string, string> = {
  boolean: 'Oui/Non',
  single: 'Choix unique',
  multi: 'Choix multiple',
  text: 'Texte',
  number: 'Nombre',
  date: 'Date',
};

/**
 * Vue créateur B&B : inspecte le MODÈLE et la LOGIQUE fiscale du template —
 * conditions de visibilité, notes internes, niveaux de risque, traçabilité des
 * documents et synthèse. Lecture seule (la construction éditable viendra ensuite).
 */
export function RectificativeCreatorView() {
  const r = templateResolvers(T);
  const docById = new Map(T.documents.map((d) => [d.id, d]));

  // Documents groupés par catégorie (catalogue complet, vue modèle).
  const categories = [...new Set(T.documents.map((d) => d.category))];

  const counts = {
    obligatoire: T.documents.filter((d) => d.obligation === 'obligatoire').length,
    conditionnel: T.documents.filter((d) => d.obligation === 'conditionnel').length,
    recommande: T.documents.filter((d) => d.obligation === 'recommande').length,
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <span className="badge bg-amber-100 text-amber-800">Vue créateur B&amp;B — logique interne</span>
        <h1 className="text-2xl font-bold text-slate-900">{T.title}</h1>
        <p className="max-w-2xl text-sm text-slate-600">{T.description}</p>
      </header>

      {/* Alertes métier modélisées */}
      <div className="card space-y-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <AlertTriangle className="h-4 w-4 text-amber-600" strokeWidth={1.75} /> Règles d’aiguillage
        </h2>
        <ul className="space-y-1 text-xs text-slate-600">
          <li>
            <strong>Bascule DRIS → TOU</strong> : si <code>source = Oui</code> et qu’une déduction effective est cochée
            (3e pilier, rachat LPP, garde, formation…), alerter le client : la demande relève d’une TOU.
          </li>
          <li>
            <strong>Pas une rectification</strong> : si <code>dejaDeposee = Non</code>, orienter vers une campagne de
            déclaration standard.
          </li>
        </ul>
      </div>

      {/* Sections → questions, avec logique conditionnelle exposée */}
      {T.sections.map((s) => (
        <section key={s.id} className="card space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-base font-semibold text-slate-900">{s.title}</h2>
            <p className="text-xs text-slate-500">
              Côté client : « {s.clientTitle ?? s.title} » · Affichée si : <span className="font-medium text-slate-600">{describeCondition(s.visibilityCondition, r)}</span>
            </p>
          </div>

          <div className="space-y-4">
            {s.questions.map((q) => (
              <div key={q.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{q.question}</p>
                    <p className="text-xs text-slate-500">Côté client : « {q.clientLabel} »</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="badge bg-slate-100 text-slate-500">{ANSWER_TYPE_LABEL[q.answerType] ?? q.answerType}</span>
                    {q.riskLevel && <span className={`badge ${RISK_BADGE[q.riskLevel].cls}`}>{RISK_BADGE[q.riskLevel].label}</span>}
                  </div>
                </div>

                {q.helpText && <p className="mt-1 text-xs italic text-slate-400">{q.helpText}</p>}

                <dl className="mt-2 space-y-1 text-xs">
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-medium text-slate-400">Visible si</dt>
                    <dd className="text-slate-600">{describeCondition(q.visibilityCondition, r)}</dd>
                  </div>
                  {q.choices && (
                    <div className="flex gap-2">
                      <dt className="shrink-0 font-medium text-slate-400">Réponses</dt>
                      <dd className="flex flex-wrap gap-1">
                        {q.choices.map((c) => (
                          <span key={c.value} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                            {c.label}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                  {q.requiredDocuments && q.requiredDocuments.length > 0 && (
                    <div className="flex gap-2">
                      <dt className="shrink-0 font-medium text-slate-400">Déclenche</dt>
                      <dd className="flex flex-wrap gap-1">
                        {q.requiredDocuments.map((id) => (
                          <span key={id} className="rounded bg-brand/10 px-1.5 py-0.5 text-[11px] text-brand">
                            {docById.get(id)?.clientLabel ?? id}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>

                {q.bbInternalNote && (
                  <p className="mt-2 rounded-md border border-amber-100 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                    <span className="font-semibold">Logique fiscale :</span> {q.bbInternalNote}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Catalogue documents (modèle complet) */}
      <section className="card space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Documents du modèle</h2>
        {categories.map((cat) => (
          <div key={cat}>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{cat}</h3>
            <ul className="space-y-2">
              {T.documents
                .filter((d) => d.category === cat)
                .map((d) => {
                  const b = OBLIGATION_BADGE[d.obligation];
                  return (
                    <li key={d.id} className="rounded-lg border border-slate-200 p-2.5 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} />
                          {d.clientLabel}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className={`badge ${b.cls}`}>{b.label}</span>
                          <span className="badge bg-slate-100 text-slate-500">manquant</span>
                        </div>
                      </div>
                      <p className="mt-1 text-slate-500">
                        <span className="font-medium text-slate-600">Pourquoi :</span> {d.reason}
                      </p>
                      <p className="mt-0.5 text-slate-500">
                        <span className="font-medium text-slate-600">Demandé si :</span> {describeCondition(d.condition, r)}
                        {' · '}
                        <span className="uppercase tracking-wide text-slate-400">{d.acceptedFormats.join(' · ')}</span>
                      </p>
                      <p className="mt-0.5 italic text-slate-400">Relance : « {d.reminderMessage} »</p>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </section>

      {/* Synthèse finale */}
      <section className="card space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Synthèse du dossier</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="badge bg-red-100 text-red-700">{counts.obligatoire} obligatoire(s)</span>
          <span className="badge bg-amber-100 text-amber-800">{counts.conditionnel} conditionnel(s)</span>
          <span className="badge bg-slate-200 text-slate-600">{counts.recommande} recommandé(s)</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { k: 'Reçus', cls: 'text-green-700' },
            { k: 'Manquants', cls: 'text-slate-700' },
            { k: 'À corriger', cls: 'text-amber-700' },
            { k: 'Validés', cls: 'text-brand' },
          ].map((s) => (
            <div key={s.k} className="rounded-lg border border-slate-200 p-3 text-center">
              <div className={`text-lg font-bold ${s.cls}`}>—</div>
              <div className="text-[11px] text-slate-500">{s.k}</div>
            </div>
          ))}
        </div>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-semibold">Risque de délai :</span> à Genève, le dépôt DRIS/TOU doit intervenir au plus tard
          le <strong>31 mars</strong> de l’année suivant l’imposition, même si tous les justificatifs ne sont pas encore disponibles.
        </p>
        <p className="text-[11px] text-slate-400">
          Les statuts (reçus / à corriger / validés) seront alimentés une fois la campagne créée et les dépôts connectés.
        </p>
      </section>
    </div>
  );
}
