import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Tests d'intégration (*.itest.ts) : nécessitent une base PostgreSQL accessible via
// DATABASE_URL (migrée + seedée). Exécution séquentielle pour éviter les courses DB.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.itest.ts'],
    fileParallelism: false,
    setupFiles: ['./test/integration.setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
