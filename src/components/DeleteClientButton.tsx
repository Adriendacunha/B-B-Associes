'use client';

import { deleteClient } from '@/app/actions/client';

/** Bouton de suppression d'un client avec confirmation (action destructive). */
export function DeleteClientButton({
  clientId,
  locale,
  label,
  confirmText,
}: {
  clientId: string;
  locale: string;
  label: string;
  confirmText: string;
}) {
  return (
    <form
      action={deleteClient}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="uiLocale" value={locale} />
      <button type="submit" className="btn btn-sm border border-red-300 bg-white text-red-700 hover:bg-red-50">
        {label}
      </button>
    </form>
  );
}
