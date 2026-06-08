import { describe, it, expect } from 'vitest';
import { isLocked, registerFailure, resetFailures, sessionExpiry, MAX_ATTEMPTS, LOCK_MINUTES } from './lockout';

const now = new Date('2026-06-08T10:00:00Z');

describe('isLocked', () => {
  it('verrouillé si lockedUntil dans le futur', () => {
    expect(isLocked(new Date('2026-06-08T10:05:00Z'), now)).toBe(true);
    expect(isLocked(new Date('2026-06-08T09:55:00Z'), now)).toBe(false);
    expect(isLocked(null, now)).toBe(false);
  });
});

describe('registerFailure (§8)', () => {
  it('incrémente sans verrouiller sous le seuil', () => {
    const s = registerFailure(2, now);
    expect(s.failedLoginCount).toBe(3);
    expect(s.lockedUntil).toBeNull();
  });
  it('verrouille au seuil atteint', () => {
    const s = registerFailure(MAX_ATTEMPTS - 1, now);
    expect(s.failedLoginCount).toBe(MAX_ATTEMPTS);
    expect(s.lockedUntil).toEqual(new Date(now.getTime() + LOCK_MINUTES * 60_000));
  });
});

describe('resetFailures / sessionExpiry', () => {
  it('remet à zéro', () => {
    expect(resetFailures()).toEqual({ failedLoginCount: 0, lockedUntil: null });
  });
  it('expiration future', () => {
    expect(sessionExpiry(now).getTime()).toBeGreaterThan(now.getTime());
  });
});
