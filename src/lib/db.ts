// Singleton Prisma — évite d'épuiser le pool de connexions en développement
// (hot-reload Next.js réinstancie les modules).

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Résout l'URL de connexion à partir des noms d'environnement usuels. Sur Vercel,
 * une base Postgres/Neon rattachée expose souvent `POSTGRES_PRISMA_URL` (poolée)
 * plutôt que `DATABASE_URL` ; on retombe dessus pour éviter l'erreur runtime
 * « Environment variable not found: DATABASE_URL ».
 */
export function resolveDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    undefined
  );
}

const url = resolveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Surcharge explicite : fonctionne même si la variable ne s'appelle pas
    // exactement `DATABASE_URL` (cf. resolveDatabaseUrl).
    ...(url ? { datasourceUrl: url } : {}),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
