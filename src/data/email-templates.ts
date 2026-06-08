// Modèles d'e-mails par défaut, personnalisables, ton formel, 3 langues (§6.3).
// Variables dynamiques disponibles dans le corps :
//   {{client}}            nom du client
//   {{piecesManquantes}}  liste des pièces manquantes / non conformes
//   {{lien}}              lien sécurisé vers l'espace client
//   {{echeance}}          date d'échéance
//   {{collaborateur}}     nom du collaborateur référent
//   {{raison}}            raison de non-conformité (NON_CONFORMITE)

import type { AppLocale } from '@/lib/i18n/locales';

export type EmailTemplateKey =
  | 'INVITATION'
  | 'RELANCE_1'
  | 'RELANCE_2'
  | 'RELANCE_3'
  | 'ESCALADE_INTERNE'
  | 'ACCUSE_RECEPTION'
  | 'NON_CONFORMITE'
  | 'DOSSIER_COMPLET';

export interface EmailTemplateSeed {
  key: EmailTemplateKey;
  locale: AppLocale;
  subject: string;
  body: string;
}

const SIGN = {
  fr: 'Avec nos salutations les meilleures,\nB&B Associés',
  en: 'Kind regards,\nB&B Associés',
  de: 'Freundliche Grüsse,\nB&B Associés',
};

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplateSeed[] = [
  // INVITATION
  {
    key: 'INVITATION',
    locale: 'fr',
    subject: 'Votre espace de collecte documentaire — B&B Associés',
    body: `Madame, Monsieur {{client}},\n\nNous ouvrons la collecte des pièces nécessaires à votre déclaration fiscale. Vous trouverez votre checklist personnalisée dans votre espace sécurisé :\n\n{{lien}}\n\nMerci de déposer les documents demandés avant le {{echeance}}.\nVotre interlocuteur : {{collaborateur}}.\n\n${SIGN.fr}`,
  },
  {
    key: 'INVITATION',
    locale: 'en',
    subject: 'Your document collection portal — B&B Associés',
    body: `Dear {{client}},\n\nWe are opening the collection of documents required for your tax return. Your personalised checklist is available in your secure portal:\n\n{{lien}}\n\nPlease upload the requested documents before {{echeance}}.\nYour contact: {{collaborateur}}.\n\n${SIGN.en}`,
  },
  {
    key: 'INVITATION',
    locale: 'de',
    subject: 'Ihr Portal zur Dokumentensammlung — B&B Associés',
    body: `Sehr geehrte/r {{client}},\n\nWir eröffnen die Sammlung der für Ihre Steuererklärung erforderlichen Unterlagen. Ihre persönliche Checkliste finden Sie in Ihrem sicheren Portal:\n\n{{lien}}\n\nBitte laden Sie die angeforderten Dokumente bis zum {{echeance}} hoch.\nIhr Ansprechpartner: {{collaborateur}}.\n\n${SIGN.de}`,
  },

  // RELANCE_1
  {
    key: 'RELANCE_1',
    locale: 'fr',
    subject: 'Rappel — pièces encore attendues',
    body: `Madame, Monsieur {{client}},\n\nIl nous manque encore les pièces suivantes pour votre dossier :\n{{piecesManquantes}}\n\nVous pouvez les déposer ici : {{lien}}\nÉchéance : {{echeance}}.\n\n${SIGN.fr}`,
  },
  {
    key: 'RELANCE_1',
    locale: 'en',
    subject: 'Reminder — documents still expected',
    body: `Dear {{client}},\n\nThe following documents are still missing from your file:\n{{piecesManquantes}}\n\nYou can upload them here: {{lien}}\nDeadline: {{echeance}}.\n\n${SIGN.en}`,
  },
  {
    key: 'RELANCE_1',
    locale: 'de',
    subject: 'Erinnerung — noch erwartete Unterlagen',
    body: `Sehr geehrte/r {{client}},\n\nFolgende Unterlagen fehlen noch in Ihrem Dossier:\n{{piecesManquantes}}\n\nSie können sie hier hochladen: {{lien}}\nFrist: {{echeance}}.\n\n${SIGN.de}`,
  },

  // RELANCE_2
  {
    key: 'RELANCE_2',
    locale: 'fr',
    subject: 'Deuxième rappel — échéance approchant',
    body: `Madame, Monsieur {{client}},\n\nNous attirons votre attention sur l’échéance du {{echeance}}. Les pièces suivantes restent à fournir :\n{{piecesManquantes}}\n\nMerci de les déposer rapidement : {{lien}}\n\n${SIGN.fr}`,
  },
  {
    key: 'RELANCE_2',
    locale: 'en',
    subject: 'Second reminder — deadline approaching',
    body: `Dear {{client}},\n\nWe draw your attention to the {{echeance}} deadline. The following documents are still required:\n{{piecesManquantes}}\n\nPlease upload them promptly: {{lien}}\n\n${SIGN.en}`,
  },
  {
    key: 'RELANCE_2',
    locale: 'de',
    subject: 'Zweite Erinnerung — Frist rückt näher',
    body: `Sehr geehrte/r {{client}},\n\nWir weisen Sie auf die Frist am {{echeance}} hin. Folgende Unterlagen fehlen noch:\n{{piecesManquantes}}\n\nBitte laden Sie sie zeitnah hoch: {{lien}}\n\n${SIGN.de}`,
  },

  // RELANCE_3
  {
    key: 'RELANCE_3',
    locale: 'fr',
    subject: 'Urgent — pièces manquantes',
    body: `Madame, Monsieur {{client}},\n\nVotre dossier reste incomplet à l’approche de l’échéance ({{echeance}}). Sans les pièces suivantes, nous ne pourrons garantir le dépôt dans les délais :\n{{piecesManquantes}}\n\nDépôt : {{lien}}\n\n${SIGN.fr}`,
  },
  {
    key: 'RELANCE_3',
    locale: 'en',
    subject: 'Urgent — missing documents',
    body: `Dear {{client}},\n\nYour file remains incomplete as the {{echeance}} deadline approaches. Without the following documents we cannot guarantee a timely filing:\n{{piecesManquantes}}\n\nUpload: {{lien}}\n\n${SIGN.en}`,
  },
  {
    key: 'RELANCE_3',
    locale: 'de',
    subject: 'Dringend — fehlende Unterlagen',
    body: `Sehr geehrte/r {{client}},\n\nIhr Dossier ist kurz vor der Frist ({{echeance}}) noch unvollständig. Ohne folgende Unterlagen können wir eine fristgerechte Einreichung nicht gewährleisten:\n{{piecesManquantes}}\n\nUpload: {{lien}}\n\n${SIGN.de}`,
  },

  // ESCALADE_INTERNE (destiné au collaborateur)
  {
    key: 'ESCALADE_INTERNE',
    locale: 'fr',
    subject: '[Escalade] Dossier client incomplet — {{client}}',
    body: `Le dossier de {{client}} reste incomplet après les relances automatiques (échéance {{echeance}}).\nPièces manquantes :\n{{piecesManquantes}}\n\nMerci de prendre contact (relance humaine / téléphone).`,
  },
  {
    key: 'ESCALADE_INTERNE',
    locale: 'en',
    subject: '[Escalation] Incomplete client file — {{client}}',
    body: `{{client}}'s file remains incomplete after automatic reminders (deadline {{echeance}}).\nMissing documents:\n{{piecesManquantes}}\n\nPlease make contact (manual reminder / phone).`,
  },
  {
    key: 'ESCALADE_INTERNE',
    locale: 'de',
    subject: '[Eskalation] Unvollständiges Kundendossier — {{client}}',
    body: `Das Dossier von {{client}} ist nach den automatischen Erinnerungen noch unvollständig (Frist {{echeance}}).\nFehlende Unterlagen:\n{{piecesManquantes}}\n\nBitte Kontakt aufnehmen (manuelle Erinnerung / Telefon).`,
  },

  // ACCUSE_RECEPTION
  {
    key: 'ACCUSE_RECEPTION',
    locale: 'fr',
    subject: 'Document bien reçu',
    body: `Madame, Monsieur {{client}},\n\nNous accusons réception de votre document. Il sera vérifié sous peu.\n\n${SIGN.fr}`,
  },
  {
    key: 'ACCUSE_RECEPTION',
    locale: 'en',
    subject: 'Document received',
    body: `Dear {{client}},\n\nWe acknowledge receipt of your document. It will be reviewed shortly.\n\n${SIGN.en}`,
  },
  {
    key: 'ACCUSE_RECEPTION',
    locale: 'de',
    subject: 'Dokument erhalten',
    body: `Sehr geehrte/r {{client}},\n\nWir bestätigen den Erhalt Ihres Dokuments. Es wird in Kürze geprüft.\n\n${SIGN.de}`,
  },

  // NON_CONFORMITE
  {
    key: 'NON_CONFORMITE',
    locale: 'fr',
    subject: 'Document à refournir',
    body: `Madame, Monsieur {{client}},\n\nLe document déposé n’a pas pu être validé pour la raison suivante :\n{{raison}}\n\nMerci de le redéposer corrigé : {{lien}}\n\n${SIGN.fr}`,
  },
  {
    key: 'NON_CONFORMITE',
    locale: 'en',
    subject: 'Document to be resubmitted',
    body: `Dear {{client}},\n\nThe document you uploaded could not be validated for the following reason:\n{{raison}}\n\nPlease re-upload a corrected version: {{lien}}\n\n${SIGN.en}`,
  },
  {
    key: 'NON_CONFORMITE',
    locale: 'de',
    subject: 'Dokument erneut einzureichen',
    body: `Sehr geehrte/r {{client}},\n\nDas hochgeladene Dokument konnte aus folgendem Grund nicht validiert werden:\n{{raison}}\n\nBitte laden Sie eine korrigierte Version erneut hoch: {{lien}}\n\n${SIGN.de}`,
  },

  // DOSSIER_COMPLET
  {
    key: 'DOSSIER_COMPLET',
    locale: 'fr',
    subject: 'Dossier complet — merci',
    body: `Madame, Monsieur {{client}},\n\nVotre dossier est désormais complet. Nous vous remercions et reviendrons vers vous si nécessaire.\n\n${SIGN.fr}`,
  },
  {
    key: 'DOSSIER_COMPLET',
    locale: 'en',
    subject: 'File complete — thank you',
    body: `Dear {{client}},\n\nYour file is now complete. Thank you; we will get back to you if needed.\n\n${SIGN.en}`,
  },
  {
    key: 'DOSSIER_COMPLET',
    locale: 'de',
    subject: 'Dossier vollständig — vielen Dank',
    body: `Sehr geehrte/r {{client}},\n\nIhr Dossier ist nun vollständig. Vielen Dank; wir melden uns bei Bedarf.\n\n${SIGN.de}`,
  },
];

/** Remplace les variables {{...}} dans un corps/objet d'e-mail. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}
