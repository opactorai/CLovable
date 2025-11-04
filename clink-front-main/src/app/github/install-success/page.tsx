'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function GithubInstallSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPreview = searchParams.get('preview') === 'true';
  const isPending = searchParams.get('pending') === 'true';

  useEffect(() => {
    const notifyParent = () => {
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            { type: 'GITHUB_INSTALL_SUCCESS' },
            window.location.origin,
          );
        }
      } catch (error) {
        console.warn(
          'Failed to post install success message to opener:',
          error,
        );
      }
    };

    // Notify immediately
    notifyParent();

    if (!isPreview) {
      // Close popup quickly after notifying (300ms for smooth transition)
      const timeout = setTimeout(() => {
        if (window.opener && !window.opener.closed) {
          window.close();
        } else {
          router.replace('/');
        }
      }, 300);

      return () => clearTimeout(timeout);
    }
  }, [router, isPreview]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary">
      <div className="text-center px-4">
        {isPending ? (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/20 mb-4">
              <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-primary mb-2">Approval Required</h2>
            <p className="text-sm text-tertiary max-w-sm">Your organization owner needs to approve this installation. You'll receive an email when it's approved.</p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-primary mb-2">Connected</h2>
            <p className="text-sm text-tertiary">Closing...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function GithubInstallSuccessPage() {
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
      <GithubInstallSuccessContent />
    </Suspense>
  );
}
