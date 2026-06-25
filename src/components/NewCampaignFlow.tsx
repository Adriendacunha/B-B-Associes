'use client';

import { useState } from 'react';
import { ArrowLeft, ClipboardList, FileSearch, FileBox } from 'lucide-react';
import { RectificativeQuestionnaire } from '@/components/questionnaire/RectificativeQuestionnaire';
import type { AppLocale } from '@/lib/i18n/locales';

type Engine = 'PROFILAGE_TAGS' | 'QUESTIONNAIRE' | 'CUSTOM';

interface TemplateOption {
  key: string;
  name: string;
  description: string;
  engine: Engine;
}

interface Props {
  locale: AppLocale;
  client: { clientCode: string; displayName: string };
  templates: TemplateOption[];
  defaultFiscalYear: number;
}

const ENGINE_ICON: Record<Engine, typeof ClipboardList> = {
  PROFILAGE_TAGS: ClipboardList,
  QUESTIONNAIRE: FileSearch,
  CUSTOM: FileBox,
};

/** Écran 2 (choix du modèle) → lance le moteur de génération de la campagne. */
export function NewCampaignFlow({ locale, client, templates, defaultFiscalYear }: Props) {
  const [selected, setSelected] = useState<TemplateOption | null>(null);
  const clients = [{ clientCode: client.clientCode, displayName: client.displayName }];

  if (!selected) {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Créer une campagne</h1>
          <p className="text-sm text-slate-600">
            Pour <span className="font-medium text-slate-800">{client.displayName}</span> — choisissez le modèle de campagne.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((tpl) => {
            const Icon = ENGINE_ICON[tpl.engine];
            return (
              <button
                key={tpl.key}
                type="button"
                onClick={() => setSelected(tpl)}
                className="card group flex flex-col text-left transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-white">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h2 className="mt-4 text-base font-semibold text-slate-900">{tpl.name}</h2>
                <p className="mt-1 text-sm text-slate-500">{tpl.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => setSelected(null)} className="btn btn-ghost btn-sm -ml-2">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Changer de modèle
      </button>

      {(selected.engine === 'QUESTIONNAIRE' || selected.engine === 'PROFILAGE_TAGS') && (
        <RectificativeQuestionnaire locale={locale} clients={clients} defaultFiscalYear={defaultFiscalYear} />
      )}
      {selected.engine === 'CUSTOM' && (
        <div className="card text-sm text-slate-600">
          <h2 className="text-base font-semibold text-slate-900">{selected.name}</h2>
          <p className="mt-1">
            Ce modèle (checklist manuelle) sera bientôt disponible. Pour l’instant, utilisez « Déclaration d’impôt ».
          </p>
        </div>
      )}
    </div>
  );
}
