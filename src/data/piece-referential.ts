// Référentiel par défaut des pièces — contexte fiscal genevois (GeTax / AFC-GE).
// Voir §4.2 du brief. CE RÉFÉRENTIEL EST ÉDITABLE par le cabinet (ajout/retrait/
// renommage, association à un profil) via l'interface d'administration.
//
// Chaque pièce porte ses métadonnées (§4.2) :
//  code, category (sous-dossier OneDrive §5.2), profils (tags §4.1),
//  requiredByDefault, modeValidation (MVP: HUMAIN_REQUIS §4.2), acceptedFormats,
//  expectedYearOffset, et textes FR/EN/DE (nom/description/texteAide §3).

import type { LocalizedText } from '@/lib/i18n/locales';
import { PROFILE_TAGS } from '@/lib/checklist/profiling';

export type PieceCategoryKey =
  | 'REVENUS'
  | 'TITRES_FORTUNE'
  | 'IMMOBILIER'
  | 'DEDUCTIONS'
  | 'FAMILLE'
  | 'INDEP_SOCIETE'
  | 'A_TRIER';

export type ModeValidationKey = 'HUMAIN_REQUIS' | 'AUTO_AUTORISE';

export interface PieceReferentialEntry {
  code: string;
  category: PieceCategoryKey;
  profils: string[];
  requiredByDefault: boolean;
  modeValidation: ModeValidationKey;
  acceptedFormats: string[];
  expectedYearOffset: number;
  signatureRequired?: boolean;
  nom: LocalizedText;
  description: LocalizedText;
  texteAide: LocalizedText;
}

const T = PROFILE_TAGS;
const PDF = ['pdf'];
const PDF_IMG = ['pdf', 'jpg', 'png'];

// Raccourci pour construire les textes (FR obligatoire ; EN/DE traduits).
function tx(fr: string, en: string, de: string): LocalizedText {
  return { fr, en, de };
}

// Pièce SYSTÈME « À trier » : reçoit les documents déposés en vrac que l'IA n'a
// pas su classer. Le tag de profil ne correspond à aucun client → jamais ajoutée
// automatiquement aux checklists ; créée à la demande par le dépôt groupé.
export const A_TRIER_CODE = 'A-TRIER';

