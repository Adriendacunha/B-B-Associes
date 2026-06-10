// Intégration Microsoft Graph : dépôt OneDrive Business (§5) + envoi e-mail
// `sendMail` depuis une boîte partagée (§6.2). Authentification applicative
// OAuth2 client_credentials (app registration Azure AD du cabinet).
//
// ⚠️ Nécessite la configuration du tenant (§14.1) via les variables d'environnement
// MS_GRAPH_* (voir .env.example). Tant que ces valeurs ne sont pas fournies, les
// appels échoueront explicitement — c'est volontaire (pas de dépôt silencieux).
//
// La configuration est découplée : l'AUTHENTIFICATION (tenant/client/secret) est
// commune ; l'ENVOI e-mail ne requiert que l'adresse expéditrice, et le DÉPÔT
// OneDrive ne requiert que l'identifiant de drive. On peut donc activer les
// relances e-mail sans configurer OneDrive (utile pour un bêta-test).

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

interface GraphAuth {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

/** Variables communes à tout appel Graph (jeton OAuth2). */
function loadAuth(): GraphAuth {
  const auth = {
    tenantId: process.env.MS_GRAPH_TENANT_ID ?? '',
    clientId: process.env.MS_GRAPH_CLIENT_ID ?? '',
    clientSecret: process.env.MS_GRAPH_CLIENT_SECRET ?? '',
  };
  const missing = Object.entries(auth)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(
      `Microsoft Graph non configuré (variables manquantes : ${missing.join(', ')}). Voir §14.1 / .env.example.`,
    );
  }
  return auth;
}

/** Drive cible — requis uniquement pour le dépôt OneDrive (§5). */
function requireDriveId(): string {
  const driveId = process.env.MS_GRAPH_DRIVE_ID ?? '';
  if (!driveId) throw new Error('MS_GRAPH_DRIVE_ID manquant (dépôt OneDrive). Voir .env.example.');
  return driveId;
}

/** Adresse expéditrice — requise uniquement pour l'envoi e-mail (§6.2). */
function requireSender(): string {
  const sender = process.env.MS_GRAPH_SENDER_ADDRESS ?? '';
  if (!sender) throw new Error('MS_GRAPH_SENDER_ADDRESS manquant (envoi e-mail). Voir .env.example.');
  return sender;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(auth: GraphAuth): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const url = `https://login.microsoftonline.com/${auth.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: auth.clientId,
    client_secret: auth.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const res = await fetch(url, { method: 'POST', body });
  if (!res.ok) throw new Error(`Échec d'authentification Graph: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

async function graphFetch(path: string, init: RequestInit, auth = loadAuth()): Promise<Response> {
  const token = await getAccessToken(auth);
  return fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
}

/**
 * Crée (idempotent) un dossier dans le drive, sous un chemin parent donné.
 * Graph crée les segments un à un ; on utilise `conflictBehavior: replace`→`fail`
 * pour rester idempotent sans écraser le contenu existant.
 */
async function ensureFolder(parentPath: string, name: string, driveId: string, auth: GraphAuth): Promise<void> {
  const encodedParent = encodeURIComponent(parentPath).replace(/%2F/g, '/');
  const endpoint =
    parentPath === ''
      ? `/drives/${driveId}/root/children`
      : `/drives/${driveId}/root:/${encodedParent}:/children`;
  const res = await graphFetch(
    endpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
    },
    auth,
  );
  // 409 = déjà existant : acceptable (idempotence).
  if (!res.ok && res.status !== 409) {
    throw new Error(`Création dossier "${name}" échouée: ${res.status} ${await res.text()}`);
  }
}

/**
 * Crée l'arborescence complète d'une campagne (§5.1/§5.2).
 * `folders` doit être la liste ordonnée renvoyée par campaignFolderTree() — chemins
 * absolus commençant par "/". On crée chaque niveau séquentiellement.
 */
export async function ensureCampaignTree(folders: string[]): Promise<void> {
  const auth = loadAuth();
  const driveId = requireDriveId();
  // On dérive l'ensemble des segments à créer dans l'ordre de profondeur.
  const seen = new Set<string>();
  for (const folder of folders) {
    const segments = folder.replace(/^\//, '').split('/');
    let parent = '';
    for (const seg of segments) {
      const full = parent ? `${parent}/${seg}` : seg;
      if (!seen.has(full)) {
        await ensureFolder(parent, seg, driveId, auth);
        seen.add(full);
      }
      parent = full;
    }
  }
}

/**
 * Dépose un fichier validé sur OneDrive au chemin final (§5.3).
 * `targetPath` est absolu (commence par "/"). Pour > 4 Mo, utiliser une session
 * d'upload (uploadSession) — non couvert ici car les pièces fiscales sont petites.
 */
export async function uploadValidatedFile(
  targetPath: string,
  content: Buffer | Uint8Array,
  contentType = 'application/pdf',
): Promise<{ id: string; webUrl: string }> {
  const auth = loadAuth();
  const driveId = requireDriveId();
  const clean = targetPath.replace(/^\//, '');
  const encoded = encodeURIComponent(clean).replace(/%2F/g, '/');
  const res = await graphFetch(
    `/drives/${driveId}/root:/${encoded}:/content`,
    { method: 'PUT', headers: { 'Content-Type': contentType }, body: content as BodyInit },
    auth,
  );
  if (!res.ok) throw new Error(`Dépôt OneDrive échoué: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { id: string; webUrl: string };
  return { id: json.id, webUrl: json.webUrl };
}

/** Télécharge le contenu d'un fichier OneDrive (pour l'export de dossier §10). */
export async function downloadValidatedFile(targetPath: string): Promise<Buffer> {
  const auth = loadAuth();
  const driveId = requireDriveId();
  const clean = targetPath.replace(/^\//, '');
  const encoded = encodeURIComponent(clean).replace(/%2F/g, '/');
  const res = await graphFetch(`/drives/${driveId}/root:/${encoded}:/content`, { method: 'GET' }, auth);
  if (!res.ok) throw new Error(`Téléchargement OneDrive échoué: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Envoie un e-mail via `sendMail` depuis la boîte partagée du cabinet (§6.2).
 * Les e-mails apparaissent dans les « Éléments envoyés » de la boîte.
 */
export async function sendMail(params: {
  to: string;
  subject: string;
  body: string;
  cc?: string[];
}): Promise<void> {
  const auth = loadAuth();
  const sender = requireSender();
  const message = {
    message: {
      subject: params.subject,
      body: { contentType: 'Text', content: params.body },
      toRecipients: [{ emailAddress: { address: params.to } }],
      ccRecipients: (params.cc ?? []).map((a) => ({ emailAddress: { address: a } })),
    },
    saveToSentItems: true,
  };
  const res = await graphFetch(
    `/users/${encodeURIComponent(sender)}/sendMail`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message) },
    auth,
  );
  if (!res.ok) throw new Error(`Envoi e-mail échoué: ${res.status} ${await res.text()}`);
}
