import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Les documents fiscaux sont sensibles : on évite toute mise en cache agressive
  // côté CDN pour les routes applicatives (voir §9 du brief — conformité nLPD/RGPD).
  poweredByHeader: false,
};

export default withNextIntl(nextConfig);
