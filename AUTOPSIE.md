# AUTOPSIE — B-B-Associes (v0 de 39 Collect)

> Document d'archivage. Ce dépôt n'est plus développé. Rien n'y sera supprimé :
> il sert de référence et de rappel de méthode pour le successeur.

## Pourquoi ce dépôt est archivé

Le périmètre s'est élargi à chaque session de développement sans cadrage écrit
partagé : parti d'un outil de **collecte de documents fiscaux**, le projet a
accumulé de la logique d'**aide à la déclaration** jamais arbitrée (arbre
DRIS/TOU, barèmes), des écrans annexes (coûts d'analyse IA) et des intégrations
lourdes prévues au cahier des charges initial mais hors collecte stricte (OCR,
OneDrive, exports comptables). Les dernières sessions ont surtout servi à
**défaire** des choix de structure (fusion de deux flux concurrents, renommages
métier). Le projet redémarre sur un dépôt propre — `39-collect` — avec un
périmètre écrit et une méthode de validation avant développement.

## Chronologie du développement

L'historique commence par un **import massif le 08.06 (84 fichiers,
12 010 lignes en un commit)** : le périmètre était donc déjà très large avant le
premier commit tracé, sans historique des décisions antérieures.

Deux types de dérive sont distingués : **⚠CdC** = prévu au cahier des charges
initial mais hors périmètre collecte ; **⚠NA** = jamais arbitré.

| Date | Fonctionnalités ajoutées | Dérive |
|---|---|---|
| 08.06 | **Import initial (12 010 lignes)** : campagnes, checklist, espace client, relances cron, sécurité, CI + tests d'intégration, conformité hébergement, onboarding bêta, générateur de démo | ⚠CdC Périmètre déjà élargi à l'import : **exports Crésus/Banana** (§10 — comptabilité, pas collecte) |
| 09.06 | Journée upload : stockage persistant serverless, consultation/renommage des documents, limite 16 Mo, fusion multi-fichiers en PDF, dépôt en vrac avec **tri automatique par IA**, motifs de refus IA, repli si l'API échoue, E2E Playwright, refonte visuelle | ⚠CdC OCR embarqué (§7.2 — tessdata ~15 Mo dans le dépôt) et stockage **OneDrive** (§5) : prévus au cahier des charges, dimensionnement jamais réarbitré |
| 10.06 | E-mails réels : canal Microsoft Graph découplé + canal SMTP, test de délivrabilité | — |
| 12.06 | Déclaration de complétude client (Non / Oui / Non concerné), drag & drop, **profilage « Niveaux 1+2 »** (situation de famille, retraité, activité accessoire, frais médicaux) | ⚠NA Le questionnaire commence à modéliser la situation fiscale au-delà du besoin de collecte |
| 15.06 | **Assistant « Déclaration rectificative » à arbre de décision** (logique fiscale interne DRIS/TOU), vue créateur, persistance, consolidation A/B/C (3 objets métier, checklist éditable, aperçu client, buckets dashboard), intake client, lien copiable, fiche client complète | ⚠⚠NA Bascule vers l'**aide à la déclaration** : routage fiscal DRIS/TOU codé en dur ; création d'un **second flux** concurrent du profilage existant |
| 25.06 | **Fusion des deux flux** en « Déclaration d'impôt » unique, auto-qualification client, rationalisation du doublon d'identité, logo officiel, UX Phase 1 (vocabulaire métier, accueil recentré), UX Phase 2 (wizard guidé 4 étapes) | Conséquence de la dérive : ~8 commits pour défaire la coexistence des deux flux créés les 12 et 15.06 |
| 26.06 | Titres cohérents cabinet/client, visibilité de l'auto-qualification | — |

Écrans annexes présents dans l'app (hors flux de collecte) : `/baremes`
(barèmes fiscaux GE — aide à la déclaration) ⚠NA et `/analytics` (coûts des
appels IA en tokens — méta-outil interne) ⚠NA.

## Cartographie : que reste-t-il ?

> **Règle d'usage de cette liste : l'archive est une carrière, pas un donneur
> d'organes. Le successeur se construit mince ; un composant récupérable n'est
> transplanté qu'au moment où son module est développé, jamais en masse.
> Exceptions immédiates : la configuration CI/e2e et le référentiel de pièces.**

