# Configuration des e-mails (relances) — Microsoft Graph

Ce guide active l'**envoi réel** des e-mails (invitations + relances) pour un
bêta-test crédible. Le canal recommandé est **Microsoft Graph**, depuis une boîte
partagée du tenant Microsoft 365 du cabinet : les données restent dans le tenant
(résidence §9) et une seule app Azure servira aussi, plus tard, à **lire** les
réponses entrantes (tri automatique des pièces jointes).

> Tant que ces variables ne sont pas configurées, l'application reste en **mode
> démo** : les e-mails sont seulement journalisés dans `/emails` (ils ne partent
> pas). La bannière en haut de la page `/emails` indique le mode actif.

## Quel canal choisir ?

| Canal | Pour qui | Mise en place |
| --- | --- | --- |
| **SMTP (Gmail / Google Workspace)** | Tester vite, côté **Google Workspace** | ~5 min, voir §0 |
| **Microsoft Graph** | **Production** cabinet (M365 d'Haydar) + futur **entrant** | app Azure, voir §1+ |

Ordre de priorité dans le code : **Graph** s'il est configuré, sinon **SMTP**,
sinon mode démo. On peut donc laisser SMTP branché pour les tests et basculer
automatiquement sur Graph dès qu'il est renseigné.

---

## 0. Voie rapide — SMTP avec Gmail / Google Workspace (test)

Idéal pour tester les relances depuis une boîte Google, sans rien créer sur Azure.

1. Sur le compte Google : activer la **validation en 2 étapes**.
2. Créer un **mot de passe d'application** :
   https://myaccount.google.com/apppasswords (16 caractères). ⚠️ Ce n'est PAS le
   mot de passe du compte ; le mot de passe normal est refusé par le SMTP Google.
3. Renseigner les variables (Vercel → *Environment Variables*, ou `.env`) :

   ```
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT="465"
   SMTP_USER="vous@votredomaine.ch"
   SMTP_PASSWORD="xxxx xxxx xxxx xxxx"
   SMTP_FROM="B&B Associés <vous@votredomaine.ch>"

   NEXT_PUBLIC_APP_URL="https://b-b-associes-rkke.vercel.app"
   CRON_SECRET="<chaîne aléatoire forte>"
   ```

4. Redéployer. Sur `/emails`, la bannière doit afficher **« Envoi réel actif
   (SMTP) »**, puis utiliser **« Envoyer un test »** (cf. §6).

> Workspace impose des quotas d'envoi (quelques centaines/jour) — largement
> suffisant pour un bêta. Pour la production cabinet, on passe à Graph (ci-dessous).

---

## 1. Créer l'app registration Azure AD

1. Portail Azure → **Microsoft Entra ID** (anciennement Azure AD) → **App
   registrations** → **New registration**.
2. Nom : `B&B Associés — Collecte`. Comptes : *Single tenant*. **Register**.
3. Noter, sur la page **Overview** :
   - **Application (client) ID** → `MS_GRAPH_CLIENT_ID`
   - **Directory (tenant) ID** → `MS_GRAPH_TENANT_ID`

## 2. Créer un secret client

1. App → **Certificates & secrets** → **New client secret**.
2. Description + expiration (ex. 12 mois) → **Add**.
3. Copier **immédiatement** la *Value* (visible une seule fois)
   → `MS_GRAPH_CLIENT_SECRET`.

## 3. Permissions d'application

App → **API permissions** → **Add a permission** → **Microsoft Graph** →
**Application permissions** :

| Permission       | Pour quoi                                   | Étape          |
| ---------------- | ------------------------------------------- | -------------- |
| `Mail.Send`      | Envoyer les invitations / relances          | Relances (now) |
| `Files.ReadWrite.All` | Déposer les pièces validées sur OneDrive | OneDrive       |
| `Mail.ReadWrite` | Lire les réponses entrantes (pièces jointes)| Entrant (plus tard) |

Puis **Grant admin consent** (un administrateur du tenant doit valider).

> Pour les **relances seules**, seule `Mail.Send` est nécessaire.

### Restreindre l'envoi à une seule boîte (recommandé)

`Mail.Send` en application autorise l'envoi depuis *n'importe quelle* boîte. Pour
limiter à la boîte partagée d'envoi, créer une **Application Access Policy**
(PowerShell Exchange Online) ciblant `MS_GRAPH_SENDER_ADDRESS`.

## 4. Boîte d'envoi

Utiliser une **boîte partagée** dédiée (ex. `fiscal@bbassocies.ch`) →
`MS_GRAPH_SENDER_ADDRESS`. Les e-mails apparaîtront dans ses « Éléments envoyés ».

---

## 5. Variables d'environnement

À renseigner (Vercel → *Settings → Environment Variables*, ou `.env` en
self-hosting) :

```
MS_GRAPH_TENANT_ID="…"
MS_GRAPH_CLIENT_ID="…"
MS_GRAPH_CLIENT_SECRET="…"
MS_GRAPH_SENDER_ADDRESS="fiscal@bbassocies.ch"

# ⚠️ URL publique réelle : base des liens d'activation/espace dans les e-mails.
NEXT_PUBLIC_APP_URL="https://b-b-associes-rkke.vercel.app"

# Relances automatiques (cron quotidien). Vercel ajoute l'en-tête Bearer.
CRON_SECRET="<chaîne aléatoire forte>"
```

`MS_GRAPH_DRIVE_ID` reste **optionnel** tant qu'on ne dépose pas sur OneDrive.

Redéployer après modification des variables.

---

## 6. Vérifier

1. Ouvrir **`/emails`** : la bannière doit afficher **« Envoi réel actif »**
   (verte) — avec le canal détecté (Microsoft Graph ou SMTP). Sinon, une variable
   manque.
2. Section **« Tester le canal d'envoi »** : saisir votre adresse → **Envoyer un
   test**. Vous devez recevoir l'e-mail (vérifier les indésirables au 1er envoi).
3. Créer un client de test, **Envoyer l'invitation** : il reçoit le lien
   d'activation pointant vers `NEXT_PUBLIC_APP_URL`.

## 7. Relances automatiques

Le cron `vercel.json` (`/api/cron/reminders`, tous les jours à 07:00 UTC) déclenche
la séquence `RELANCE_1 → 2 → 3` selon la cadence, et s'arrête dès qu'un dossier est
complet. Il exige `CRON_SECRET`. Le bouton **« Traiter les relances dues »** (tableau
de bord) déclenche le même moteur manuellement.

---

## Dépannage

| Symptôme | Cause probable |
| --- | --- |
| Bannière reste « Mode démo » | une des 4 variables Graph (dont `SENDER_ADDRESS`) manque |
| E-mail en statut `FAILED` | consentement admin non accordé, secret expiré, ou `Mail.Send` absente |
| `ErrorAccessDenied` sur la boîte | Application Access Policy trop restrictive / mauvaise adresse |
| Liens cassés chez le testeur | `NEXT_PUBLIC_APP_URL` encore sur localhost |
