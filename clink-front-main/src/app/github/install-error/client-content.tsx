'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import StatusPage from '@/components/StatusPage';

type GithubInstallErrorClientProps = {
  message: string;
};

function GithubInstallErrorContent({
  message,
}: GithubInstallErrorClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPreview = searchParams.get('preview') === 'true';

  useEffect(() => {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          { type: 'GITHUB_INSTALL_ERROR', message },
          window.location.origin,
        );
      }
    } catch (error) {
      console.warn(
        'Failed to notify opener about GitHub install error:',
        error,
      );
    }

    if (!isPreview) {
      const timeout = setTimeout(() => {
        if (window.opener && !window.opener.closed) {
          window.close();
        } else {
          router.replace('/');
        }
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [message, router, isPreview]);

  const handleClose = () => {
    if (window.opener && !window.opener.closed) {
      window.close();
    } else {
      router.replace('/');
    }
  };

  return (
    <StatusPage
      type="error"
      title="GitHub Installation Failed"
      message={message}
      button={{
        label: 'Close Window',
        onClick: handleClose,
      }}
    />
  );
}

export default function GithubInstallErrorClient({
  message,
}: GithubInstallErrorClientProps) {
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
      <GithubInstallErrorContent message={message} />
    </Suspense>
  );
}
