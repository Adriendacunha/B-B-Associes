import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Sortie autonome pour un conteneur léger auto-hébergeable EN SUISSE (§9) —
  // alternative à Vercel. Sur Vercel (VERCEL=1), on laisse l'adaptateur natif.
  output: process.env.VERCEL ? undefined : 'standalone',
  // pdf-parse (pdfjs) et tesseract.js utilisent des workers : ne pas les bundler
  // par webpack (sinon chemins de worker introuvables côté serveur).
  serverExternalPackages: ['pdf-parse', 'tesseract.js'],
  // Les documents fiscaux sont sensibles : on évite toute mise en cache agressive
  // côté CDN pour les routes applicatives (voir §9 du brief — conformité nLPD/RGPD).
  poweredByHeader: false,
  // Inclut les données OCR Tesseract dans le bundle serverless (Vercel) pour que
  // l'extraction par OCR fonctionne en production (§7.2). Sans réseau requis.
  outputFileTracingIncludes: {
    '/**': ['./tessdata/**'],
  },
};

export default withNextIntl(nextConfig);
