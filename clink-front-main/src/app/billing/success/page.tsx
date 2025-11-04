'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import StatusPage from '@/components/StatusPage';

function BillingSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(3);
  const [syncing, setSyncing] = useState(true);

  const isPreview = searchParams.get('preview') === 'true';

  useEffect(() => {
    const syncSubscription = async () => {
      try {
        await apiClient.syncSubscription();
        setSyncing(false);
      } catch (error) {
        console.error('Failed to sync subscription:', error);
        setSyncing(false);
      }
    };

    syncSubscription();

    if (isPreview) {
      return;
    }

    const projectId = searchParams.get('projectId');
    const redirectUrl = projectId
      ? `/build/${projectId}?payment=success&tab=custom`
      : '/';

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          router.push(redirectUrl);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [router, searchParams, isPreview]);

  const handleContinue = () => {
    const projectId = searchParams.get('projectId');
    const redirectUrl = projectId
      ? `/build/${projectId}?payment=success&tab=custom`
      : '/';
    router.push(redirectUrl);
  };

  return (
    <StatusPage
      type="success"
      title="Payment Successful!"
      message="Your subscription has been activated successfully."
      additionalMessage={
        !isPreview
          ? `Redirecting to your project in ${countdown} seconds...`
          : undefined
      }
      button={{
        label: 'Continue Now',
        onClick: handleContinue,
      }}
    />
  );
}

export default function BillingSuccessPage() {
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
      <BillingSuccessContent />
    </Suspense>
  );
}
