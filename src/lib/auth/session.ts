// Sessions applicatives par cookie httpOnly (§8). L'identifiant de session (cuid)
// est le jeton ; aucune donnée sensible côté client. Expiration glissante :
// chaque accès repousse l'échéance, d'où une déconnexion après inactivité.

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Client, User } from '@prisma/client';
import { prisma } from '@/lib/db';
import { sessionExpiry } from './lockout';

export const SESSION_COOKIE = 'bb_session';

type PrincipalType = 'STAFF' | 'CLIENT';

/** Crée une session et pose le cookie (à appeler depuis une server action). */
export async function createSession(principalType: PrincipalType, subjectId: string): Promise<void> {
  const expiresAt = sessionExpiry();
  // Jeton de session cryptographiquement aléatoire (256 bits) — sert de secret de
  // cookie ; on n'utilise PAS le cuid par défaut (entropie insuffisante).
  const token = randomBytes(32).toString('base64url');
  const session = await prisma.session.create({ data: { id: token, principalType, subjectId, expiresAt } });
  const store = await cookies();
  store.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/** Supprime la session courante et efface le cookie (logout). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (id) {
    await prisma.session.deleteMany({ where: { id } });
    store.delete(SESSION_COOKIE);
  }
}

export type CurrentPrincipal =
  | { type: 'STAFF'; user: User }
  | { type: 'CLIENT'; client: Client }
  | null;

/**
 * Lit la session courante, vérifie l'expiration et la fait glisser (inactivité).
 * Renvoie le principal (collaborateur ou client) ou null.
 */
export async function getCurrentPrincipal(): Promise<CurrentPrincipal> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id) return null;

  try {
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      await prisma.session.deleteMany({ where: { id } });
      return null;
    }

    // Expiration glissante (déconnexion après inactivité §8).
    await prisma.session.update({
      where: { id },
      data: { lastSeenAt: new Date(), expiresAt: sessionExpiry() },
    });

    if (session.principalType === 'STAFF') {
      const user = await prisma.user.findUnique({ where: { id: session.subjectId } });
      return user && user.active ? { type: 'STAFF', user } : null;
    }
    const client = await prisma.client.findUnique({ where: { id: session.subjectId } });
    return client ? { type: 'CLIENT', client } : null;
  } catch (err) {
    // Base injoignable (ex. variables d'environnement manquantes sur un
    // déploiement) : on échoue « fermé » (déconnecté) au lieu de faire planter
    // l'ensemble du site, pour que les pages publiques / la connexion restent
    // accessibles. L'erreur est tracée pour diagnostic.
    console.error('[getCurrentPrincipal] lecture de session impossible :', err);
    return null;
  }
}

/** Garde de route : exige un collaborateur connecté, sinon redirige vers /login. */
export async function requireStaff(locale: string): Promise<User> {
  const principal = await getCurrentPrincipal();
  if (!principal || principal.type !== 'STAFF') redirect(`/${locale}/login`);
  return principal.user;
}

/** Garde de route : exige un client connecté, sinon redirige vers son espace (login). */
export async function requireClient(locale: string): Promise<Client> {
  const principal = await getCurrentPrincipal();
  if (!principal || principal.type !== 'CLIENT') redirect(`/${locale}/espace`);
  return principal.client;
}
