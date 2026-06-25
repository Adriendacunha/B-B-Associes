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
    key: 'declaration-rectificative',
    name: 'Déclaration d’impôt',
    description: 'Assistant guidé : déclaration de l’année (corriger les données pré-remplies), impôt à la source (DRIS) ou réclamation contre une taxation reçue.',
    engine: 'QUESTIONNAIRE',
    active: true,
    sortOrder: 1,
  },
  {
    // Retiré du parcours : le profilage par tags a été fusionné dans l'assistant
    // guidé « Déclaration d'impôt ». Conservé inactif pour les campagnes existantes.
    key: 'declaration-pp',
    name: 'Déclaration d’impôt PP (ancien profilage)',
    description: 'Ancien flux de profilage par situations fiscales — remplacé par l’assistant guidé.',
    engine: 'PROFILAGE_TAGS',
    active: false,
    sortOrder: 9,
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
