// Générateur de documents de test (PDF à texte intégré) pour éprouver le pipeline
// dépôt → extraction (pdf-parse) → analyse IA (stub déterministe ou API Claude)
// → validation humaine. Les PDF portent un contenu réaliste : nom de la pièce,
// année fiscale attendue (en tenant compte du décalage par pièce) et quelques
// champs crédibles. Certains cas sont volontairement NON CONFORMES.
//
// Usage : npx tsx scripts/generate-test-documents.ts [anneeFiscale] [dossierSortie]
//   défaut : 2024  test-documents/

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PIECE_REFERENTIAL, findPiece } from '../src/data/piece-referential';
import { resolveLocalized } from '../src/lib/i18n/locales';

const CAMPAIGN_YEAR = Number(process.argv[2] ?? 2024);
const OUT_DIR = path.resolve(process.cwd(), process.argv[3] ?? 'test-documents');

// Année attendue pour une pièce = année de campagne + décalage de la pièce.
function expectedYear(code: string): number {
  return CAMPAIGN_YEAR + (findPiece(code)?.expectedYearOffset ?? 0);
}
function pieceNameFr(code: string): string {
  const p = findPiece(code);
  return p ? resolveLocalized(p.nom, 'fr') : code;
}

interface DocSpec {
  file: string; // nom de fichier (réaliste, sans le code)
  title: string; // titre affiché en tête du PDF
  lines: string[]; // corps
  expect: 'CONFORME' | 'NON_CONFORME';
  uploadTo: string; // code de pièce cible suggéré
  why: string; // attendu / raison
}

// Émetteurs / personnes fictifs (aucune donnée réelle).
const CLIENT = 'Jean Dupont';

function conforme(code: string, file: string, extra: string[]): DocSpec {
  const y = expectedYear(code);
  return {
    file,
    title: `${pieceNameFr(code).toUpperCase()} — ${y}`,
    lines: [
      `Annee fiscale : ${y}`,
      `Contribuable : ${CLIENT}`,
      `Reference piece : ${code}`,
      ...extra,
    ],
    expect: 'CONFORME',
    uploadTo: code,
    why: `Type « ${code} » + annee ${y} present(e)s -> conforme`,
  };
}

