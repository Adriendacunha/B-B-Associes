// Piste d'audit inaltérable (§8 du brief).
//
// Chaque entrée du journal est chaînée à la précédente par un hash (façon registre
// append-only). Toute altération d'une entrée passée casse la chaîne et devient
// détectable. Le hash couvre le contenu de l'entrée + le hash précédent.

import { createHash } from 'node:crypto';

export interface AuditEntryInput {
  actorType: 'CLIENT' | 'COLLABORATEUR' | 'ADMIN' | 'IA' | 'SYSTEM';
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/** Sérialisation déterministe (clés triées) pour un hash stable. */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}

/** Calcule le hash d'une entrée à partir de son contenu et du hash précédent. */
export function computeEntryHash(entry: AuditEntryInput, prevHash: string | null): string {
  const payload = canonicalize({
    actorType: entry.actorType,
    actorId: entry.actorId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? {},
    createdAt: entry.createdAt.toISOString(),
    prevHash: prevHash ?? null,
  });
  return createHash('sha256').update(payload).digest('hex');
}

export interface SealedAuditEntry extends AuditEntryInput {
  prevHash: string | null;
  hash: string;
}

/** Scelle une nouvelle entrée à la suite de la chaîne existante. */
export function sealEntry(entry: AuditEntryInput, prevHash: string | null): SealedAuditEntry {
  return { ...entry, prevHash, hash: computeEntryHash(entry, prevHash) };
}

/**
 * Vérifie l'intégrité d'une chaîne ordonnée (du plus ancien au plus récent).
 * Retourne l'index de la première entrée corrompue, ou -1 si la chaîne est intègre.
 */
export function verifyChain(entries: SealedAuditEntry[]): number {
  let prev: string | null = null;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.prevHash !== prev) return i;
    if (computeEntryHash(e, prev) !== e.hash) return i;
    prev = e.hash;
  }
  return -1;
}
