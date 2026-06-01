# B&B Associés — Espace client de collecte documentaire

Application web de collecte de documents fiscaux pour la fiduciaire **B&B Associés**
(Route des Acacias 24, 1227 Carouge / Genève). Elle permet à chaque client de
déposer ses pièces via une **checklist dynamique**, vérifiées par IA (humain dans
la boucle), rangées automatiquement dans le **OneDrive Business** du cabinet, avec
**relances** configurables et **tableau de bord** de suivi.

Ce dépôt contient le **socle de la Phase 1 (MVP)** décrite dans le brief : modèle de
données complet, logique métier centrale **testée**, référentiel de pièces genevois,
modèles d'e-mails et squelette d'application Next.js multilingue.

> **Statut** : socle fonctionnel et testé (40 tests verts, `next build` OK). Les
> intégrations externes (Microsoft Graph, API Claude, base PostgreSQL) sont
> implémentées au niveau interface/contrat et nécessitent la configuration des
> secrets et du tenant pour être exécutées de bout en bout (voir §Points à confirmer).

---

## Stack

- **Next.js 15 (App Router) + React 19 + TypeScript**, **Tailwind CSS**
- **next-intl** — interface en **FR / EN / DE** (français par défaut, §3 du brief)
- **Prisma** + **PostgreSQL** (à héberger en Suisse, §9/§12)
- **@anthropic-ai/sdk** — vérification documentaire par Claude (§7)
- **Microsoft Graph** (fetch) — dépôt OneDrive + `sendMail` (§5/§6.2)
- **Zod** — validation des sorties IA et des entrées
- **Vitest** — tests unitaires de la logique métier

---

## Démarrage

```bash
npm install
cp .env.example .env          # renseigner DB, Graph, Claude, stockage (voir commentaires)
npm run prisma:generate
npm run prisma:migrate        # crée le schéma (nécessite DATABASE_URL)
npm run db:seed               # référentiel, cadence, e-mails, démo
npm run dev                   # http://localhost:3000  (redirige vers /fr)
```

Scripts utiles :

| Script | Rôle |
|---|---|
| `npm test` | tests unitaires (logique métier pure) |
| `npm run typecheck` | vérification TypeScript de tout le projet |
| `npm run build` | build de production Next.js |
| `npm run db:seed` | charge le référentiel + données de démonstration |

---

## Architecture du code

```
src/
  app/[locale]/            Pages Next.js (i18n) : accueil, /espace, /tableau-de-bord
  components/              Composants UI (sélecteur de langue…)
  i18n/                    Routing + catalogues de messages FR/EN/DE
  data/
    piece-referential.ts   Référentiel ÉDITABLE des pièces genevoises (§4.2)
    email-templates.ts     Modèles d'e-mails par défaut, 3 langues (§6.3)
  lib/
    onedrive/paths.ts      Arborescence + nommage de fichiers OneDrive (§5)  ✓ testé
    reminders/cadence.ts   Moteur de relance configurable (§6.1)            ✓ testé
    checklist/profiling.ts Profilage → checklist dynamique (§4.1/§4.3)      ✓ testé
    ai/verification.ts     Contrat prompt + schéma JSON du verdict IA (§7.2) ✓ testé
    ai/client.ts           Appel réel à l'API Claude (ZDR, §7/§9)
    metrics/mvp.ts         Les 4 métriques MVP (§15.3)                       ✓ testé
    audit/chain.ts         Journal d'audit inaltérable chaîné (§8)           ✓ testé
    graph/client.ts        Microsoft Graph : OneDrive + sendMail (§5/§6.2)
    auth/password.ts       Hachage de mot de passe (§8)
    demo/sample.ts         Données de démonstration des pages
    db.ts                  Singleton Prisma
prisma/
  schema.prisma            Modèle de données complet (clients, campagnes, pièces,
                           documents, verdicts IA, revues humaines, relances,
                           e-mails, audit) — voir §Modèle de données
  seed.ts                  Seed référentiel + démo
```

### Modèle de données (points clés vis-à-vis du brief)

- **`Client.niveauDeService`** (`EXPERT` / `AUTO`) — existe dès la Phase 1 ; **tous
  les clients sont `EXPERT` en MVP** (§2/§15).
