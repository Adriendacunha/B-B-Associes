// Chiffrement au repos des fichiers temporaires (§9 : « documents temporaires
// chiffrés »). AES-256-GCM (confidentialité + intégrité authentifiée).
//
// Format du conteneur : MAGIC(4) | IV(12) | TAG(16) | CIPHERTEXT.
// Pur et testable ; la clé provient de STORAGE_ENCRYPTION_KEY (voir storage/temp).

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const MAGIC = Buffer.from('BBE1'); // marqueur de fichier chiffré
const SCRYPT_SALT = 'bb-associes-storage-v1'; // sel fixe pour dériver la clé d'une passphrase

/** Dérive une clé 32 octets : hex 64 caractères tel quel, sinon scrypt(passphrase). */
export function deriveKey(secret: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(secret)) return Buffer.from(secret, 'hex');
  return scryptSync(secret, SCRYPT_SALT, 32);
}

export function isEncrypted(buf: Buffer): boolean {
  return buf.length >= 32 && buf.subarray(0, 4).equals(MAGIC);
}

export function encryptBuffer(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, iv, tag, ct]);
}

/** Déchiffre un conteneur ; renvoie tel quel un contenu non chiffré (compat). */
export function decryptBuffer(buf: Buffer, key: Buffer): Buffer {
  if (!isEncrypted(buf)) return buf;
  const iv = buf.subarray(4, 16);
  const tag = buf.subarray(16, 32);
  const ct = buf.subarray(32);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]); // throw si altéré
}
