'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import StatusPage from '@/components/StatusPage';

function BillingCancelContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(5);

  const isPreview = searchParams.get('preview') === 'true';

  useEffect(() => {
    if (isPreview) {
      return;
    }

    const projectId = searchParams.get('projectId');
    const redirectUrl = projectId
      ? `/build/${projectId}?payment=cancelled&tab=custom`
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

  const handleReturn = () => {
    const projectId = searchParams.get('projectId');
    const redirectUrl = projectId
      ? `/build/${projectId}?payment=cancelled&tab=custom`
      : '/';
    router.push(redirectUrl);
  };

  return (
    <StatusPage
      type="error"
      title="Payment Cancelled"
      message="Your payment was cancelled. You can try again anytime."
      additionalMessage={
        !isPreview
          ? `Redirecting back to your project in ${countdown} seconds...`
          : undefined
      }
      button={{
        label: 'Return to Project',
        onClick: handleReturn,
      }}
    />
  );
}

export default function BillingCancelPage() {
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
      <BillingCancelContent />
    </Suspense>
  );
}
