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
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        'build-bg': 'var(--build-bg)',
        'bolt-bg-primary': '#0c0a14',
        'bolt-bg-secondary': '#15111e',
        'bolt-bg-tertiary': '#1e1a2a',
        'bolt-border-color': 'rgba(139, 92, 246, 0.2)',
        'bolt-text-primary': '#e5e2ff',
        'bolt-text-secondary': '#a8a4ce',
        'bolt-text-tertiary': '#6b6685',
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        tertiary: 'var(--color-tertiary)',
        muted: 'var(--text-muted)',
      },
      backgroundColor: {
        primary: 'var(--bg-primary)',
        secondary: 'var(--bg-secondary)',
        tertiary: 'var(--bg-tertiary)',
        elevated: 'var(--bg-elevated)',
        'interactive-primary': 'var(--interactive-primary)',
        'interactive-secondary': 'var(--interactive-secondary)',
        'interactive-hover': 'var(--interactive-hover)',
      },
      borderColor: {
        primary: 'var(--border-primary)',
        secondary: 'var(--border-secondary)',
        hover: 'var(--border-hover)',
      },
      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary: 'var(--text-tertiary)',
        muted: 'var(--text-muted)',
      },
      fontFamily: {
        primary: ['var(--font-primary)', 'system-ui', '-apple-system', 'sans-serif'],
        secondary: ['var(--font-secondary)', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
