/** @type {import('tailwindcss').Config} */

// B1: design tokens — the single source of truth for nook's palette.
// Raw hex is BANNED in src/ outside this file and the documented exceptions
// (see scripts/check-hex.mjs). Use the semantic names below in components:
//   bg-brand / text-ink / bg-surface / text-muted / bg-lace / text-peach …
//
// Canonical palette (docs/STRATEGY.md + brand Figma):
//   Brand Teal  #45B4B9  primary interactive color
//   Dusk Blue   #304D6D  headings / dark text
//   Pacific     #1B9AAA  secondary accent
//   Burnt Peach #DB7F67  warm CTA / accent
//   Old Lace    #F5F1E3  background / surface tint

module.exports = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#45B4B9',
          50:  '#F0FAFA',
          100: '#D6F1F2',
          200: '#ADE3E5',
          300: '#84D4D7',
          400: '#5CC4C8',
          500: '#45B4B9',
          600: '#399599',
          700: '#2D7679',
          800: '#215759',
          900: '#153839',
        },
        dusk: {
          DEFAULT: '#304D6D',
          300: '#7C93AF',
          500: '#304D6D',
          700: '#263E57',
          900: '#1B2C3E',
        },
        pacific: { DEFAULT: '#1B9AAA' },
        peach: {
          DEFAULT: '#DB7F67',
          600: '#C9654B',
          700: '#B05339',
        },
        lace: { DEFAULT: '#F5F1E3' },
        // Semantic aliases — components should prefer these:
        surface: '#FFFFFF',
        ink: '#304D6D',
        muted: '#8496A9',
      },
      borderRadius: {
        card: '16px',
        field: '12px',
      },
      boxShadow: {
        card: '0 2px 8px rgba(48, 77, 109, 0.08)',
        modal: '0 18px 48px rgba(48, 77, 109, 0.22)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
