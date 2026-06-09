# B&B Associés — Espace client de collecte documentaire

Application web de collecte de documents fiscaux pour la fiduciaire **B&B Associés**
(Route des Acacias 24, 1227 Carouge / Genève). Elle permet à chaque client de
déposer ses pièces via une **checklist dynamique**, vérifiées par IA (humain dans
la boucle), rangées automatiquement dans le **OneDrive Business** du cabinet, avec
**relances** configurables et **tableau de bord** de suivi.

Ce dépôt contient le **socle de la Phase 1 (MVP)** décrite dans le brief : modèle de
données complet, logique métier centrale **testée**, référentiel de pièces genevois,
modèles d'e-mails et squelette d'application Next.js multilingue.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fadriendacunha%2Fb-b-associes&env=DATABASE_URL,DIRECT_URL&envDescription=Connexion%20PostgreSQL%20(et%20URL%20directe%20pour%20les%20migrations)%20%E2%80%94%20voir%20.env.example&stores=%5B%7B%22type%22%3A%22postgres%22%7D%5D)

> Le build Vercel **migre et seed** la base automatiquement (voir §Déploiement).

> **Statut** : socle fonctionnel et testé (57 tests verts, `next build` OK). Le
> parcours Phase 1 (profilage → checklist → dépôt → verdict IA → validation) est
> opérationnel sur PostgreSQL. Les intégrations externes (Microsoft Graph, API
> Claude) ont un mode démo par défaut et s'activent par variables d'environnement.

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
| `npm test` | tests unitaires (logique métier pure, sans base) |
| `npm run test:integration` | tests d'intégration (nécessite `DATABASE_URL` migrée + seedée) |
| `npm run test:e2e` | tests de bout en bout Playwright (parcours réel dans un navigateur) |
| `npm run typecheck` | vérification TypeScript de tout le projet |
| `npm run build` | build de production Next.js |
| `npm run db:seed` | charge le référentiel + données de démonstration |

**Intégration continue** : `.github/workflows/ci.yml` exécute à chaque push/PR
(1) types + tests unitaires + build, (2) tests d'intégration contre un PostgreSQL
éphémère (migrations + seed + `*.itest.ts`), et (3) tests **E2E Playwright** qui
rejouent le parcours réel (onboarding → dépôt → analyse → validation) dans un
navigateur. Localement : `npm run dev` puis `npm run test:e2e`.

---

## Déploiement sur Vercel (clé en main, avec base de données)

Le déploiement est **automatisé** : le build Vercel (`scripts/vercel-build.mjs`,
référencé par `vercel.json`) applique les **migrations** puis **seed** la base
(idempotent) avant de builder, dès qu'une base est attachée. Sans base, il bâtit
quand même les pages de démonstration.

### Étapes

1. **Importer** le dépôt sur Vercel — [vercel.com/new](https://vercel.com/new),
   connexion GitHub, choisir `adriendacunha/b-b-associes`
   (branche `claude/bb-associes-doc-collection-nET6F`). Next.js est détecté seul.
2. **Ajouter une base PostgreSQL.** Le plus simple : onglet **Storage → Create
   Database → Postgres** (Vercel Postgres / Neon). Vercel injecte alors les
   variables `POSTGRES_*` dans le projet.
3. **Renseigner 2 variables d'environnement** (Project → Settings → Environment
   Variables) :

   | Variable | Valeur |
   |---|---|
   | `DATABASE_URL` | URL **poolée** de la base (= `POSTGRES_PRISMA_URL` si Vercel Postgres) |
   | `DIRECT_URL` | URL **directe** non poolée (= `POSTGRES_URL_NON_POOLING`) |

   > Sur une base Postgres « classique » (Infomaniak/Exoscale en Suisse, §9),
   > mettez la **même** chaîne dans les deux.

4. **Redéployer** (Deployments → Redeploy). Le build migre + seed automatiquement.
   L'URL `https://<projet>.vercel.app` expose alors le portail complet, base incluse.

### Variables optionnelles (intégrations réelles — sinon mode démo)

