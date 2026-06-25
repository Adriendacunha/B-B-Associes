// Génère la documentation de l'arbre « Déclaration rectificative » À PARTIR du
// template (source de vérité) : sections/questions + tableau des pièces et leurs
// conditions, dérivés automatiquement → la doc ne peut plus diverger du code.
//
// Usage : npx tsx scripts/generate-rectificative-doc.ts  (puis rendu PNG du .mmd)

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RECTIFICATIVE_TEMPLATE as T } from '../src/data/templates/declaration-rectificative';
import type { Condition } from '../src/lib/questionnaire/types';

const OBLIGATION = { obligatoire: '**obligatoire**', conditionnel: 'conditionnel', recommande: 'recommandé' } as const;

/** Rend une condition en texte lisible. */
function cond(c: Condition | undefined): string {
  if (!c) return '— (toujours)';
  if ('all' in c) return c.all.map(cond).join(' ET ');
  if ('any' in c) return c.any.map(cond).join(' OU ');
  if ('not' in c) return `NON(${cond(c.not)})`;
  if ('answered' in c) return `\`${c.q}\` répondu`;
  if ('eq' in c) return `\`${c.q}\` = ${c.eq}`;
  if ('in' in c) return `\`${c.q}\` ∈ {${c.in.join(', ')}}`;
  return '?';
}

const ESC = (s: string) => s.replace(/\|/g, '\\|');

function questionsTable(): string {
  const lines: string[] = [];
  for (const s of T.sections) {
    lines.push(`\n### Section « ${s.title} »  \`(${s.id})\``);
    if (s.visibilityCondition) lines.push(`\n_Visible si : ${cond(s.visibilityCondition)}_\n`);
    lines.push('| Question (id) | Type | Visible si | Déclenche |');
    lines.push('| --- | --- | --- | --- |');
    for (const q of s.questions) {
      const trig = q.requiredDocuments?.length ? q.requiredDocuments.map((d) => `\`${d}\``).join(', ') : '—';
      lines.push(`| ${ESC(q.question)} \`(${q.id})\` | ${q.answerType} | ${q.visibilityCondition ? cond(q.visibilityCondition) : '—'} | ${trig} |`);
    }
  }
  return lines.join('\n');
}

function documentsTable(): string {
  const lines = ['| Pièce (id) | Catégorie | Obligation | Demandée si |', '| --- | --- | --- | --- |'];
  for (const d of T.documents) {
    lines.push(`| ${ESC(d.clientLabel)} \`(${d.id})\` | ${d.category} | ${OBLIGATION[d.obligation]} | ${cond(d.condition)} |`);
  }
  return lines.join('\n');
}

const MERMAID = `flowchart TD
  START([Début]) --> TYPE{{"typeDeclaration ?<br/>Ordinaire ou rectification ?"}}
  TYPE --> SRC{{"source ?<br/>Imposé à la source ?"}}

  SRC -- "oui ET rectification" --> DRIS["🟦 Branche DRIS<br/>(rectifier l'impôt à la source)"]:::branch
  SRC -- "non, OU ordinaire" --> TOU["🟩 Branche TOU<br/>(taxation ordinaire)"]:::branch

  TOU --> QR{{"touQuasiResident ?<br/>(si non-résident) ≥ 90 % en CH ?"}}
  QR -- non --> NELIG["⛔ Quasi-résident non éligible<br/>→ DRIS standard (stop)"]:::stop
  QR -- oui --> TOUOK["Checklist TOU complète"]

  DRIS --> DEDUC{{"drisDeductionsEffectives ?"}}
  DEDUC -- coché --> BASCULE["⚠️ Bascule DRIS → TOU"]:::stop

  classDef stop fill:#fee2e2,stroke:#ef4444,color:#7f1d1d;
  classDef branch fill:#eef2ff,stroke:#6366f1,color:#312e81;`;

async function main() {
  const dir = path.resolve(process.cwd(), 'docs');
  const counts = T.documents.reduce(
    (a, d) => ((a[d.obligation] = (a[d.obligation] ?? 0) + 1), a),
    {} as Record<string, number>,
  );

  const md = `# Arbre de décision — « Déclaration rectificative »

> ⚙️ **Document généré** par \`scripts/generate-rectificative-doc.ts\` à partir du template
> (\`src/data/templates/declaration-rectificative.ts\`). Ne pas éditer à la main : relancer le script.
> Conditions évaluées par \`evalCondition\` (\`src/lib/questionnaire/engine.ts\`).

Assistant **conditionnel** : un gate + des règles \`IF condition THEN documents\`. Deux branches selon
l'imposition à la source — **DRIS** (impôt à la source) et **TOU** (déclaration ordinaire, dont
quasi-résidents). Échéance GE : dépôt au plus tard le **31 mars** de l'année N+1.

Total : **${T.documents.length} pièces** (${counts.obligatoire ?? 0} obligatoires · ${counts.conditionnel ?? 0} conditionnelles · ${counts.recommande ?? 0} recommandées) sur ${T.sections.length} sections.

## 1. Vue d'ensemble

\`\`\`mermaid
${MERMAID}
\`\`\`

## 2. Court-circuits « durs » (logique, pas seulement affichage)

- **\`notRectificativeAlert\`** — \`dejaDeposee\` = non → ce n'est pas une rectification (ouvrir une déclaration standard).
- **\`drisToTouAlert\`** — \`source\` = oui **ET** \`drisDeductionsEffectives\` répondu → bascule DRIS → TOU.
- **\`notEligibleTouAlert\`** — \`statutResidence\` = non_resident **ET** \`touQuasiResident\` = non → quasi-résident non éligible → DRIS standard (arrêt de la collecte TOU).

## 3. Questions par section
${questionsTable()}

## 4. Catalogue des pièces (condition de déclenchement)

${documentsTable()}
`;

  await writeFile(path.join(dir, 'arbre-decision-rectificative.md'), md);
  await writeFile(path.join(dir, 'arbre-decision-rectificative.mmd'), MERMAID + '\n');
  console.log(`✓ docs/arbre-decision-rectificative.md (${T.documents.length} pièces, ${T.sections.length} sections)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
