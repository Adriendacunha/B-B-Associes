# 39 Collect by Codex - structure GitHub

## Objectif

Ce depot devient le depot principal du projet `39 Collect by Codex`, anciennement nomme `Espace client B&B Associes`.

La recommandation MVP est de rester sur un monorepo afin de limiter la coordination technique, accelerer les arbitrages et garder frontend, logique metier, donnees, securite et documentation au meme endroit.

## Nom officiel

- Nom projet : `39 Collect by Codex`
- Ancien nom de travail : `Espace client B&B Associes`
- Depot existant : `Adriendacunha/B-B-Associes`
- Recommandation : conserver le depot existant a court terme, puis renommer le depot en `39-collect-by-codex` lorsque l'equipe valide que le nom est public ou durable.

## Structure cible

```text
.github/
  ISSUE_TEMPLATE/       Modeles d'issues pour cadrage, risques et fonctionnalites
  PULL_REQUEST_TEMPLATE.md

docs/
  PROJECT-STRUCTURE.md  Structure GitHub et conventions
  MVP-ROADMAP.md        Priorites MVP et lots de travail
  GOVERNANCE.md         Regles de pilotage, securite et donnees

src/                    Application Next.js existante
prisma/                 Schema, migrations et seed
scripts/                Scripts techniques et de deploiement
```

## Conventions de branches

- `main` ou branche par defaut : version stable ou integrable.
- `codex/<sujet>` : travaux prepares par Codex.
- `feature/<sujet>` : fonctionnalite produit.
- `fix/<sujet>` : correction ciblee.
- `docs/<sujet>` : documentation et pilotage.

## Conventions d'issues

Utiliser des issues courtes, actionnables et rattachees a un lot MVP :

- `MVP - Produit`
- `MVP - Securite et LPD`
- `MVP - UX collecte documentaire`
- `MVP - Integrations`
- `MVP - Pilotage et validation metier`

## Regle de priorisation

Une issue est prioritaire si elle contribue directement a au moins un des objectifs suivants :

1. simplifier la collecte pour le client final ;
2. reduire les allers-retours documentaires ;
3. gagner du temps pour les collaborateurs B&B Associes ;
4. reduire un risque LPD, securite ou donnees fiscales ;
5. accelerer la mise sur le marche du MVP.

## Points d'attention immediats

- Le depot actuel est public. Compte tenu de la nature fiscale du projet, il faut confirmer si le code, les donnees de demonstration et les documents projet peuvent rester publics.
- Le nom du depot ne correspond pas encore au nom projet officiel.
- La branche par defaut actuelle porte un nom de travail technique ; il faut confirmer si elle doit etre remplacee par `main`.
