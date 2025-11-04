'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthTransferSession, AuthUserPayload } from '@/types/auth';

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const exchangeId = searchParams.get('exchange');
    if (exchangeId) {
      router.replace(`/auth/success?exchange=${exchangeId}`);
      return;
    }

    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');
    const userParam = searchParams.get('user');
    const pairingParam = searchParams.get('pairing');
    const connectMode = searchParams.get('connect') === 'true';

    if (!token) {
      router.replace('/login');
      return;
    }

    let userData: AuthUserPayload | null = null;
    if (userParam) {
      try {
        userData = JSON.parse(decodeURIComponent(userParam));
      } catch (err) {
        console.error('Auth callback - failed to parse user data:', err);
      }
    }

    try {
      sessionStorage.setItem(
        'clink_auth_transfer',
        JSON.stringify({
          token,
          refreshToken: refreshToken || null,
          user: userData,
          pairingToken: pairingParam || null,
          connectMode,
        } satisfies AuthTransferSession),
      );
    } catch (storageError) {
      console.warn(
        'Auth callback - failed to persist transfer payload',
        storageError,
      );
    }

    router.replace('/auth/success');
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center max-w-md p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={null}>
      <AuthCallbackInner />
    </Suspense>
  );
}
