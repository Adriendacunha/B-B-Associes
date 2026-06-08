// Verrouillage de compte après tentatives de connexion échouées (§8). Logique pure.

export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;
/** Durée de session (déconnexion automatique après inactivité, §8). */
export const SESSION_TTL_MINUTES = 60;

/** Le compte est-il verrouillé à l'instant `now` ? */
export function isLocked(lockedUntil: Date | null | undefined, now: Date = new Date()): boolean {
  return lockedUntil != null && lockedUntil.getTime() > now.getTime();
}

export interface FailureState {
  failedLoginCount: number;
  lockedUntil: Date | null;
}

/**
 * Enregistre un échec : incrémente le compteur et verrouille au-delà du seuil.
 */
export function registerFailure(currentCount: number, now: Date = new Date()): FailureState {
  const failedLoginCount = currentCount + 1;
  const lockedUntil =
    failedLoginCount >= MAX_ATTEMPTS ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null;
  return { failedLoginCount, lockedUntil };
}

/** Réinitialise l'état après une connexion réussie. */
export function resetFailures(): FailureState {
  return { failedLoginCount: 0, lockedUntil: null };
}

/** Date d'expiration d'une nouvelle session. */
export function sessionExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_TTL_MINUTES * 60_000);
}
