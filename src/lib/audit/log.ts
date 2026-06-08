// Écriture d'une entrée dans le journal d'audit inaltérable (§8).
// Récupère le hash de la dernière entrée et chaîne la nouvelle (voir chain.ts).

import type { PrismaClient, Prisma } from '@prisma/client';
import { sealEntry, type AuditEntryInput } from './chain';

type Db = PrismaClient | Prisma.TransactionClient;

export async function appendAuditLog(db: Db, entry: AuditEntryInput) {
  const last = await db.auditLog.findFirst({ orderBy: { createdAt: 'desc' } });
  const sealed = sealEntry(entry, last?.hash ?? null);
  return db.auditLog.create({
    data: {
      actorType: sealed.actorType,
      // actorUserId (relation) renseigné seulement pour le staff ; actorId garde
      // l'identifiant brut (staff ou client) tel que journalisé.
      actorId: sealed.actorId ?? null,
      actorUserId: sealed.actorType === 'COLLABORATEUR' || sealed.actorType === 'ADMIN' ? sealed.actorId ?? null : null,
      action: sealed.action,
      entityType: sealed.entityType,
      entityId: sealed.entityId ?? null,
      metadata: (sealed.metadata ?? {}) as Prisma.InputJsonValue,
      prevHash: sealed.prevHash,
      hash: sealed.hash,
      createdAt: sealed.createdAt,
    },
  });
}
