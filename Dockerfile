# Image autonome pour héberger l'application EN SUISSE (§9 — nLPD/RGPD),
# sur un datacenter suisse (Infomaniak, Exoscale, Hidora…). Alternative à Vercel.
#
# Build : docker build -t bb-associes .
# Voir docker-compose.yml pour l'app + PostgreSQL + reverse-proxy TLS.

# ---- Dépendances ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Installe toutes les dépendances (postinstall lance `prisma generate`).
RUN npm ci

# ---- Build ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Runtime ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Utilisateur non-root.
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nextjs

# Sortie standalone de Next (server.js + node_modules tracés, dont tessdata).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Référentiel Prisma (pour `prisma migrate deploy` au démarrage) et données OCR.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/tessdata ./tessdata

USER nextjs
EXPOSE 3000

# Applique les migrations puis démarre le serveur. (Le seed se lance séparément :
# `docker compose run --rm app node_modules/.bin/tsx prisma/seed.ts`.)
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node server.js"]