- **`PieceDefinition.modeValidation`** (`HUMAIN_REQUIS` / `AUTO_AUTORISE`) — **toutes
  les pièces sont `HUMAIN_REQUIS` en MVP** (§4.2). C'est le croisement de ces deux
  champs qui pilotera l'offre 100 % automatisée.
- **`HumanReview.agreedWithAi`** — enregistre si le collaborateur a confirmé le
  verdict IA. C'est **la donnée brute de la métrique de fiabilité par `CodePiece`**
  (§15.3.2 / §15.4).
- **`AuditLog`** — entrées **append-only chaînées par hash** (intégrité vérifiable),
  pour la piste d'audit inaltérable (§8).
- **`ReminderRule`** — cadence **éditable** (pas figée) ; valeurs par défaut posées
  par le seed (§6.1).

---

## Décisions par défaut (modifiables avec le cabinet)

En l'absence de réponses aux **points à confirmer** du brief (§14), le socle adopte
des défauts raisonnables, tous centralisés et modifiables :

1. **Cadence de relance** : J0 / J+7 / J+14 / J+21 / J+28 (escalade) — `lib/reminders/cadence.ts`, éditable en base via `ReminderRule`.
2. **Seuil de fiabilité IA** pour bascule `auto_autorise` : **90 %** sur volume ≥ 20 (§15.4) — `Setting` + `metrics/mvp.ts`.
3. **Envoi d'e-mails** : Microsoft Graph `sendMail` depuis une boîte partagée (`fiscal@bbassocies.ch`) — recommandation §6.2.
4. **Gestionnaire référent fixe** par client (`Client.gestionnaireId`) — hypothèse §14.2, ajustable.
5. **Hachage mot de passe** : `scrypt` (intégré) dans le socle ; **migrer vers argon2id en production** (§12) — `lib/auth/password.ts`.
6. **Fenêtre d'envoi** : 07:00 UTC, jours ouvrés (§6.1).

### Points à confirmer par le cabinet (§14)

1. Nom de domaine / tenant M365, drive/site OneDrive cible, boîte d'envoi partagée.
2. Attribution des clients (référent fixe vs libre).
3. Durée de conservation des données applicatives et règles de suppression (§9).
4. **Accord explicite** pour l'envoi de documents fiscaux à l'API Claude avec
   **Zero Data Retention + DPA** (§9/§14.4), ou exigence d'une IA auto-hébergée en Suisse.
5. Validation finale de la liste des pièces et des profils (§4.2).
6. Cadence de relance initiale et échéances du calendrier fiscal genevois.

---

## Conformité (§9)

- Données applicatives et **traitement IA** à héberger **en Suisse** (PostgreSQL CH,
  stockage objet CH pour les fichiers temporaires chiffrés).
- Fichiers temporaires chiffrés **avant validation**, **purgés** après dépôt OneDrive
  (champs `Document.tempStorageKey` / `purgedAt`, statut `PURGE`).
- API Claude utilisée en **Zero Data Retention** (à contractualiser, §14.4).
- Journal d'audit inaltérable et exportable (§8).

---

## Périmètre du MVP / bêta-test (§15)

- **Humain dans la boucle** : l'IA *propose*, un collaborateur *valide* avant dépôt.
- **Bêta-testeurs** : 8–15 particuliers salariés résidents suisses (le seed crée des
  clients de ce profil) ; indépendants / sociétés / frontaliers exclus du MVP.
- **4 métriques** instrumentées dès la Phase 1 (`lib/metrics/mvp.ts`) et exposées
  au tableau de bord : complétion en autonomie, fiabilité IA par pièce, points de
  décrochage, temps cabinet économisé.

---

## Reste à faire (Phase 1 → Phase 2)

- Authentification opérationnelle (Auth.js/Lucia) + activation de compte par lien (§8).
- Pipeline d'upload réel : stockage objet temporaire → OCR → `ai/client.ts` → file de
  validation → `graph/client.ts` (dépôt). BullMQ/Redis pour l'asynchrone (§12).
- Écran de file de validation (collaborateur) enregistrant `HumanReview.agreedWithAi`.
- Scheduler de relances branché sur `cadence.ts` + envoi Graph.
- Multilingue complet de l'interface (les 3 catalogues sont en place) et exports
  Crésus/Banana (ZIP + CSV, §10) — prévus Phase 2/3.
```
