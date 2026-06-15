'use client';

import type { Answers, Question } from '@/lib/questionnaire/types';

/** Champ de saisie d'une question (partagé qualification cabinet / intake client). */
export function QuestionField({
  q,
  value,
  onChange,
}: {
  q: Question;
  value: Answers[string];
  onChange: (v: Answers[string]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-800">{q.clientLabel}</label>
      {q.helpText && <p className="text-xs text-slate-500">{q.helpText}</p>}

      {q.answerType === 'single' && q.choices && (
        <div className="flex flex-wrap gap-2">
          {q.choices.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => onChange(c.value)}
              className={`btn btn-sm ${value === c.value ? 'btn-primary' : 'btn-secondary'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {q.answerType === 'multi' && q.choices && (
        <div className="flex flex-wrap gap-2">
          {q.choices.map((c) => {
            const arr = Array.isArray(value) ? value : [];
            const on = arr.includes(c.value);
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => onChange(on ? arr.filter((v) => v !== c.value) : [...arr, c.value])}
                className={`btn btn-sm ${on ? 'btn-primary' : 'btn-secondary'}`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {q.answerType === 'text' && (
        <input type="text" className="input max-w-md" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
      )}
      {q.answerType === 'number' && (
        <input
          type="number"
          className="input max-w-[12rem]"
          value={(value as number) ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      )}
      {q.answerType === 'date' && (
        <input type="date" className="input max-w-[14rem]" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
