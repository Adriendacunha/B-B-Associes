'use client';

// Barrière d'erreur racine (Next.js) : remplace l'écran blanc « server-side
// exception » par un message lisible. Capte aussi les erreurs levées dans le
// layout (ex. base injoignable). Doit rendre ses propres <html>/<body>.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#f8fafc', color: '#0f172a', margin: 0 }}>
        <div style={{ maxWidth: 560, margin: '12vh auto', padding: '0 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Une erreur est survenue</h1>
          <p style={{ color: '#475569', lineHeight: 1.5 }}>
            Le service est momentanément indisponible. Si le problème persiste, le serveur ne parvient
            probablement pas à joindre la base de données.
          </p>
          {error.digest && (
            <p style={{ marginTop: 16, fontSize: 12, color: '#94a3b8' }}>
              Référence : <code>{error.digest}</code>
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              marginTop: 20, padding: '10px 18px', borderRadius: 8, border: 'none',
              background: '#1e293b', color: '#fff', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
