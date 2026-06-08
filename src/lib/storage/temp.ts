// Stockage temporaire des fichiers AVANT validation (§5/§9).
//
// MVP : système de fichiers local sous os.tmpdir(). EN PRODUCTION, le brief impose
// un stockage objet CHIFFRÉ hébergé en Suisse (S3-compatible, ex. Exoscale SOS),
// avec purge après dépôt OneDrive. L'interface ci-dessous (storeTemp/readTemp/
// purgeTemp) est conçue pour être remplacée par un client S3 sans toucher au reste.

import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const DIR = join(tmpdir(), 'bb-uploads');

export async function storeTemp(content: Buffer, ext: string): Promise<string> {
  await mkdir(DIR, { recursive: true });
  const key = `${randomUUID()}.${(ext || 'bin').replace(/^\./, '')}`;
  await writeFile(join(DIR, key), content);
  return key;
}

export async function readTemp(key: string): Promise<Buffer> {
  return readFile(join(DIR, key));
}

export async function purgeTemp(key: string): Promise<void> {
  try {
    await unlink(join(DIR, key));
  } catch {
    // déjà supprimé : sans conséquence
  }
}
