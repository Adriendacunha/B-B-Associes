'use client';

import { useFormStatus } from 'react-dom';

/**
 * Bouton de soumission avec indicateur de chargement. Pendant l'action serveur
 * (téléversement + extraction + analyse IA), affiche un spinner et désactive le
 * bouton — l'utilisateur sait que c'est en cours.
 */
export function UploadButton({
  idle,
  pending,
  className,
}: {
  idle: string;
  pending: string;
  className?: string;
}) {
  const { pending: isPending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={isPending}
      aria-busy={isPending}
      className={`${className ?? ''} disabled:opacity-70`}
    >
      {isPending ? (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white"
            aria-hidden
          />
          {pending}
        </span>
      ) : (
        idle
      )}
    </button>
  );
}
