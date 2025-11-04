import type { Metadata } from 'next';
import { primaryFont, secondaryFont } from '@/config/fonts';
import { ThemeProvider } from '@/contexts/BuildThemeContext';
import { JsonLd } from '@/components/seo/JsonLd';
import { organizationSchema, websiteSchema } from '@/config/seo';
import AmplitudeAnalytics from '@/components/AmplitudeAnalytics';
import { IntercomChat } from '@/components/support/IntercomChat';
import { MarkerWidget } from '@/components/support/MarkerWidget';
import { HelpFAB } from '@/components/support/HelpFAB';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://clink.new'),
  title: {
    default: 'Clink',
    template: '%s | Clink',
  },
  description:
    'Bring your own CLI Agents. Build & Deploy Instantly with Claude Code, Codex, and Gemini.',
  keywords: [
    'full-stack app builder',
    'vibe-coding',
    'ai web development tool',
    'build apps with AI',
    'clink',
    'clink.new',
    'claude',
    'claude code',
    'codex',
    'gpt',
    'gemini',
    'cli',
    'cursor',
    'lovable'
  ],
  authors: [{ name: 'Clink', url: 'https://clink.new' }],
  creator: 'Clink',
  publisher: 'Clink',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://clink.new',
    siteName: 'Clink',
    title: 'Clink - Link, Click, Ship',
    description:
      'Bring your own CLI Agents. Build & Deploy Instantly with Claude Code, Codex, and Gemini.',
    images: [
      {
        url: 'https://clink.new/assets/promotions/OG(1200X630).png',
        width: 1200,
        height: 630,
        alt: 'Clink - Bring your own CLI Agents. Build & Deploy with Claude Code, Codex, and Gemini',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@aaron_xong',
    creator: '@aaron_xong',
    title: 'Clink - Link, Click, Ship',
    description:
      'Bring your own CLI Agents. Build & Deploy Instantly with Claude Code, Codex, and Gemini.',
    images: ['https://clink.new/assets/promotions/twitter(800X418).png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <AmplitudeAnalytics />
      </head>
      <body
        className={`${primaryFont.variable} ${secondaryFont.variable} antialiased`}
      >
        {/* Structured Data for Search Engines */}
        <JsonLd data={organizationSchema} />
        <JsonLd data={websiteSchema} />

        <ThemeProvider>
          {children}
        </ThemeProvider>

        {/* Customer Support & Bug Reporting */}
        <IntercomChat />
        <MarkerWidget />
        <HelpFAB />
      </body>
    </html>
  );
}
