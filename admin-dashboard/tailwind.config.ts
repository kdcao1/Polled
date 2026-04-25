import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#6C63FF', dark: '#4B44CC' },
      },
    },
  },
  plugins: [],
};

export default config;