| Variable | Effet si absente |
|---|---|
| `ANTHROPIC_API_KEY` | analyse documentaire via **analyseur de démonstration** (stub) au lieu de l'API Claude (§7) |
| `MS_GRAPH_*` | dépôt OneDrive **simulé** (chemin calculé, pas d'envoi) (§5/§6.2) |
| `CRON_SECRET` | le **cron de relances** (`/api/cron/reminders`) répond 503 tant qu'il n'est pas défini ; le déclenchement manuel depuis le tableau de bord reste possible (§6.1) |

Voir `.env.example` pour la liste complète.

> ⚠️ Une URL `*.vercel.app` est **publique**. Les données seedées sont des
> **données de démonstration**. Pour restreindre l'accès : Project → Settings →
> **Deployment Protection → Vercel Authentication**.

---

## Architecture du code

```
src/
  app/[locale]/            Pages Next.js (i18n) : accueil, /espace, /tableau-de-bord,
                           /profilage (formulaire), /campagne/[id] (vue DB-backed)
  app/actions/            Server actions (createCampaign : persiste + journalise)
  components/              Composants UI (sélecteur de langue, ProfilageForm…)
  i18n/                    Routing + catalogues de messages FR/EN/DE
  data/
    piece-referential.ts   Référentiel ÉDITABLE des pièces genevoises (§4.2)
    email-templates.ts     Modèles d'e-mails par défaut, 3 langues (§6.3)
  lib/
    onedrive/paths.ts      Arborescence + nommage de fichiers OneDrive (§5)  ✓ testé
    reminders/cadence.ts   Moteur de relance configurable (§6.1)            ✓ testé
    checklist/profiling.ts Profilage → checklist dynamique (§4.1/§4.3)      ✓ testé
    checklist/build.ts     Profil + référentiel → lignes de checklist (§4)  ✓ testé
    ai/verification.ts     Contrat prompt + schéma JSON du verdict IA (§7.2) ✓ testé
    ai/client.ts           Appel réel à l'API Claude (ZDR, §7/§9)
    metrics/mvp.ts         Les 4 métriques MVP (§15.3)                       ✓ testé
    audit/chain.ts         Journal d'audit inaltérable chaîné (§8)           ✓ testé
    audit/log.ts           Écriture chaînée du journal en base (§8)
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

- **Hébergement en Suisse** : déploiement **auto-hébergeable** via `Dockerfile` +
  `docker-compose.yml` (app + PostgreSQL + reverse-proxy Caddy/TLS) sur un datacenter
  suisse (Infomaniak/Exoscale/Hidora) — voir §Déploiement auto-hébergé. C'est la voie
  recommandée pour de vraies données fiscales (Vercel n'a pas de région CH).
- **Chiffrement au repos** des fichiers temporaires : **AES-256-GCM** dès que
  `STORAGE_ENCRYPTION_KEY` est défini (`lib/storage/crypto`). _Vérifié : fichier
  ciphertext sur disque, déchiffré uniquement à l'usage._ Chiffrement **en transit**
  par le reverse-proxy TLS.
- **Conservation / purge** (§9, §14.3) : `lib/retention` + cron `GET /api/cron/retention`
  supprime la copie temporaire des pièces finalisées au-delà de `RETENTION_DAYS`
  (défaut 180 j) — seule subsiste la copie OneDrive. Journalisé `RETENTION_RUN`.
- API Claude utilisée en **Zero Data Retention** (à contractualiser, §14.4).
- Journal d'audit inaltérable et exportable (§8).

### Sécurité (état)

- **Autorisation au niveau des mutations** : chaque server action sensible vérifie la
  session (`requireStaff` / contrôle d'appartenance client) — pas seulement la page.
  Un client ne peut déposer que sur **sa** campagne ; valider/relancer/exporter est
  réservé au cabinet. Le réviseur enregistré est le collaborateur **réellement connecté**.
- **Jetons de session** : secret aléatoire 256 bits (cookie httpOnly, `SameSite=Lax`,
  `Secure` en prod), expiration glissante. Verrouillage après 5 échecs.
- **À durcir ensuite** : sérialisation/vérification planifiée de la chaîne d'audit,
  throttling IP au login, 2FA (TOTP).

## Déploiement auto-hébergé (Suisse)

Sur un VPS d'un datacenter suisse :

```bash
cp .env.example .env   # renseigner DB, STORAGE_ENCRYPTION_KEY (openssl rand -hex 32),
                       # CRON_SECRET, PUBLIC_DOMAIN, secrets Graph/Claude
docker compose up -d --build
docker compose run --rm app node_modules/.bin/tsx prisma/seed.ts   # seed initial
```

Caddy obtient un certificat TLS automatiquement pour `PUBLIC_DOMAIN`. Les migrations
s'appliquent au démarrage du conteneur ; le build Next **standalone** embarque l'OCR
(`tessdata/`) et le moteur Prisma. Crons (relances, purge) à déclencher via cron
système appelant `/api/cron/*` avec `Authorization: Bearer $CRON_SECRET`.

---

## Onboarder un bêta-testeur (§15.2)

Une fois l'app déployée (Vercel ou Docker/Suisse) :

1. Le cabinet se connecte (`/login`) puis ouvre **Clients / bêta-testeurs** (`/clients`).
2. **Créer le client** (code, nom, e-mail, langue) → un **lien d'activation** s'affiche.
3. Transmettre ce lien au bêta-testeur (par e-mail manuel ; ou automatiquement via
   Microsoft Graph si `MS_GRAPH_*` est configuré). Le testeur **définit son mot de
   passe** et accède à son espace.
4. Le cabinet ouvre une **campagne** pour ce client (**Ouvrir une campagne** → profilage).
5. Le testeur dépose ses pièces ; le cabinet **valide** dans la file (`/validation`).

> Pour mesurer la **fiabilité IA réelle** (§15.3), configurer `ANTHROPIC_API_KEY`
> (sinon l'analyseur de démonstration est utilisé). Pour des e-mails réels, configurer
> `MS_GRAPH_*` (sinon les e-mails sont consignés dans la boîte d'envoi `/emails`).

## Périmètre du MVP / bêta-test (§15)

- **Humain dans la boucle** : l'IA *propose*, un collaborateur *valide* avant dépôt.
- **Bêta-testeurs** : 8–15 particuliers salariés résidents suisses (le seed crée des
  clients de ce profil) ; indépendants / sociétés / frontaliers exclus du MVP.
- **4 métriques** instrumentées dès la Phase 1 (`lib/metrics/mvp.ts`) et exposées
  au tableau de bord : complétion en autonomie, fiabilité IA par pièce, points de
  décrochage, temps cabinet économisé.

---

## Fait

- **Profilage → checklist dynamique (§4)** : formulaire `/profilage` avec aperçu
  en direct, `createCampaign` qui persiste la campagne + la checklist et journalise.
- **Dépôt + verdict IA + file de validation (§7/§15.1)** : dépôt par pièce, analyse
  (API Claude ou analyseur de démonstration), file `/validation` où le collaborateur
  tranche (`HumanReview.agreedWithAi`), nommage + dépôt OneDrive à la validation.
- **Authentification (§8)** : sessions par cookie httpOnly (table `Session`), connexion
  cabinet (`/login`) et client (`/espace`), activation de compte par lien (`/activation`),
  verrouillage après échecs, déconnexion, expiration glissante (inactivité), protection
  des routes cabinet, journalisation `LOGIN`/`LOGOUT`/`LOGIN_FAILED`. _Testé e2e._

  Identifiants de démonstration (créés par le seed, **dev local uniquement**) :
  - Cabinet : `collab@bbassocies.ch` / `changeme-collab` · `admin@bbassocies.ch` / `changeme-admin`
  - Clients : `jean.dupont@example.ch` / `changeme-client` · `anna.muller@example.ch` / `changeme-client`

  > **Production** : définissez `ADMIN_PASSWORD` et `COLLAB_PASSWORD` (variables
  > d'environnement) — le dépôt étant public, les mots de passe par défaut sont
  > connus. Le seed met à jour ces comptes à chaque (re)déploiement.
- **Relances e-mail (§6)** : invitation + relances manuelles, et **moteur automatique**
  (`processDueReminders`) respectant la cadence configurable (arrêt si complet, suspension,
  ciblage des seules pièces en attente). Envoi via Microsoft Graph si configuré, sinon
  **boîte d'envoi interne** `/emails` (« Éléments envoyés »). Journalisé `EMAIL_SENT`.
- **Tableau de bord réel (§11/§15.3)** : complétude, statut, prochaine relance et les
  4 métriques calculés sur les **vraies données** (fiabilité IA depuis `HumanReview`).
- **Exports Crésus / Banana (§10)** : `lib/export/dossier` produit un **CSV
  récapitulatif** (client, pièces, statut, dates — séparateur `;`, BOM UTF-8) et un
  **ZIP** des pièces validées correctement nommées (§5.3) + ce CSV. Téléchargement
  réservé au cabinet via `GET /api/export/dossier/[campaignId]` (`?format=csv` pour le
  CSV seul). En prod, les fichiers sont récupérés depuis OneDrive ; en démo, depuis le
  stockage temporaire conservé. Journalisé `EXPORT_DOSSIER` / `EXPORT_CSV`. _Vérifié e2e._
- **Relances 100 % automatiques (§6.1)** : moteur partagé `lib/reminders/run` exposé
  via un **cron sécurisé** `GET /api/cron/reminders` (en-tête `Authorization: Bearer
  CRON_SECRET`), déclaré dans `vercel.json` (Vercel Cron, quotidien 07:00 UTC).
  Idempotent (ne renvoie jamais deux fois le même palier). _Vérifié e2e : 401 sans
  secret ; avec secret, envoie RELANCE_1/2/3 selon la cadence, 0 au second passage._
- **Extraction de texte / OCR (§7.2)** : `lib/ocr/extract` — texte (UTF-8), **PDF
  numériques** (pdf-parse, sans réseau) et **OCR** des images / PDF scannés
  (Tesseract via `tessdata/` local, hors-ligne). Best-effort : toute défaillance
  retombe proprement sans bloquer le dépôt. Le verdict IA s'appuie désormais sur le
  **contenu réel** du document. _Vérifié : un PDF au nom neutre est jugé conforme
  d'après son texte (année + type détectés)._

## Reste à faire (Phase 1 → Phase 2)

- **2FA (TOTP)** pour les collaborateurs (champ `User.totpSecret` déjà prévu) +
  réinitialisation de mot de passe par e-mail (§8).
- Dépôt OneDrive réel via Microsoft Graph en production (la logique est prête).
- Édition du référentiel de pièces / cadence / gabarits d'e-mails dans une UI admin
  (aujourd'hui via le seed).
- Multilingue complet de l'interface (les 3 catalogues sont en place).
- 2FA (TOTP) collaborateurs + réinitialisation de mot de passe par e-mail (§8).
```
