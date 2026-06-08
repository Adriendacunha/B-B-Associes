// Garde-fou : les tests d'intégration exigent une base de données.
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL est requis pour les tests d'intégration. " +
      'Pointez-le vers une base PostgreSQL migrée + seedée (voir CI / README).',
  );
}
