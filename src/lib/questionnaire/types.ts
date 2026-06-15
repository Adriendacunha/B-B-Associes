// Moteur de questionnaire déclaratif à arbre de décision (refonte du profilage).
//
// Un TEMPLATE décrit des sections → questions ; chaque question peut être
// conditionnelle (visibilityCondition) et déclencher des documents. Le moteur
// (engine.ts) évalue les réponses du client pour ne montrer que les questions
// utiles et générer la liste personnalisée des documents attendus.
//
// Objectif UX (retour utilisateurs : « trop confus ») : ne jamais afficher toute
// la checklist d'un coup — qualifier d'abord, puis générer une checklist ciblée.

export type AnswerType = 'boolean' | 'single' | 'multi' | 'text' | 'number' | 'date';

/** Niveau de risque fiscal/délai d'une question — affiché côté B&B uniquement. */
export type RiskLevel = 'low' | 'medium' | 'high';

/** Caractère d'un document attendu (§ checklist conditionnelle). */
export type DocObligation = 'obligatoire' | 'conditionnel' | 'recommande';

/** Statut d'un document dans le dossier (cycle de dépôt). */
export type DocStatus = 'manquant' | 'recu' | 'a_corriger' | 'valide';

export interface Choice {
  value: string;
  label: string;
}

/**
 * Condition de visibilité / déclenchement, sérialisable (stockable en JSON).
 * Combinable via all (ET) / any (OU) / not.
 *  - { q, eq }      : la réponse à la question `q` vaut `eq`
 *  - { q, in }      : la réponse `q` (ou l'une des réponses si multi) ∈ `in`
 *  - { q, answered }: la question `q` a une réponse non vide
 */
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { q: string; eq: string | number | boolean }
  | { q: string; in: string[] }
  | { q: string; answered: true };

export interface DocumentRequest {
  id: string;
  /** Libellé simple, côté client (« Votre certificat de salaire »). */
  clientLabel: string;
  /** Catégorie fiscale (regroupement). */
  category: string;
  obligation: DocObligation;
  /** « Pourquoi nous vous le demandons ». */
  reason: string;
  acceptedFormats: string[];
  /** Message de relance spécifique à ce document. */
  reminderMessage: string;
  /** Quand ce document est demandé. Absent = socle (toujours demandé). */
  condition?: Condition;
}

export interface Question {
  id: string;
  /** Libellé interne / fiscal (vue B&B). */
  question: string;
  /** Libellé simple (vue client). */
  clientLabel: string;
  helpText?: string;
  answerType: AnswerType;
  /** Pour single / multi. */
  choices?: Choice[];
  visibilityCondition?: Condition;
  /** Documents déclenchés par cette question (traçabilité vue B&B). */
  requiredDocuments?: string[];
  /** Note de logique fiscale, vue B&B uniquement. */
  bbInternalNote?: string;
  riskLevel?: RiskLevel;
  /**
   * Donnée du dossier (identité, adresse, état civil…) plutôt que question de
   * qualification : NON demandée au cabinet lors de la création (il ne remplit
   * pas le dossier à la place du client). N'influence pas la liste de documents.
   */
  clientData?: boolean;
}

export interface Section {
  id: string;
  /** Titre interne (vue B&B). */
  title: string;
  /** Titre côté client (si différent). */
  clientTitle?: string;
  /** La section entière peut être conditionnelle (ex. branche DRIS vs TOU). */
  visibilityCondition?: Condition;
  questions: Question[];
}

export interface Template {
  id: string;
  title: string;
  description: string;
  sections: Section[];
  /** Catalogue des documents, référencés par id et conditionnés. */
  documents: DocumentRequest[];
}

/** Réponses du questionnaire, indexées par id de question. */
export type Answers = Record<string, string | string[] | boolean | number | null | undefined>;

/** Document attendu résolu (catalogue + statut courant). */
export interface ResolvedDocument extends DocumentRequest {
  status: DocStatus;
}
