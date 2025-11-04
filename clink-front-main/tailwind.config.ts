import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        'build-bg': 'var(--build-bg)',

        // Semantic color system
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
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'gradient-shift': 'gradientShift 3s ease infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 2s infinite',
        'morph': 'morph 8s ease-in-out infinite',
        'rotate-border': 'rotateBorder 3s linear infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 3s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-20px) rotate(-2deg)' },
          '66%': { transform: 'translateY(10px) rotate(2deg)' },
        },
        morph: {
          '0%, 100%': {
            borderRadius: '42% 58% 70% 30% / 45% 45% 55% 55%',
            transform: 'rotate(0deg) scale(1)',
          },
          '33%': {
            borderRadius: '70% 30% 46% 54% / 30% 29% 71% 70%',
            transform: 'rotate(60deg) scale(1.05)',
          },
          '66%': {
            borderRadius: '38% 62% 63% 37% / 41% 44% 56% 59%',
            transform: 'rotate(-20deg) scale(0.95)',
          },
        },
        rotateBorder: {
          to: {
            '--angle': '360deg',
          },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      borderWidth: {
        '3': '3px',
      },
    },
  },
  plugins: [],
};
export default config;
