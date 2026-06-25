// Commande de build Vercel (référencée par vercel.json → buildCommand).
//
// Objectif : zéro manipulation manuelle. Quand une base est attachée
// (DATABASE_URL présent), on applique les migrations puis on seed (idempotent),
// avant de builder Next. Sans base (premier import), on saute proprement ces
// étapes : les pages de démonstration restent disponibles.

import { execSync } from 'node:child_process';

function run(cmd) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env: process.env });
}

// Retire les paramètres que Prisma ne sait pas lire (ex. channel_binding des
// URLs Neon/Vercel) — sinon migrate/seed échouent.
function sanitize(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('channel_binding');
    return u.toString();
  } catch {
    return url;
  }
}

// Sur Vercel, une base Postgres/Neon rattachée expose souvent POSTGRES_PRISMA_URL
// / POSTGRES_URL_NON_POOLING plutôt que DATABASE_URL. On normalise vers le nom
// attendu par schema.prisma pour que migrations et seed s'exécutent.
if (!process.env.DATABASE_URL) {
  const fallback =
    process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || '';
  if (fallback) {
    process.env.DATABASE_URL = fallback;
    console.log('ℹ DATABASE_URL déduit depuis les variables Postgres de l’hôte.');
  }
}

const hasDb = Boolean(process.env.DATABASE_URL);

// Les migrations exigent une connexion DIRECTE (non poolée). On privilégie une
// URL non poolée et propre (sans channel_binding).
if (hasDb && !process.env.DIRECT_URL) {
  process.env.DIRECT_URL =
    process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
  console.log('ℹ DIRECT_URL déduit pour les migrations.');
}

// Nettoyage final des deux URLs effectivement utilisées par Prisma.
if (process.env.DATABASE_URL) process.env.DATABASE_URL = sanitize(process.env.DATABASE_URL);
if (process.env.DIRECT_URL) process.env.DIRECT_URL = sanitize(process.env.DIRECT_URL);

run('prisma generate');

if (hasDb) {
  console.log('✓ Base détectée — application des migrations puis seed.');
  run('prisma migrate deploy');
  // Seed idempotent (upserts) : référentiel de pièces, cadence, e-mails, démo.
  run('prisma db seed');
} else {
  console.log('⚠ DATABASE_URL absent — migrations/seed ignorés (mode démo sans base).');
}

run('next build');
