import localFont from 'next/font/local';
import { Manrope } from 'next/font/google';

/**
 * Centralized Font Configuration
 *
 * Update these configurations to change fonts globally across the application.
 *
 * PRIMARY_FONT: Used for all general UI, headings, body text, buttons, etc.
 * SECONDARY_FONT: Used for special input areas like the main prompt form
 */

// Primary font - Aeonik (local font files)
export const primaryFont = localFont({
  src: [
    {
      path: '../../public/assets/fonts/aeonik/fonnts.com-Aeonik-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/assets/fonts/aeonik/fonnts.com-Aeonik-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-primary',
  display: 'swap',
});

// Secondary font - Manrope (previously primary)
export const secondaryFont = Manrope({
  subsets: ['latin'],
  variable: '--font-secondary',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

/**
 * Font class names for use in components
 * These map to Tailwind CSS utility classes
 */
export const FONT_CLASSES = {
  primary: 'font-primary',
  secondary: 'font-secondary',
} as const;

/**
 * CSS variable names
 */
export const FONT_VARS = {
  primary: 'var(--font-primary)',
  secondary: 'var(--font-secondary)',
} as const;
