'use client';

import { usePathname, useRouter, routing } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import { useTransition } from 'react';

const LABELS: Record<string, string> = { fr: 'FR', en: 'EN', de: 'DE' };

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-1" aria-label="language">
      {routing.locales.map((loc) => (
        <button
          key={loc}
          disabled={isPending || loc === locale}
          onClick={() => startTransition(() => router.replace(pathname, { locale: loc }))}
          className={`rounded px-2 py-1 text-sm font-medium transition ${
            loc === locale ? 'bg-brand text-white' : 'bg-white text-brand hover:bg-slate-100'
          }`}
        >
          {LABELS[loc]}
        </button>
      ))}
    </div>
  );
}
