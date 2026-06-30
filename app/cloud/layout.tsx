'use client';

import { CloudAuthProvider } from '@/lib/cloud/AuthProvider';

/**
 * Cloud edition layout. Nests inside the root layout but provides its own
 * Supabase-backed auth context for everything under /cloud.
 */
export default function CloudLayout({ children }: { children: React.ReactNode }) {
  return (
    <CloudAuthProvider>
      <div className="min-h-screen bg-bolt-bg-primary text-bolt-text-primary">{children}</div>
    </CloudAuthProvider>
  );
}
