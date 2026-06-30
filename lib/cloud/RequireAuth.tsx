'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCloudAuth } from './AuthProvider';

/** Gate a cloud page behind a Supabase session; redirect to /cloud/login otherwise. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useCloudAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/cloud/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-bolt-text-secondary">
        Loading…
      </div>
    );
  }
  return <>{children}</>;
}
