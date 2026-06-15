'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Download } from 'lucide-react';

/** Bouton d'envoi avec indicateur de chargement (analyse IA en cours). */
function Submit({ idle, pending }: { idle: string; pending: string }) {
  const { pending: isPending } = useFormStatus();
  return (
    <button type="submit" disabled={isPending} aria-busy={isPending} className="btn btn-primary btn-sm disabled:opacity-70">
      {isPending ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
          {pending}
        </span>
      ) : (
        idle
      )}
    </button>
  );
}

/**
 * Zone de dépôt par glisser-déposer (UX §7) : déposez un fichier ou cliquez pour
 * en importer un. Réutilise l'action serveur d'upload existante ; conserve le
 * dépôt multi-fichiers (fusionnés) et l'indicateur de chargement.
 */
export function Dropzone({
  action,
  fields,
  prompt,
  multiHint,
  idle,
  pending,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  prompt: string;
  multiHint?: string;
  idle: string;
  pending: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const apply = (files: FileList | null) => {
    if (inputRef.current && files && files.length) inputRef.current.files = files;
    setNames(files ? Array.from(files).map((f) => f.name) : []);
  };

  return (
    <form action={action} className="mt-2">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input
        ref={inputRef}
        type="file"
        name="file"
        required
        multiple
        className="sr-only"
        onChange={(e) => setNames(e.target.files ? Array.from(e.target.files).map((f) => f.name) : [])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          apply(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          dragOver ? 'border-brand bg-brand/5' : 'border-slate-300 hover:border-brand/60 hover:bg-slate-50'
        }`}
      >
        <span className="text-sm font-semibold text-brand">{prompt}</span>
        <Download className="h-6 w-6 text-brand" strokeWidth={1.75} />
      </button>
      {names.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="truncate text-xs text-slate-600">{names.join(', ')}</span>
          <Submit idle={idle} pending={pending} />
        </div>
      )}
      {multiHint && <p className="mt-1 text-[10px] text-slate-400">{multiHint}</p>}
    </form>
  );
}
