// Modèles de campagne (objet métier CampaignTemplate). Source du seed ; en base,
// ils sont éditables par le cabinet (activer/désactiver, renommer). Le champ
// `engine` indique comment la checklist est générée.

export interface CampaignTemplateSeed {
  key: string;
  name: string;
  description: string;
  engine: 'PROFILAGE_TAGS' | 'QUESTIONNAIRE' | 'CUSTOM';
  active: boolean;
  sortOrder: number;
}

export const CAMPAIGN_TEMPLATES: CampaignTemplateSeed[] = [
  {
    key: 'declaration-pp',
    name: 'Déclaration d’impôt PP',
    description: 'Déclaration ordinaire d’une personne physique : profilage par situations fiscales.',
    engine: 'PROFILAGE_TAGS',
    active: true,
    sortOrder: 1,
  },
  {
    key: 'declaration-rectificative',
    name: 'Déclaration d’impôt (assistant guidé)',
    description: 'Assistant conditionnel : déclaration de l’année (corriger les données pré-remplies), impôt à la source (DRIS) ou réclamation contre une taxation reçue.',
    engine: 'QUESTIONNAIRE',
    active: true,
    sortOrder: 2,
  },
  {
    key: 'bouclement-annuel',
    name: 'Bouclement annuel',
    description: 'Collecte des pièces pour le bouclement comptable annuel.',
    engine: 'CUSTOM',
    active: true,
    sortOrder: 3,
  },
  {
    key: 'tva',
    name: 'TVA',
    description: 'Collecte des pièces pour les décomptes TVA.',
    engine: 'CUSTOM',
    active: true,
    sortOrder: 4,
  },
  {
    key: 'demande-personnalisee',
    name: 'Demande personnalisée',
    description: 'Checklist libre construite manuellement par le cabinet.',
    engine: 'CUSTOM',
    active: true,
    sortOrder: 5,
  },
];