export const PIECE_REFERENTIAL: PieceReferentialEntry[] = [
  {
    code: A_TRIER_CODE,
    category: 'A_TRIER',
    profils: ['__SYSTEME__'],
    requiredByDefault: false,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF_IMG,
    expectedYearOffset: 0,
    nom: tx('À trier / Non classé', 'To sort / Unclassified', 'Zu sortieren / Nicht klassifiziert'),
    description: tx(
      'Document déposé en vrac, non classé automatiquement — à rattacher manuellement à une pièce.',
      'Bulk-uploaded document not auto-sorted — to be attached manually to an item.',
      'Massenhochgeladenes, nicht automatisch sortiertes Dokument — manuell zuzuordnen.',
    ),
    texteAide: tx('Le cabinet rattachera ce document à la bonne pièce.', 'The firm will attach this document to the right item.', 'Die Kanzlei ordnet dieses Dokument dem richtigen Posten zu.'),
  },
  // ─────────── A. Particuliers — Identité & base ───────────
  {
    code: 'DECL-N1',
    category: 'A_TRIER',
    profils: [T.PARTICULIER, T.NOUVEAU_CLIENT],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: -1,
    nom: tx(
      'Déclaration et taxation de l’année précédente',
      'Previous year tax return and assessment',
      'Steuererklärung und Veranlagung des Vorjahres',
    ),
    description: tx(
      'Copie de la déclaration et de la taxation de l’année précédente (nouveaux clients).',
      'Copy of the previous year tax return and assessment (new clients).',
      'Kopie der Steuererklärung und Veranlagung des Vorjahres (Neukunden).',
    ),
    texteAide: tx(
      'Document remis par l’administration fiscale l’an dernier.',
      'Document issued by the tax authority last year.',
      'Vom letzten Jahr von der Steuerbehörde ausgestelltes Dokument.',
    ),
  },
  {
    code: 'ATTEST-DOMICILE',
    category: 'A_TRIER',
    profils: [T.PARTICULIER],
    requiredByDefault: false,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF_IMG,
    expectedYearOffset: 0,
    nom: tx('Attestation de domicile', 'Proof of residence', 'Wohnsitzbescheinigung'),
    description: tx(
      'Attestation de domicile / justificatif de changement d’adresse le cas échéant.',
      'Proof of residence / change of address if applicable.',
      'Wohnsitzbescheinigung / Nachweis einer Adressänderung falls zutreffend.',
    ),
    texteAide: tx('À demander auprès de votre commune.', 'Request it from your municipality.', 'Bei Ihrer Gemeinde anzufordern.'),
  },
  {
    code: 'ATTEST-RESIDENCE-ETR',
    category: 'A_TRIER',
    profils: [T.PARTICULIER, T.QUASI_RESIDENT],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx(
      'Attestation de résidence (pays de domicile)',
      'Certificate of residence (country of domicile)',
      'Wohnsitzbescheinigung (Wohnsitzland)',
    ),
    description: tx(
      'Justificatif de la part des revenus réalisée en Suisse et attestation de résidence du pays de domicile (quasi-résidents / frontaliers).',
      'Proof of the share of income earned in Switzerland and certificate of residence of the country of domicile (quasi-residents / cross-border workers).',
      'Nachweis des in der Schweiz erzielten Einkommensanteils und Wohnsitzbescheinigung des Wohnsitzlandes (Quasi-Ansässige / Grenzgänger).',
    ),
    texteAide: tx(
      'Formulaire visé par l’administration fiscale de votre pays de résidence.',
      'Form stamped by the tax authority of your country of residence.',
      'Vom Steueramt Ihres Wohnsitzlandes abgestempeltes Formular.',
    ),
  },

  // ─────────── A. Revenus ───────────
  {
    code: 'CERT-SALAIRE',
    category: 'REVENUS',
    profils: [T.REVENU_SALARIE],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF_IMG,
    expectedYearOffset: 0,
    nom: tx('Certificat de salaire', 'Salary certificate', 'Lohnausweis'),
    description: tx(
      'Certificat(s) de salaire de l’année fiscale, pour tous les employeurs.',
      'Salary certificate(s) for the tax year, for all employers.',
      'Lohnausweis(e) für das Steuerjahr, für alle Arbeitgeber.',
    ),
    texteAide: tx(
      'Document annuel remis par l’employeur (et non une fiche de paie mensuelle).',
      'Annual document issued by the employer (not a monthly payslip).',
      'Jährliches vom Arbeitgeber ausgestelltes Dokument (keine monatliche Lohnabrechnung).',
    ),
  },
  {
    code: 'ATTEST-SOURCE',
    category: 'REVENUS',
    profils: [T.FRONTALIER],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx(
      'Attestation impôt à la source / quittance',
      'Withholding tax certificate / receipt',
      'Quellensteuerbescheinigung / Quittung',
    ),
    description: tx(
      'Attestation d’impôt à la source / attestation-quittance (frontaliers, quasi-résidents, source).',
      'Withholding tax certificate / receipt (cross-border, quasi-residents, source).',
      'Quellensteuerbescheinigung / Quittung (Grenzgänger, Quasi-Ansässige, Quelle).',
    ),
    texteAide: tx('Remis par l’employeur.', 'Issued by the employer.', 'Vom Arbeitgeber ausgestellt.'),
  },
  {
    code: 'DECOMPTE-CHOMAGE',
    category: 'REVENUS',
    profils: [T.REVENU_SALARIE],
    requiredByDefault: false,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Décomptes chômage / APG / maternité', 'Unemployment / APG / maternity statements', 'Arbeitslosen- / EO- / Mutterschaftsabrechnungen'),
    description: tx(
      'Décomptes de chômage (caisse), indemnités APG / maternité.',
      'Unemployment statements (fund), APG / maternity allowances.',
      'Arbeitslosenabrechnungen (Kasse), EO- / Mutterschaftsentschädigungen.',
    ),
    texteAide: tx('Remis par la caisse de chômage ou la caisse de compensation.', 'Issued by the unemployment or compensation fund.', 'Von der Arbeitslosen- oder Ausgleichskasse ausgestellt.'),
  },
  {
    code: 'ATTEST-RENTES',
    category: 'REVENUS',
    profils: [T.RENTES],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Attestations de rentes', 'Pension statements', 'Rentenbescheinigungen'),
    description: tx(
      'Attestations de rentes : AVS/AI, LPP (2e pilier), rentes viagères.',
      'Pension statements: AVS/AI, LPP (2nd pillar), life annuities.',
      'Rentenbescheinigungen: AHV/IV, BVG (2. Säule), Leibrenten.',
    ),
    texteAide: tx('Remis annuellement par la caisse de rente.', 'Issued annually by the pension fund.', 'Jährlich von der Rentenkasse ausgestellt.'),
  },

  // ─────────── A. Titres & fortune ───────────
  {
    code: 'RELEVE-BANCAIRE',
    category: 'TITRES_FORTUNE',
    profils: [T.PARTICULIER],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Relevés bancaires et postaux au 31.12', 'Bank and postal statements as of 31.12', 'Bank- und Postauszüge per 31.12.'),
    description: tx(
      'Relevés au 31.12 (soldes et intérêts) — tous comptes, CH et étranger.',
      'Statements as of 31.12 (balances and interest) — all accounts, CH and abroad.',
      'Auszüge per 31.12. (Saldi und Zinsen) — alle Konten, CH und Ausland.',
    ),
    texteAide: tx('Le relevé de clôture annuelle de chaque compte.', 'The year-end closing statement of each account.', 'Der Jahresabschlussauszug jedes Kontos.'),
  },
  {
    code: 'ETAT-TITRES',
    category: 'TITRES_FORTUNE',
    profils: [T.TITRES],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('État des titres / relevé fiscal', 'Securities statement / tax voucher', 'Wertschriftenverzeichnis / Steuerauszug'),
    description: tx(
      'État des titres / relevé fiscal de la banque (dividendes, intérêts, gains).',
      'Securities statement / bank tax voucher (dividends, interest, gains).',
      'Wertschriftenverzeichnis / Steuerauszug der Bank (Dividenden, Zinsen, Gewinne).',
    ),
    texteAide: tx('« Relevé fiscal » fourni par votre banque.', 'The "tax voucher" provided by your bank.', 'Der von Ihrer Bank gelieferte „Steuerauszug".'),
  },
  {
    code: 'ATTEST-CRYPTO',
    category: 'TITRES_FORTUNE',
    profils: [T.CRYPTO],
    requiredByDefault: false,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF_IMG,
    expectedYearOffset: 0,
    nom: tx('Attestation de cryptomonnaies au 31.12', 'Cryptocurrency statement as of 31.12', 'Kryptowährungsnachweis per 31.12.'),
    description: tx(
      'Attestation des avoirs en cryptomonnaies au 31.12 le cas échéant.',
      'Statement of cryptocurrency holdings as of 31.12 if applicable.',
      'Nachweis der Kryptowährungsbestände per 31.12. falls zutreffend.',
    ),
    texteAide: tx('Export de la plateforme avec valeur au 31.12.', 'Export from the platform with value as of 31.12.', 'Export der Plattform mit Wert per 31.12.'),
  },

  // ─────────── A. Immobilier ───────────
  {
    code: 'IMMO-HYPO',
    category: 'IMMOBILIER',
    profils: [T.PROPRIETAIRE],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Valeur locative et dette hypothécaire', 'Rental value and mortgage debt', 'Eigenmietwert und Hypothekarschuld'),
    description: tx(
      'Valeur locative, relevé des intérêts hypothécaires, état de la dette hypothécaire au 31.12.',
      'Rental value, mortgage interest statement, mortgage debt balance as of 31.12.',
      'Eigenmietwert, Hypothekarzinsausweis, Stand der Hypothekarschuld per 31.12.',
    ),
    texteAide: tx('Attestation annuelle de la banque hypothécaire.', 'Annual statement from the mortgage bank.', 'Jährliche Bescheinigung der Hypothekarbank.'),
  },
  {
    code: 'IMMO-TRAVAUX',
    category: 'IMMOBILIER',
    profils: [T.PROPRIETAIRE],
    requiredByDefault: false,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF_IMG,
    expectedYearOffset: 0,
    nom: tx('Factures de travaux d’entretien', 'Maintenance work invoices', 'Rechnungen für Unterhaltsarbeiten'),
    description: tx(
      'Factures de travaux d’entretien déductibles (immeuble).',
      'Deductible maintenance work invoices (property).',
      'Rechnungen für abzugsfähige Unterhaltsarbeiten (Liegenschaft).',
    ),
    texteAide: tx('Factures acquittées dans l’année fiscale.', 'Invoices paid within the tax year.', 'Im Steuerjahr beglichene Rechnungen.'),
  },
  {
    code: 'IMMO-LOCATIF',
    category: 'IMMOBILIER',
    profils: [T.IMMO_LOCATIF],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Revenus locatifs', 'Rental income', 'Mieteinnahmen'),
    description: tx('Revenus locatifs (baux, décomptes).', 'Rental income (leases, statements).', 'Mieteinnahmen (Mietverträge, Abrechnungen).'),
    texteAide: tx('Baux et décomptes de charges des locataires.', 'Leases and tenant expense statements.', 'Mietverträge und Nebenkostenabrechnungen der Mieter.'),
  },

  // ─────────── A. Déductions ───────────
  {
    code: '3A',
    category: 'DEDUCTIONS',
    profils: [T.PILIER_3A],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Attestation 3e pilier A (3a)', '3rd pillar A statement (3a)', 'Bescheinigung Säule 3a'),
    description: tx(
      'Attestation du montant versé dans l’année au 3e pilier A.',
      'Statement of the amount paid into pillar 3a during the year.',
      'Bescheinigung des im Jahr in die Säule 3a einbezahlten Betrags.',
    ),
    texteAide: tx('Attestation de votre banque ou assurance 3a.', 'Statement from your 3a bank or insurer.', 'Bescheinigung Ihrer 3a-Bank oder -Versicherung.'),
  },
  {
    code: '3B',
    category: 'DEDUCTIONS',
    profils: [T.PILIER_3B],
    requiredByDefault: false,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Attestation 3e pilier B (3b)', '3rd pillar B statement (3b)', 'Bescheinigung Säule 3b'),
    description: tx('Attestation 3e pilier B (3b) le cas échéant.', '3rd pillar B statement (3b) if applicable.', 'Bescheinigung Säule 3b falls zutreffend.'),
    texteAide: tx('Police d’assurance-vie 3b.', '3b life insurance policy.', '3b-Lebensversicherungspolice.'),
  },
  {
    code: 'RACHAT-LPP',
    category: 'DEDUCTIONS',
    profils: [T.RACHAT_LPP],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Attestation de rachat 2e pilier (LPP)', '2nd pillar buy-in statement (LPP)', 'Einkaufsbescheinigung 2. Säule (BVG)'),
    description: tx('Attestation de rachat 2e pilier (LPP).', '2nd pillar (LPP) buy-in statement.', 'Einkaufsbescheinigung 2. Säule (BVG).'),
    texteAide: tx('Attestation de la caisse de pension.', 'Statement from the pension fund.', 'Bescheinigung der Pensionskasse.'),
  },
  {
    code: 'LAMAL',
    category: 'DEDUCTIONS',
    profils: [T.PARTICULIER],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Attestation primes assurance-maladie', 'Health insurance premium statement', 'Krankenkassenprämienbescheinigung'),
    description: tx(
      'Attestation primes LAMal et complémentaires (subsides éventuels).',
      'LAMal and supplementary premium statement (any subsidies).',
      'Bescheinigung KVG- und Zusatzprämien (allfällige Subventionen).',
    ),
    texteAide: tx('Attestation fiscale annuelle de votre caisse maladie.', 'Annual tax statement from your health insurer.', 'Jährliche Steuerbescheinigung Ihrer Krankenkasse.'),
  },
  {
    code: 'FRAIS-MEDICAUX',
    category: 'DEDUCTIONS',
    profils: [T.PARTICULIER],
    requiredByDefault: false,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF_IMG,
    expectedYearOffset: 0,
    nom: tx('Frais médicaux non remboursés', 'Non-reimbursed medical expenses', 'Nicht rückerstattete Krankheitskosten'),
    description: tx('Justificatifs des frais médicaux non remboursés.', 'Receipts for non-reimbursed medical expenses.', 'Belege für nicht rückerstattete Krankheitskosten.'),
    texteAide: tx('Factures et décomptes restés à votre charge.', 'Invoices and statements borne by you.', 'Zu Ihren Lasten verbliebene Rechnungen und Abrechnungen.'),
  },
  {
    code: 'FRAIS-GARDE',
    category: 'DEDUCTIONS',
    profils: [T.FRAIS_GARDE],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Frais de garde des enfants', 'Childcare expenses', 'Kinderbetreuungskosten'),
    description: tx('Attestation crèche / parascolaire.', 'Daycare / after-school certificate.', 'Bescheinigung Kinderkrippe / Tagesschule.'),
    texteAide: tx('Attestation annuelle de la structure d’accueil.', 'Annual certificate from the childcare facility.', 'Jährliche Bescheinigung der Betreuungseinrichtung.'),
  },
  {
    code: 'FORMATION',
    category: 'DEDUCTIONS',
    profils: [T.FORMATION],
    requiredByDefault: false,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF_IMG,
    expectedYearOffset: 0,
    nom: tx('Frais de formation / perfectionnement', 'Training / further education expenses', 'Aus- / Weiterbildungskosten'),
    description: tx('Frais de formation et de perfectionnement.', 'Training and further education expenses.', 'Aus- und Weiterbildungskosten.'),
    texteAide: tx('Factures de cours et attestations.', 'Course invoices and certificates.', 'Kursrechnungen und Bescheinigungen.'),
  },
  {
    code: 'FRAIS-PRO',
    category: 'DEDUCTIONS',
    profils: [T.FRAIS_PRO],
    requiredByDefault: false,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF_IMG,
    expectedYearOffset: 0,
    nom: tx('Frais professionnels effectifs', 'Actual professional expenses', 'Effektive Berufskosten'),
    description: tx(
      'Frais professionnels effectifs (transports, repas, formation) si supérieurs au forfait.',
      'Actual professional expenses (transport, meals, training) if above the lump sum.',
      'Effektive Berufskosten (Transport, Verpflegung, Weiterbildung) falls über der Pauschale.',
    ),
    texteAide: tx('Justificatifs de transports publics, repas, etc.', 'Public transport, meal receipts, etc.', 'Belege für öffentlichen Verkehr, Verpflegung usw.'),
  },
  {
    code: 'DONS',
    category: 'DEDUCTIONS',
    profils: [T.DONS],
    requiredByDefault: false,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Attestation de dons', 'Donation receipts', 'Spendenbescheinigungen'),
    description: tx('Attestation de dons (institutions reconnues).', 'Donation receipts (recognized institutions).', 'Spendenbescheinigungen (anerkannte Institutionen).'),
    texteAide: tx('Reçus des organismes reconnus d’utilité publique.', 'Receipts from recognized charitable organizations.', 'Quittungen anerkannter gemeinnütziger Organisationen.'),
  },
  {
    code: 'PENSIONS',
    category: 'DEDUCTIONS',
    profils: [T.PENSIONS],
    requiredByDefault: false,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Pensions alimentaires', 'Alimony payments', 'Unterhaltsbeiträge'),
    description: tx(
      'Pensions alimentaires versées/reçues (justificatifs, identité du bénéficiaire).',
      'Alimony paid/received (proof, beneficiary identity).',
      'Geleistete/erhaltene Unterhaltsbeiträge (Belege, Identität des Empfängers).',
    ),
    texteAide: tx('Justificatifs de versement et coordonnées du bénéficiaire.', 'Payment proof and beneficiary details.', 'Zahlungsbelege und Angaben zum Empfänger.'),
  },
  {
    code: 'DETTES',
    category: 'DEDUCTIONS',
    profils: [T.DETTES],
    requiredByDefault: false,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Attestation de dettes et intérêts', 'Debt and interest statement', 'Schuld- und Zinsbescheinigung'),
    description: tx(
      'Attestation de dettes et intérêts de dettes (crédits, leasing, cartes).',
      'Statement of debts and debt interest (loans, leasing, cards).',
      'Bescheinigung von Schulden und Schuldzinsen (Kredite, Leasing, Karten).',
    ),
    texteAide: tx('Relevé au 31.12 de chaque crédit/leasing.', 'Statement as of 31.12 of each loan/lease.', 'Auszug per 31.12. jedes Kredits/Leasings.'),
  },

  // ─────────── A. Famille ───────────
  {
    code: 'SCOLARITE-MAJEURS',
    category: 'FAMILLE',
    profils: [T.ENFANTS_MAJEURS],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Attestation de scolarité / études', 'School / study certificate', 'Schul- / Studienbescheinigung'),
    description: tx(
      'Attestation de scolarité / études des enfants majeurs à charge.',
      'School / study certificate for dependent adult children.',
      'Schul- / Studienbescheinigung für unterstützte volljährige Kinder.',
    ),
    texteAide: tx('Attestation de l’établissement pour l’année en cours.', 'Certificate from the institution for the current year.', 'Bescheinigung der Institution für das laufende Jahr.'),
  },

  // ─────────── B. Indépendants / raisons individuelles ───────────
  {
    code: 'INDEP-COMPTES',
    category: 'INDEP_SOCIETE',
    profils: [T.INDEPENDANT],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Comptes de l’exercice', 'Annual accounts', 'Jahresabschluss'),
    description: tx(
      'Bilan, compte de résultat, grand livre de l’exercice.',
      'Balance sheet, income statement, general ledger for the year.',
      'Bilanz, Erfolgsrechnung, Hauptbuch des Geschäftsjahres.',
    ),
    texteAide: tx('Comptes clôturés de votre activité indépendante.', 'Closed accounts of your self-employed activity.', 'Abgeschlossene Konten Ihrer selbständigen Tätigkeit.'),
  },
  {
    code: 'INDEP-BANQUE-PRO',
    category: 'INDEP_SOCIETE',
    profils: [T.INDEPENDANT],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Relevés bancaires professionnels au 31.12', 'Business bank statements as of 31.12', 'Geschäftskontoauszüge per 31.12.'),
    description: tx('Relevés des comptes bancaires professionnels au 31.12.', 'Business bank account statements as of 31.12.', 'Auszüge der Geschäftskonten per 31.12.'),
    texteAide: tx('Relevés de clôture des comptes professionnels.', 'Year-end statements of business accounts.', 'Jahresabschlussauszüge der Geschäftskonten.'),
  },
  {
    code: 'TVA-DECOMPTE',
    category: 'INDEP_SOCIETE',
    profils: [T.ASSUJETTI_TVA],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Décomptes TVA de l’exercice', 'VAT statements for the year', 'MWST-Abrechnungen des Geschäftsjahres'),
    description: tx(
      'Décomptes TVA de l’exercice (si assujetti) + concordance.',
      'VAT statements for the year (if liable) + reconciliation.',
      'MWST-Abrechnungen des Geschäftsjahres (falls steuerpflichtig) + Abstimmung.',
    ),
    texteAide: tx('Décomptes trimestriels/semestriels remis à l’AFC.', 'Quarterly/semi-annual statements filed with the FTA.', 'Quartals-/Halbjahresabrechnungen bei der ESTV.'),
  },
  {
    code: 'INDEP-AVS',
    category: 'INDEP_SOCIETE',
    profils: [T.INDEPENDANT],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Décomptes AVS indépendant', 'Self-employed AVS statements', 'AHV-Abrechnungen Selbständige'),
    description: tx('Décomptes AVS pour activité indépendante.', 'AVS statements for self-employed activity.', 'AHV-Abrechnungen für selbständige Tätigkeit.'),
    texteAide: tx('Décomptes de la caisse de compensation.', 'Statements from the compensation fund.', 'Abrechnungen der Ausgleichskasse.'),
  },

  // ─────────── C. Sociétés (Sàrl, SA) ───────────
  {
    code: 'SOC-ETATS-FIN',
    category: 'INDEP_SOCIETE',
    profils: [T.SOCIETE],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    signatureRequired: true,
    nom: tx('États financiers signés', 'Signed financial statements', 'Unterzeichneter Jahresabschluss'),
    description: tx(
      'Bilan, compte de résultat, annexe — signés.',
      'Balance sheet, income statement, notes — signed.',
      'Bilanz, Erfolgsrechnung, Anhang — unterzeichnet.',
    ),
    texteAide: tx('États financiers approuvés et signés.', 'Approved and signed financial statements.', 'Genehmigter und unterzeichneter Jahresabschluss.'),
  },
  {
    code: 'SOC-PV-AG',
    category: 'INDEP_SOCIETE',
    profils: [T.SOCIETE],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('PV d’assemblée générale', 'General meeting minutes', 'Protokoll der Generalversammlung'),
    description: tx(
      'Procès-verbal d’assemblée générale / approbation des comptes.',
      'General meeting minutes / approval of accounts.',
      'Protokoll der Generalversammlung / Genehmigung der Konten.',
    ),
    texteAide: tx('PV signé de l’AG ordinaire.', 'Signed minutes of the ordinary GM.', 'Unterzeichnetes Protokoll der ordentlichen GV.'),
  },
  {
    code: 'SOC-SALAIRES',
    category: 'INDEP_SOCIETE',
    profils: [T.SOCIETE],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Tableau des salaires et certificats', 'Salary schedule and certificates', 'Lohnliste und Lohnausweise'),
    description: tx(
      'Tableau des salaires et certificats de salaire émis ; décomptes assurances sociales (AVS, LPP, LAA) et impôt à la source.',
      'Salary schedule and issued salary certificates; social insurance statements (AVS, LPP, LAA) and withholding tax.',
      'Lohnliste und ausgestellte Lohnausweise; Sozialversicherungsabrechnungen (AHV, BVG, UVG) und Quellensteuer.',
    ),
    texteAide: tx('Récapitulatif annuel des salaires versés.', 'Annual summary of salaries paid.', 'Jährliche Zusammenfassung der gezahlten Löhne.'),
  },

  // ─────────── D. Hoiries / successions ───────────
  {
    code: 'HOIRIE-DECES',
    category: 'A_TRIER',
    profils: [T.HOIRIE],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Acte de décès / certificat d’héritier', 'Death certificate / certificate of inheritance', 'Todesurkunde / Erbbescheinigung'),
    description: tx(
      'Acte de décès, certificat d’héritier.',
      'Death certificate, certificate of inheritance.',
      'Todesurkunde, Erbbescheinigung.',
    ),
    texteAide: tx('Documents officiels de la succession.', 'Official estate documents.', 'Offizielle Nachlassdokumente.'),
  },
  {
    code: 'HOIRIE-INVENTAIRE',
    category: 'A_TRIER',
    profils: [T.HOIRIE],
    requiredByDefault: true,
    modeValidation: 'HUMAIN_REQUIS',
    acceptedFormats: PDF,
    expectedYearOffset: 0,
    nom: tx('Inventaire successoral', 'Estate inventory', 'Nachlassinventar'),
    description: tx(
      'Inventaire successoral et documents fiscaux du défunt pour l’année concernée.',
      'Estate inventory and the deceased’s tax documents for the relevant year.',
      'Nachlassinventar und Steuerunterlagen des Verstorbenen für das betreffende Jahr.',
    ),
    texteAide: tx('Inventaire établi pour la succession.', 'Inventory drawn up for the estate.', 'Für den Nachlass erstelltes Inventar.'),
  },
];

/** Recherche d'une pièce par code (utilitaire). */
export function findPiece(code: string): PieceReferentialEntry | undefined {
  return PIECE_REFERENTIAL.find((p) => p.code === code);
}
