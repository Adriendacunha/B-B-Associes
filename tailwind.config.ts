import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Identité visuelle sobre, adaptée à une fiduciaire.
        brand: {
          DEFAULT: '#1f3a5f',
          light: '#2f5483',
          dark: '#13263d',
        },
      },
    },
  },
  plugins: [],
};

export default config;
