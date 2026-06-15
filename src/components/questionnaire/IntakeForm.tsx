'use client';

import { useState, useTransition } from 'react';
import type { Answers, Question } from '@/lib/questionnaire/types';
import { QuestionField } from '@/components/questionnaire/QuestionField';
import { saveIntakeAnswers } from '@/app/actions/campaign';
import type { AppLocale } from '@/lib/i18n/locales';

/** Formulaire d'intake côté client : données du dossier (séparé de la qualification). */
export function IntakeForm({
  locale,
  campaignId,
  questions,
  initial,
}: {
  locale: AppLocale;
  campaignId: string;
  questions: Question[];
  initial: Answers;
}) {
  const [answers, setAnswers] = useState<Answers>(initial);
  const [isPending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const set = (id: string, v: Answers[string]) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    setSaved(false);
  };
  const save = () =>
    start(async () => {
      await saveIntakeAnswers({ locale, campaignId, answers });
      setSaved(true);
    });

  if (questions.length === 0) return null;

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Vos informations</h2>
        <p className="text-xs text-slate-500">Quelques informations pour compléter votre dossier.</p>
      </div>
      {questions.map((q) => (
        <QuestionField key={q.id} q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
      ))}
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={isPending} className="btn btn-primary btn-sm">
          {isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {saved && <span className="text-xs text-green-700">Enregistré ✓</span>}
      </div>
    </section>
  );
}
