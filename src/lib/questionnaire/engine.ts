// Moteur d'évaluation du questionnaire (pur, testable). Prend les réponses du
// client et calcule : quelles questions sont visibles, et quels documents sont
// demandés. Aucune dépendance React/DB — réutilisé par les vues client et B&B.

import type { Answers, Condition, DocumentRequest, Question, Section, Template } from './types';

/** Une réponse est « non vide » (answered) ? */
export function isAnswered(value: Answers[string]): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Évalue une condition sérialisable contre les réponses. */
export function evalCondition(cond: Condition | undefined, answers: Answers): boolean {
  if (!cond) return true; // pas de condition = toujours vrai
  if ('all' in cond) return cond.all.every((c) => evalCondition(c, answers));
  if ('any' in cond) return cond.any.some((c) => evalCondition(c, answers));
  if ('not' in cond) return !evalCondition(cond.not, answers);

  const value = answers[cond.q];
  if ('answered' in cond) return isAnswered(value);
  if ('eq' in cond) {
    if (Array.isArray(value)) return value.includes(String(cond.eq));
    return value === cond.eq;
  }
  if ('in' in cond) {
    if (Array.isArray(value)) return value.some((v) => cond.in.includes(String(v)));
    return value !== undefined && value !== null && cond.in.includes(String(value));
  }
  return false;
}

/** La question est-elle visible compte tenu des réponses ? */
export function isQuestionVisible(q: Question, answers: Answers): boolean {
  return evalCondition(q.visibilityCondition, answers);
}

/** Sections visibles, avec leurs seules questions visibles (sections non vides). */
export function visibleSections(template: Template, answers: Answers): Section[] {
  return template.sections
    .filter((s) => evalCondition(s.visibilityCondition, answers))
    .map((s) => ({ ...s, questions: s.questions.filter((q) => isQuestionVisible(q, answers)) }))
    .filter((s) => s.questions.length > 0);
}

/** Toutes les questions visibles, à plat. */
export function visibleQuestions(template: Template, answers: Answers): Question[] {
  return visibleSections(template, answers).flatMap((s) => s.questions);
}

/**
 * Documents demandés : ceux sans condition (socle) + ceux dont la condition est
 * satisfaite. Triés par catégorie puis obligation (obligatoires d'abord).
 */
const OBLIGATION_ORDER: Record<DocumentRequest['obligation'], number> = {
  obligatoire: 0,
  conditionnel: 1,
  recommande: 2,
};

export function requestedDocuments(template: Template, answers: Answers): DocumentRequest[] {
  const docs = template.documents.filter((d) => evalCondition(d.condition, answers));
  return docs.sort(
    (a, b) =>
      a.category.localeCompare(b.category) || OBLIGATION_ORDER[a.obligation] - OBLIGATION_ORDER[b.obligation],
  );
}

/** Les questions d'orientation (ids) sont-elles toutes répondues ? */
export function qualificationComplete(template: Template, answers: Answers, qualifyingIds: string[]): boolean {
  return qualifyingIds.every((id) => {
    // On ne bloque pas sur une question d'orientation devenue invisible.
    const q = template.sections.flatMap((s) => s.questions).find((x) => x.id === id);
    if (q && !isQuestionVisible(q, answers)) return true;
    return isAnswered(answers[id]);
  });
}

/** Regroupe les documents demandés par catégorie fiscale (pour l'affichage). */
export function groupByCategory(docs: DocumentRequest[]): { category: string; docs: DocumentRequest[] }[] {
  const map = new Map<string, DocumentRequest[]>();
  for (const d of docs) {
    const list = map.get(d.category) ?? [];
    list.push(d);
    map.set(d.category, list);
  }
  return [...map.entries()].map(([category, list]) => ({ category, docs: list }));
}
