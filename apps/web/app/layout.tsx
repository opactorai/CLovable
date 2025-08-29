import './globals.css'
import 'highlight.js/styles/github-dark.css'
import ThemeProvider from '@/components/ThemeProvider'
import { AuthProvider } from '@/contexts/AuthContext'
import Header from '@/components/Header'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Claudable',
  description: 'Claudable Application',
  icons: {
    icon: '/Claudable_Icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen transition-colors duration-200">
        <ThemeProvider>
          <AuthProvider>
            <Header />
            <main className="transition-colors duration-200">{children}</main>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
