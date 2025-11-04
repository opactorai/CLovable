'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import StatusPage from '@/components/StatusPage';

function SupabaseConnectSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPreview = searchParams.get('preview') === 'true';

  useEffect(() => {
    const notifyParent = () => {
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            { type: 'SUPABASE_CONNECT_SUCCESS' },
            window.location.origin,
          );
        }
      } catch (error) {
        console.warn(
          'Failed to post connect success message to opener:',
          error,
        );
      }
    };

    notifyParent();

    if (!isPreview) {
      const timeout = setTimeout(() => {
        notifyParent();
        if (window.opener && !window.opener.closed) {
          window.close();
        } else {
          router.replace('/');
        }
      }, 1500);

      return () => clearTimeout(timeout);
    }
  }, [router, isPreview]);

  return (
    <StatusPage
      type="success"
      title="Supabase Connected"
      message="You can close this window. We'll refresh the integration status automatically."
    />
  );
}

export default function SupabaseConnectSuccessPage() {
  return (
    <Suspense
      fallback={
        <div
          className="relative flex min-h-screen items-center justify-center bg-cover bg-center px-4"
          style={{ backgroundImage: "url('/assets/blurred.png')" }}
        >
          <div className="absolute inset-0 bg-white/40 backdrop-blur-sm" />
          <div className="relative z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          </div>
        </div>
      }
    >
      <SupabaseConnectSuccessContent />
    </Suspense>
  );
}
