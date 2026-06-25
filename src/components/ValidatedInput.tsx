'use client';

import { useRef } from 'react';

/**
 * Champ avec message de validation natif LOCALISÉ. Chrome affiche les messages de
 * contrainte dans la langue du navigateur, pas celle de la page (P2.7) — on impose
 * donc nos propres messages traduits via setCustomValidity.
 */
export function ValidatedInput({
  requiredMessage,
  typeMismatchMessage,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { requiredMessage: string; typeMismatchMessage?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <input
      {...props}
      ref={ref}
      onInvalid={(e) => {
        const el = e.currentTarget;
        if (el.validity.valueMissing) el.setCustomValidity(requiredMessage);
        else if (el.validity.typeMismatch && typeMismatchMessage) el.setCustomValidity(typeMismatchMessage);
        else el.setCustomValidity('');
      }}
      onInput={(e) => e.currentTarget.setCustomValidity('')}
    />
  );
}
