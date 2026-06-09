// Stockage du contenu binaire d'un document AVANT validation, persistant et chiffré
// au repos (§5/§9). Remplace le /tmp éphémère par une table (DocumentBlob), ce qui
// fonctionne en serverless (Vercel) comme en auto-hébergement.
//
// Chiffrement AES-256-GCM si STORAGE_ENCRYPTION_KEY est défini (voir storage/crypto).

import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import { deriveKey, encryptBuffer, decryptBuffer } from './crypto';

type Db = PrismaClient | Prisma.TransactionClient;

function storageKey(): Buffer | null {
  const secret = process.env.STORAGE_ENCRYPTION_KEY;
  return secret ? deriveKey(secret) : null;
}

/** Enregistre (ou remplace) le contenu d'un document, chiffré si une clé est définie. */
export async function putDocumentContent(documentId: string, buffer: Buffer, db: Db = prisma): Promise<void> {
  const key = storageKey();
  const data = key ? encryptBuffer(buffer, key) : buffer;
  const bytes = new Uint8Array(data); // Prisma Bytes attend un Uint8Array
  await db.documentBlob.upsert({
    where: { documentId },
    create: { documentId, content: bytes },
    update: { content: bytes },
  });
}

/** Lit et déchiffre le contenu d'un document, ou null s'il n'existe plus (purgé). */
export async function getDocumentContent(documentId: string, db: Db = prisma): Promise<Buffer | null> {
  const blob = await db.documentBlob.findUnique({ where: { documentId } });
  if (!blob) return null;
  const raw = Buffer.from(blob.content);
  const key = storageKey();
  return key ? decryptBuffer(raw, key) : raw;
}

/** Supprime le contenu temporaire (purge §9). */
export async function clearDocumentContent(documentId: string, db: Db = prisma): Promise<void> {
  await db.documentBlob.deleteMany({ where: { documentId } });
}
