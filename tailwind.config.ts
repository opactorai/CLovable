import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2f7ff', 100: '#e6efff', 200: '#cce0ff', 300: '#99c2ff', 400: '#66a3ff', 500: '#3385ff', 600: '#1a73e8', 700: '#1557b0', 800: '#0f3b78', 900: '#0a2550',
        },
        'bolt-bg-primary': '#0c0a14',
        'bolt-bg-secondary': '#15111e',
        'bolt-bg-tertiary': '#1e1a2a',
        'bolt-border-color': 'rgba(139, 92, 246, 0.2)',
        'bolt-text-primary': '#e5e2ff',
        'bolt-text-secondary': '#a8a4ce',
        'bolt-text-tertiary': '#6b6685',
      },
    },
  },
  plugins: [],
}
export default config