// Jeu de documents : un cas conforme par pièce représentative de chaque catégorie.
const DOCS: DocSpec[] = [
  conforme('IDENT-FISCAL', 'identifiant-fiscal.pdf', [
    'Numero de contribuable : 12.3456.7890',
    'Code de declaration : GE-2024-778941',
    'Administration fiscale cantonale (AFC-GE)',
  ]),
  conforme('DECL-N1', 'declaration-annee-precedente.pdf', [
    'Declaration et taxation de l annee precedente',
    'Revenu imposable : 78 200 CHF',
    'Fortune imposable : 145 000 CHF',
  ]),
  conforme('CERT-SALAIRE', 'certificat-salaire-acme.pdf', [
    'Employeur : ACME Services SA, Geneve',
    'Salaire brut : 95 400 CHF',
    'Retenue impot a la source : 0 CHF',
    'Cotisations AVS/AI/APG, LPP, assurance chomage incluses',
  ]),
  conforme('RELEVE-BANCAIRE', 'releve-bancaire-31-12.pdf', [
    'Releve bancaire au 31.12',
    'Compte prive CH93 0076 ... solde : 12 480.55 CHF',
    'Interets crediteurs : 14.20 CHF',
  ]),
  conforme('LAMAL', 'attestation-lamal-primes.pdf', [
    'Attestation fiscale LAMal et LAA',
    'Primes payees dans l annee : 4 932 CHF',
    'Assureur : Helvetia Sante',
  ]),
  conforme('ETAT-TITRES', 'etat-des-titres-banque.pdf', [
    'Etat des titres / releve fiscal',
    'Dividendes : 1 250 CHF  -  Interets : 320 CHF',
    'Valeur des titres au 31.12 : 64 000 CHF',
  ]),
  conforme('ATTEST-RENTES', 'attestation-rentes-avs.pdf', [
    'Attestation de rentes AVS/AI et LPP',
    'Rente annuelle versee : 28 440 CHF',
  ]),
  conforme('3A', 'attestation-3a-pilier.pdf', [
    'Attestation 3e pilier A (prevoyance liee)',
    'Montant verse dans l annee : 7 056 CHF',
    'Institution : Banque Cantonale - Fondation 3a',
  ]),
  conforme('FRAIS-GARDE', 'frais-garde-creche.pdf', [
    'Attestation frais de garde des enfants',
    'Structure : Creche Les Petits Pas',
    'Total facture dans l annee : 9 800 CHF',
  ]),
  conforme('DONS', 'attestation-dons.pdf', [
    'Attestation de dons',
    'Organisme reconnu d utilite publique',
    'Total des dons : 600 CHF',
  ]),
  conforme('ALLOC-FAMILIALES', 'allocations-familiales.pdf', [
    'Attestation d allocations familiales',
    'Total percu dans l annee : 4 800 CHF',
    'Caisse d allocations familiales',
  ]),
  conforme('IMMO-HYPO', 'valeur-locative-hypotheque.pdf', [
    'Valeur locative et interets hypothecaires',
    'Interets hypothecaires payes : 8 900 CHF',
    'Dette hypothecaire au 31.12 : 520 000 CHF',
  ]),
  conforme('IMMO-IIC', 'avis-taxation-immobilier-iic.pdf', [
    'Avis de taxation immobilier (impot immobilier complementaire IIC)',
    'Valeur fiscale du bien : 740 000 CHF',
  ]),
  conforme('PENSIONS', 'pensions-alimentaires-versees.pdf', [
    'Justificatif de pensions alimentaires versees',
    'Beneficiaire : ex-conjoint  -  Total : 14 400 CHF',
  ]),

  // ─────── Cas NON CONFORMES (volontaires) ───────
  {
    file: 'certificat-salaire-mauvaise-annee.pdf',
    title: `CERTIFICAT DE SALAIRE — ${CAMPAIGN_YEAR - 2}`,
    lines: [
      `Annee fiscale : ${CAMPAIGN_YEAR - 2}`,
      'Employeur : ACME Services SA',
      'Salaire brut : 91 000 CHF',
      'Reference piece : CERT-SALAIRE',
    ],
    expect: 'NON_CONFORME',
    uploadTo: 'CERT-SALAIRE',
    why: `Mauvaise annee (${CAMPAIGN_YEAR - 2} au lieu de ${CAMPAIGN_YEAR}) -> anomalie MAUVAISE_ANNEE`,
  },
  {
    file: 'facture-restaurant.pdf',
    title: 'FACTURE RESTAURANT LE LEMAN',
    lines: [
      'Table 12 - 2 couverts',
      'Menu du jour x2 : 96 CHF',
      'Merci de votre visite',
    ],
    expect: 'NON_CONFORME',
    uploadTo: 'CERT-SALAIRE',
    why: 'Mauvais type (ni « salaire » ni « cert ») -> anomalie MAUVAIS_TYPE ; ideal aussi pour le tri auto / file « A trier »',
  },
];

async function buildPdf(spec: DocSpec): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 56;
  let y = 770;

  page.drawText('DOCUMENT DE TEST — B&B Associes', { x: margin, y, size: 9, font, color: rgb(0.6, 0.6, 0.6) });
  y -= 30;
  page.drawText(spec.title, { x: margin, y, size: 15, font: bold, color: rgb(0.1, 0.1, 0.2) });
  y -= 12;
  page.drawLine({ start: { x: margin, y }, end: { x: 539, y }, thickness: 1, color: rgb(0.8, 0.8, 0.85) });
  y -= 28;
  for (const line of spec.lines) {
    page.drawText(line, { x: margin, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
    y -= 20;
  }
  y -= 16;
  page.drawText('Document fictif genere pour les tests — aucune donnee reelle.', {
    x: margin, y, size: 8, font, color: rgb(0.6, 0.6, 0.6),
  });
  return pdf.save();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const manifest: string[] = [
    `# Documents de test — année de campagne ${CAMPAIGN_YEAR}`,
    '',
    'Déposez chaque fichier sur la pièce indiquée (colonne « Déposer sur »).',
    'L\'analyse (stub déterministe sans clé API, ou Claude si `ANTHROPIC_API_KEY`)',
    'doit produire le verdict attendu.',
    '',
    '| Fichier | Déposer sur | Verdict attendu | Pourquoi |',
    '| --- | --- | --- | --- |',
  ];

  for (const spec of DOCS) {
    const bytes = await buildPdf(spec);
    await writeFile(path.join(OUT_DIR, spec.file), bytes);
    manifest.push(`| \`${spec.file}\` | ${spec.uploadTo} | ${spec.expect} | ${spec.why} |`);
    console.log(`  ✓ ${spec.file}  (${spec.expect})`);
  }

  await writeFile(path.join(OUT_DIR, 'README.md'), manifest.join('\n') + '\n');
  console.log(`\n${DOCS.length} documents + README.md écrits dans ${OUT_DIR}`);
  console.log(`Pièces couvertes (référentiel) : ${PIECE_REFERENTIAL.length} définies au total.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
