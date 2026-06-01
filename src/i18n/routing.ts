import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

// FR/EN/DE, français par défaut (§3 du brief).
export const routing = defineRouting({
  locales: ['fr', 'en', 'de'],
  defaultLocale: 'fr',
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
