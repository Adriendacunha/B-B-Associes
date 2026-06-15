'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/** Champ en lecture seule + bouton « Copier » (lien à transmettre au client). */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible : l'utilisateur peut sélectionner le champ */
    }
  };
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="input flex-1 font-mono text-xs"
      />
      <button type="button" onClick={copy} className="btn btn-secondary btn-sm shrink-0">
        {copied ? (
          <>
            <Check className="h-4 w-4" strokeWidth={2} /> Copié
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" strokeWidth={2} /> Copier
          </>
        )}
      </button>
    </div>
  );
}
