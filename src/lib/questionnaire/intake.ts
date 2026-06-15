// Formulaire d'intake : les questions « données du dossier » (clientData) sont
// remplies par le CLIENT dans son espace, séparément de la qualification du
// cabinet. Les réponses sont fusionnées dans le même blob `answers` de la campagne.

import type { Answers, Question, Template } from './types';
import { isAnswered, visibleQuestions } from './engine';

/** Questions d'intake visibles (clientData) compte tenu des réponses actuelles. */
export function intakeQuestions(template: Template, answers: Answers): Question[] {
  return visibleQuestions(template, answers).filter((q) => q.clientData);
}

/** Toutes les questions d'intake visibles ont-elles une réponse ? */
export function intakeComplete(template: Template, answers: Answers): boolean {
  const qs = intakeQuestions(template, answers);
  return qs.length > 0 && qs.every((q) => isAnswered(answers[q.id]));
}

/** Récapitulatif lisible (vue cabinet) des informations fournies par le client. */
export function intakeSummary(template: Template, answers: Answers): { label: string; value: string }[] {
  return intakeQuestions(template, answers).map((q) => {
    const raw = answers[q.id];
    let value = '—';
    if (Array.isArray(raw)) {
      value = raw.map((v) => q.choices?.find((c) => c.value === v)?.label ?? v).join(', ') || '—';
    } else if (isAnswered(raw)) {
      value = q.choices?.find((c) => c.value === String(raw))?.label ?? String(raw);
    }
    return { label: q.clientLabel, value };
  });
}
