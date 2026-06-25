/**
 * Logo officiel B&B Associés SA. Asset rogné sur fond transparent (public/logo-bb.png).
 * La taille se contrôle via `className` (ex. `h-8 w-auto`).
 */
export function Logo({ className = '', alt = 'B&B Associés SA' }: { className?: string; alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- logo statique, pas d'optimisation next/image nécessaire
  return <img src="/logo-bb.png" alt={alt} className={className} />;
}
