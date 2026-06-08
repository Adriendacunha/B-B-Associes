// Stockage temporaire des fichiers AVANT validation (§5/§9).
//
// MVP : système de fichiers local sous os.tmpdir(), CHIFFRÉ AU REPOS (§9) dès que
// STORAGE_ENCRYPTION_KEY est défini (AES-256-GCM, voir storage/crypto). EN
// PRODUCTION, viser un stockage objet chiffré hébergé en Suisse (S3-compatible,
// ex. Exoscale SOS), avec purge après dépôt OneDrive (voir lib/retention).
// L'interface (storeTemp/readTemp/purgeTemp) reste remplaçable sans toucher au reste.

import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { deriveKey, encryptBuffer, decryptBuffer, isEncrypted } from './crypto';

const DIR = join(tmpdir(), 'bb-uploads');

function storageKey(): Buffer | null {
  const secret = process.env.STORAGE_ENCRYPTION_KEY;
  return secret ? deriveKey(secret) : null;
}

export async function storeTemp(content: Buffer, ext: string): Promise<string> {
  await mkdir(DIR, { recursive: true });
  const key = `${randomUUID()}.${(ext || 'bin').replace(/^\./, '')}`;
  const cryptoKey = storageKey();
  const data = cryptoKey ? encryptBuffer(content, cryptoKey) : content;
  await writeFile(join(DIR, key), data);
  return key;
}

export async function readTemp(key: string): Promise<Buffer> {
  const raw = await readFile(join(DIR, key));
  const cryptoKey = storageKey();
  if (cryptoKey) return decryptBuffer(raw, cryptoKey);
  if (isEncrypted(raw)) {
    throw new Error('Fichier chiffré mais STORAGE_ENCRYPTION_KEY absente.');
  }
  return raw;
}

export async function purgeTemp(key: string): Promise<void> {
  try {
    await unlink(join(DIR, key));
  } catch {
    // déjà supprimé : sans conséquence
  }
}
