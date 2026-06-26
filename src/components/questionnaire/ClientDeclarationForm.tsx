'use client';

import { useMemo, useState, useTransition } from 'react';
import type { Answers, Section } from '@/lib/questionnaire/types';
import { requestedDocuments, visibleSections } from '@/lib/questionnaire/engine';
import { RECTIFICATIVE_TEMPLATE as T } from '@/data/templates/declaration-rectificative';
import { QuestionField } from '@/components/questionnaire/QuestionField';
import { saveClientQuestionnaire } from '@/app/actions/campaign';
import type { AppLocale } from '@/lib/i18n/locales';

/**
 * Questionnaire de déclaration côté client : présente toutes les questions visibles
 * que le cabinet n'a PAS verrouillées (cabinetKeys), avec révélation en direct des
 * sections suivantes. L'enregistrement met à jour la liste de documents (checklist).
 */
export function ClientDeclarationForm({
  locale,
  campaignId,
  initial,
  lockedIds,
}: {
  locale: AppLocale;
  campaignId: string;
  initial: Answers;
  lockedIds: string[];
}) {
  const [answers, setAnswers] = useState<Answers>(initial);
  const [isPending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const locked = useMemo(() => new Set(lockedIds), [lockedIds]);

  const set = (id: string, v: Answers[string]) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    setSaved(false);
  };

  // Sections visibles, en ne gardant que les questions non verrouillées par le cabinet.
  const sections = useMemo(
    () =>
      visibleSections(T, answers)
        .map((s) => ({ ...s, questions: s.questions.filter((q) => !locked.has(q.id)) }))
        .filter((s) => s.questions.length > 0),
    [answers, locked],
  );

  const save = () =>
    start(async () => {
      const payload: Answers = {};
      for (const [k, v] of Object.entries(answers)) if (!locked.has(k)) payload[k] = v;
      await saveClientQuestionnaire({ locale, campaignId, answers: payload });
      setSaved(true);
    });

  const docCount = useMemo(() => requestedDocuments(T, answers).length, [answers]);

  if (sections.length === 0) return null;

  return (
    <section className="card space-y-5 border-brand/40 bg-brand/5">
      <div className="space-y-1">
        <span className="badge bg-brand/10 text-brand">À faire en premier</span>
        <h2 className="text-base font-semibold text-slate-900">Quelques questions pour générer votre liste de documents</h2>
        <p className="text-xs text-slate-600">
          Vos réponses déterminent les pièces à fournir.{' '}
          {docCount > 0
            ? `${docCount} document(s) demandé(s) à ce stade — la liste se complète au fil de vos réponses.`
            : 'Répondez à ces questions pour faire apparaître votre liste.'}{' '}
          Votre identité reste saisie dans « Mes informations ».
        </p>
      </div>

      {sections.map((s: Section) => (
        <div key={s.id} className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{s.clientTitle ?? s.title}</h3>
          {s.questions.map((q) => (
            <QuestionField key={q.id} q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
          ))}
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={isPending} className="btn btn-primary btn-sm">
          {isPending ? 'Enregistrement…' : 'Enregistrer mes réponses'}
        </button>
        {saved && <span className="text-xs text-green-700">Enregistré ✓ — votre liste de documents est à jour.</span>}
      </div>
    </section>
  );
}
