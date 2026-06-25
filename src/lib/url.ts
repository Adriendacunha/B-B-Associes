import { headers } from 'next/headers';

/**
 * Base URL pour construire les liens (activation, espace). Priorité aux en-têtes
 * de la requête (host réel : preview/prod corrects), repli sur NEXT_PUBLIC_APP_URL
 * (utile hors contexte requête, ex. cron). Évite une URL en dur.
 */
export async function baseUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (host) {
      const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
      return `${proto}://${host}`;
    }
  } catch {
    /* pas de contexte requête */
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}
