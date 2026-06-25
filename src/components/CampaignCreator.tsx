'use client';

import { useState } from 'react';
import { RectificativeQuestionnaire } from '@/components/questionnaire/RectificativeQuestionnaire';
import { RectificativeCreatorView } from '@/components/questionnaire/RectificativeCreatorView';
import type { AppLocale } from '@/lib/i18n/locales';

interface Props {
  locale: AppLocale;
  clients: { clientCode: string; displayName: string }[];
  defaultFiscalYear: number;
}

/**
 * Ouverture d'une campagne « Déclaration d'impôt » : flux unique via l'assistant
 * guidé (arbre de décision conditionnel). Il couvre la déclaration de l'année
 * (corriger le pré-rempli), l'impôt à la source (DRIS) et la réclamation contre
 * une taxation reçue. L'ancien profilage par tags a été fusionné dans ce flux.
 */
export function CampaignCreator({ locale, clients, defaultFiscalYear }: Props) {
  const [view, setView] = useState<'bb' | 'client'>('bb');

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Déclaration d’impôt</h1>
        <p className="text-sm text-slate-600">
          Assistant guidé : répondez aux questions d’orientation pour générer la checklist documentaire
          (déclaration de l’année, impôt à la source, ou réclamation).
        </p>
      </header>

      {/* Bascule vue créateur B&B ↔ aperçu client */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setView('bb')}
          className={`rounded-md px-3 py-1.5 font-medium transition ${view === 'bb' ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          Vue créateur B&amp;B
        </button>
        <button
          type="button"
          onClick={() => setView('client')}
          className={`rounded-md px-3 py-1.5 font-medium transition ${view === 'client' ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          Aperçu client
        </button>
      </div>

      {view === 'bb' ? (
        <RectificativeCreatorView />
      ) : (
        <RectificativeQuestionnaire locale={locale} clients={clients} defaultFiscalYear={defaultFiscalYear} />
      )}
    </div>
  );
}
