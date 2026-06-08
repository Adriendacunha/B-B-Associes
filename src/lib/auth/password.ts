// Hachage de mot de passe (§8/§12).
//
// NOTE PRODUCTION : le brief recommande argon2id (§12). Pour éviter une dépendance
// native dans ce socle, on utilise scrypt (intégré à Node) avec sel aléatoire et
// comparaison à temps constant. Migrer vers argon2 en production est trivial :
// remplacer `hashPassword`/`verifyPassword` ci-dessous.

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(plain, salt, KEYLEN)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const derived = (await scryptAsync(plain, salt, KEYLEN)) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
