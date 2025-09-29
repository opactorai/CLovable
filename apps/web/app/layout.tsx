import './globals.css'
import 'highlight.js/styles/github-dark.css'
import ThemeProvider from '@/components/ThemeProvider'
import GlobalSettingsProvider from '@/contexts/GlobalSettingsContext'
import { AuthProvider } from '@/contexts/AuthContext'
import Header from '@/components/Header'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Claudable',
  description: 'Claudable Application',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
  openGraph: {
    title: 'Claudable',
    description: 'Build what you want • Deploy instantly',
    url: '/',
    siteName: 'Claudable',
    images: [
      { url: '/icon.png', width: 512, height: 512, alt: 'Claudable' },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Claudable',
    description: 'Build what you want • Deploy instantly',
    images: ['/icon.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen transition-colors duration-200">
        <ThemeProvider>
          <AuthProvider>
            <GlobalSettingsProvider>
              <Header />
              <main className="transition-colors duration-200">{children}</main>
            </GlobalSettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
