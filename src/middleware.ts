import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Toutes les routes sauf API, internes Next et fichiers statiques.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
