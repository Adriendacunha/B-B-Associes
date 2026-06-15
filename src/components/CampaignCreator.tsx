'use client';

import { useState } from 'react';
import { ClipboardList, FileSearch, ArrowLeft } from 'lucide-react';
import { ProfilageForm } from '@/components/ProfilageForm';
import { RectificativeQuestionnaire } from '@/components/questionnaire/RectificativeQuestionnaire';
import { RectificativeCreatorView } from '@/components/questionnaire/RectificativeCreatorView';
import type { AppLocale } from '@/lib/i18n/locales';

type Mode = null | 'ordinaire' | 'rectificative';

interface Props {
  locale: AppLocale;
  clients: { clientCode: string; displayName: string }[];
  defaultFiscalYear: number;
}

/**
 * Sélecteur de type de campagne : déclaration ordinaire (profilage à tags
 * existant) ou déclaration rectificative (assistant à arbre de décision).
 */
export function CampaignCreator({ locale, clients, defaultFiscalYear }: Props) {
  const [mode, setMode] = useState<Mode>(null);
  const [rectView, setRectView] = useState<'bb' | 'client'>('bb');

  if (mode === null) {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Ouvrir une campagne</h1>
          <p className="text-sm text-slate-600">Choisissez le type de campagne à créer pour ce client.</p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode('ordinaire')}
            className="card group flex flex-col text-left transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-white">
              <ClipboardList className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-900">Déclaration ordinaire</h2>
            <p className="mt-1 text-sm text-slate-500">
              Profilage par situations fiscales : génère la checklist documentaire d’une déclaration complète.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setMode('rectificative')}
            className="card group flex flex-col text-left transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-white">
              <FileSearch className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-900">Déclaration rectificative</h2>
            <p className="mt-1 text-sm text-slate-500">
              Assistant conditionnel : oriente vers une rectification d’impôt à la source (DRIS) ou une déclaration ordinaire (TOU).
            </p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => setMode(null)} className="btn btn-ghost btn-sm -ml-2">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Changer de type
      </button>
      {mode === 'ordinaire' ? (
        <ProfilageForm locale={locale} clients={clients} defaultFiscalYear={defaultFiscalYear} />
      ) : (
        <>
          {/* Bascule vue créateur B&B ↔ aperçu client */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setRectView('bb')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${rectView === 'bb' ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Vue créateur B&amp;B
            </button>
            <button
              type="button"
              onClick={() => setRectView('client')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${rectView === 'client' ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Aperçu client
            </button>
          </div>
          {rectView === 'bb' ? (
            <RectificativeCreatorView />
          ) : (
            <RectificativeQuestionnaire locale={locale} clients={clients} defaultFiscalYear={defaultFiscalYear} />
          )}
        </>
      )}
    </div>
  );
}
