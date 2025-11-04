'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import StatusPage from '@/components/StatusPage';

interface SupabaseConnectErrorClientProps {
  message: string;
}

function SupabaseConnectErrorContent({
  message,
}: SupabaseConnectErrorClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPreview = searchParams.get('preview') === 'true';

  useEffect(() => {
    const notifyParent = () => {
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              type: 'SUPABASE_CONNECT_ERROR',
              message,
            },
            window.location.origin,
          );
        }
      } catch (error) {
        console.warn(
          'Failed to post connect error message to opener:',
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
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [router, message, isPreview]);

  return (
    <StatusPage
      type="error"
      title="Connection Failed"
      message={message}
      additionalMessage={
        !isPreview ? 'This window will close automatically.' : undefined
      }
    />
  );
}

export default function SupabaseConnectErrorClient({
  message,
}: SupabaseConnectErrorClientProps) {
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
      <SupabaseConnectErrorContent message={message} />
    </Suspense>
  );
}
