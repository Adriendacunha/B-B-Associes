// Rendu lisible d'une Condition (vue créateur B&B) : « source = Oui ET motif ∈ {…} ».
// Pur et testable. Les libellés de questions/valeurs sont résolus par l'appelant
// (à partir du template) pour rester générique.

import type { Condition, Template } from './types';

export interface DescribeResolvers {
  label: (questionId: string) => string;
  value: (questionId: string, value: string) => string;
}

export function describeCondition(cond: Condition | undefined, r: DescribeResolvers): string {
  if (!cond) return 'Toujours';
  if ('all' in cond) return cond.all.map((c) => wrap(c, r)).join(' ET ');
  if ('any' in cond) return cond.any.map((c) => wrap(c, r)).join(' OU ');
  if ('not' in cond) return `NON (${describeCondition(cond.not, r)})`;
  if ('answered' in cond) return `${r.label(cond.q)} renseigné`;
  if ('eq' in cond) return `${r.label(cond.q)} = ${r.value(cond.q, String(cond.eq))}`;
  if ('in' in cond) return `${r.label(cond.q)} ∈ {${cond.in.map((v) => r.value(cond.q, v)).join(', ')}}`;
  return '?';
}

function wrap(cond: Condition, r: DescribeResolvers): string {
  const inner = describeCondition(cond, r);
  return 'all' in cond || 'any' in cond ? `(${inner})` : inner;
}

/** Construit des résolveurs libellé/valeur à partir d'un template. */
export function templateResolvers(template: Template): DescribeResolvers {
  const questions = template.sections.flatMap((s) => s.questions);
  const byId = new Map(questions.map((q) => [q.id, q]));
  return {
    label: (id) => byId.get(id)?.question ?? id,
    value: (id, value) => byId.get(id)?.choices?.find((c) => c.value === value)?.label ?? value,
  };
}
