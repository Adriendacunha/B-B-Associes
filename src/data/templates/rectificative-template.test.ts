// Garde-fou anti-régression de l'arbre de décision « Déclaration rectificative ».
// Vérifie l'intégrité référentielle du template : toute condition pointe vers une
// question existante, toute valeur comparée est un choix valide, et tout document
// référencé existe. Empêche qu'une modification casse l'arbre silencieusement.

import { describe, it, expect } from 'vitest';
import { RECTIFICATIVE_TEMPLATE, QUALIFYING_IDS } from './declaration-rectificative';
import type { Condition, Question } from '@/lib/questionnaire/types';

const T = RECTIFICATIVE_TEMPLATE;
const allQuestions: Question[] = T.sections.flatMap((s) => s.questions);
const questionById = new Map(allQuestions.map((q) => [q.id, q]));
const documentIds = new Set(T.documents.map((d) => d.id));

/** Aplatit une condition en atomes { q, values } (valeurs comparées par eq/in). */
function atoms(cond: Condition | undefined): { q: string; values: string[] }[] {
  if (!cond) return [];
  if ('all' in cond) return cond.all.flatMap(atoms);
  if ('any' in cond) return cond.any.flatMap(atoms);
  if ('not' in cond) return atoms(cond.not);
  if ('answered' in cond) return [{ q: cond.q, values: [] }];
  if ('eq' in cond) return [{ q: cond.q, values: [String(cond.eq)] }];
  if ('in' in cond) return [{ q: cond.q, values: cond.in.map(String) }];
  return [];
}

/** Toutes les conditions du template avec leur provenance (pour messages clairs). */
function allConditions(): { where: string; cond?: Condition }[] {
  const out: { where: string; cond?: Condition }[] = [];
  for (const s of T.sections) {
    out.push({ where: `section ${s.id}`, cond: s.visibilityCondition });
    for (const q of s.questions) out.push({ where: `question ${q.id}`, cond: q.visibilityCondition });
  }
  for (const d of T.documents) out.push({ where: `document ${d.id}`, cond: d.condition });
  return out;
}

describe('Arbre rectificative — intégrité référentielle', () => {
  it('les ids de questions sont uniques', () => {
    const ids = allQuestions.map((q) => q.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('les ids de documents sont uniques', () => {
    const ids = T.documents.map((d) => d.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('toute condition cible une question existante', () => {
    const unknown: string[] = [];
    for (const { where, cond } of allConditions()) {
      for (const a of atoms(cond)) {
        if (!questionById.has(a.q)) unknown.push(`${where} → question inconnue « ${a.q} »`);
      }
    }
    expect(unknown, unknown.join('\n')).toEqual([]);
  });

  it('toute valeur comparée (eq/in) est un choix valide de la question ciblée', () => {
    const invalid: string[] = [];
    for (const { where, cond } of allConditions()) {
      for (const a of atoms(cond)) {
        const q = questionById.get(a.q);
        if (!q?.choices || a.values.length === 0) continue; // text/date/number ou « answered »
        const allowed = new Set(q.choices.map((c) => c.value));
        for (const v of a.values) {
          if (!allowed.has(v)) invalid.push(`${where} → « ${a.q} » n'a pas le choix « ${v} »`);
        }
      }
    }
    expect(invalid, invalid.join('\n')).toEqual([]);
  });

  it('tout document listé dans requiredDocuments existe', () => {
    const missing: string[] = [];
    for (const q of allQuestions) {
      for (const docId of q.requiredDocuments ?? []) {
        if (!documentIds.has(docId)) missing.push(`question ${q.id} → document inconnu « ${docId} »`);
      }
    }
    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('les choix d’une question ont des valeurs uniques', () => {
    const dup: string[] = [];
    for (const q of allQuestions) {
      if (!q.choices) continue;
      const vals = q.choices.map((c) => c.value);
      if (vals.length !== new Set(vals).size) dup.push(`question ${q.id}`);
    }
    expect(dup, dup.join('\n')).toEqual([]);
  });

  it('les questions de qualification (QUALIFYING_IDS) existent', () => {
    const unknown = QUALIFYING_IDS.filter((id) => !questionById.has(id));
    expect(unknown, `QUALIFYING_IDS inconnus : ${unknown.join(', ')}`).toEqual([]);
  });

  it('chaque document est déclenchable (socle sans condition, ou condition à questions connues)', () => {
    // Un document conditionnel dont la condition ne référence aucune question
    // connue ne sera jamais demandé → anomalie.
    const dead: string[] = [];
    for (const d of T.documents) {
      if (!d.condition) continue;
      const refs = atoms(d.condition);
      if (refs.length > 0 && refs.every((a) => !questionById.has(a.q))) dead.push(d.id);
    }
    expect(dead, `documents jamais déclenchables : ${dead.join(', ')}`).toEqual([]);
  });
});
