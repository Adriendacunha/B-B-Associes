'use client';

import { useMemo, useState, useTransition } from 'react';
import type { Answers, Section } from '@/lib/questionnaire/types';
import { visibleSections } from '@/lib/questionnaire/engine';
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

  if (sections.length === 0) return null;

  return (
    <section className="card space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Compléter votre déclaration</h2>
        <p className="text-xs text-slate-500">
          Répondez à ces questions : elles déterminent la liste des documents à fournir. Votre identité reste saisie
          dans « Mes informations ».
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