| Composant / dossier | État | Verdict | Justification |
|---|---|---|---|
| `prisma/` (schéma Client, Campaign, ChecklistItem, Document, EmailMessage, audit) | Fonctionnel | **Récupérable** | Modèle de données éprouvé par 140 tests ; colle au métier de la collecte |
| `src/lib/questionnaire/` (moteur questions → pièces) | Fonctionnel | **Récupérable** | Cœur de la valeur : moteur conditionnel générique, testé, indépendant de l'UI |
| `src/data/templates/declaration-rectificative.ts` | Fonctionnel | **À réécrire** | La logique questions→pièces est bonne, mais le routage fiscal DRIS/TOU codé en dur dépasse la collecte ; à re-spécifier avec le cabinet |
| `src/data/piece-referential.ts` | Fonctionnel | **Récupérable** | Référentiel de pièces (codes, catégories, bilingue) directement réutilisable |
| Espace client (dépôt par pièce + vrac, drag & drop, complétude) | Fonctionnel | **Récupérable** | Logique solide ; l'UI peut être reprise ou refaite, les server actions sont saines |
| `src/lib/ai/` (analyse des documents Claude + repli démo) | Fonctionnel | **Récupérable** | Marche avec repli propre hors API ; prompts à re-calibrer sur le nouveau périmètre |
| `src/lib/ocr/` + `tessdata/` (~15 Mo) | Partiel | **À jeter** | Usage marginal (un seul appelant), alourdit le dépôt ; l'analyse IA suffit |
| `src/lib/onedrive/` | Partiel | **À jeter** | Prévu au CdC (§5) mais jamais mis en service ; le successeur doit choisir UN hébergement |
| `src/lib/email/` + `src/lib/reminders/` (Graph/SMTP/démo, cron J+3/J+7) | Fonctionnel | **Récupérable** | Canal découplé, séquence de relances testée ; indépendant du reste |
| `src/lib/export/` (Crésus/Banana CSV + ZIP) | Fonctionnel | **À jeter** | Hors périmètre collecte (⚠CdC) ; à re-développer seulement si le besoin est confirmé |
| `/baremes` (barèmes fiscaux GE) | Abandonné | **À jeter** | Aide à la déclaration, pas de la collecte ; données à maintenir chaque année |
| `/analytics` (coûts d'analyse IA) | Partiel | **À jeter** | Méta-outil de suivi de tokens, sans lien avec le produit |
| Wizard « Créer une campagne », dashboard buckets, écran validation | Fonctionnel | **Récupérable** | Dernière itération UX, la plus proche de la cible ; à transplanter |
| `e2e/` (Playwright) + `.github/` (CI unit/integration/e2e) | Fonctionnel | **Récupérable** | Filet de sécurité qui a permis 10 PR mergées au vert ; à copier tel quel |
| `src/lib/demo/` (générateur de données) | Fonctionnel | **Récupérable** | Utile pour les démos et le seed du successeur |
| `docs/` (arbre de décision rectificative, setup e-mail) | Partiel | **Récupérable** | Vaut comme spécification de départ, pas comme code |

## Leçons apprises

1. **Un import initial de 12 010 lignes sans historique** a rendu les décisions
   de périmètre intraçables : la dérive était déjà actée avant le premier commit.
2. **Chaque session a ajouté un module jamais arbitré** (profilage fiscal,
   arbre DRIS/TOU, barèmes, coûts IA) : sans périmètre écrit opposable,
   « pendant qu'on y est » gagne à tous les coups.
3. **Deux flux de création concurrents** (profilage du 12.06, rectificative du
   15.06) ont coexisté dix jours ; leur fusion a coûté ~8 commits — cadrer avant
   de coder aurait évité l'aller-retour.
4. **La logique fiscale codée en dur** (DRIS/TOU, barèmes, seuil des 90 %) a
   transformé un outil de collecte en début d'assistant fiscal : c'est la ligne
   rouge que le successeur devra écrire noir sur blanc.
5. **Ce qui a marché et doit être conservé comme méthode** : CI + 140 tests +
   e2e dès le départ, petites PR mergées uniquement au vert, validation du plan
   avant développement (adoptée seulement en toute fin de projet).
6. **Un cahier des charges existait mais n'était ni partagé entre associés ni
   opposable** — un périmètre écrit ne protège que s'il est validé
   collectivement.

## Successeur

Le projet continue dans le dépôt **`39-collect`** :
<https://github.com/Adriendacunha/39-collect>.
