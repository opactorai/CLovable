'use client';

import Image from 'next/image';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { config } from '@/lib/config';
import { isUserPlan, parseStoredUserProfile } from '../../../utils/user-profile';
import {
  clearStoredRefreshToken,
  getStoredRefreshToken,
  setStoredRefreshToken,
} from '@/lib/auth-storage';
import { AuthTransferSession, AuthUserPayload } from '@/types/auth';
import { identifyUser } from '@/lib/analytics';

type ConnectStage = 'pending' | 'finalizing' | 'completed' | 'error';

const CONNECT_PAIRED_FLAG = 'clink_connect_paired_once';
type AuthTransferPayload = AuthTransferSession & {
  accessToken?: string;
  refresh_token?: string | null;
  expiresIn?: number;
  expires_in?: number;
  id?: string;
  email?: string;
  name?: string;
  environment?: 'development' | 'production' | 'test';
};

function truncateToken(token: string): string {
  if (token.length <= 12) {
    return token;
  }
  return `${token.substring(0, 6)}…${token.substring(token.length - 4)}`;
}

function AuthSuccessInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isConnectMode, setIsConnectMode] = useState(false);
  const [pairingToken, setPairingToken] = useState<string | null>(null);
  const [stage, setStage] = useState<ConnectStage>('pending');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(true);

  const isPreview = searchParams.get('preview') === 'true';
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const queueTimeout = (callback: () => void, delay: number) => {
    if (isPreview) return; // Skip timeouts in preview mode
    const timer = setTimeout(callback, delay);
    timersRef.current.push(timer);
  };

  const clearQueuedTimeouts = () => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  };

  const cleanupConnectStorage = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('clink_connect_mode');
    localStorage.removeItem('clink_connect_pairing_token');
    localStorage.removeItem(CONNECT_PAIRED_FLAG);
  };

  const startFinalizeFlow = () => {
    setStage('finalizing');

    queueTimeout(() => {
      setStage('completed');

      queueTimeout(() => {
        // Redirect to Connect success page instead of home
        router.replace('/connect/success');
      }, 800);
    }, 2000);
  };

  const sendToConnectApp = async (
    authData: AuthTransferPayload,
    token: string,
  ) => {
    try {
      const payload = {
        accessToken: authData.token || authData.accessToken,
        refreshToken:
          authData.refreshToken || authData.refresh_token || authData.token,
        expiresIn: authData.expiresIn || authData.expires_in || 2592000,
        user: {
          id: authData.user?.id || authData.id,
          email: authData.user?.email || authData.email,
          name: authData.user?.name || authData.name,
        },
        environment:
          authData.environment || process.env.NODE_ENV || 'production',
      };

      const response = await fetch(
        `${config.apiUrl}/api/connect/pairings/complete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            token,
            payload,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Pairing API responded with ${response.status}`);
      }

      try {
        localStorage.setItem(CONNECT_PAIRED_FLAG, 'true');
      } catch (storageError) {
        console.warn('Auth success - failed to set paired flag:', storageError);
      }

      startFinalizeFlow();
    } catch (err) {
      console.error('Connect app integration error:', err);
      setError(
        'Could not pass the session to Clink App. Please try again.',
      );
      setStage('error');
    }
  };

  useEffect(() => {
    let cancelled = false;
    const AUTH_TRANSFER_KEY = 'clink_auth_transfer';

    const resolveTransfer = async () => {
      // Skip processing in preview mode
      if (isPreview) {
        setIsProcessing(false);
        return;
      }

      setIsProcessing(true);
      setError('');
      setStage('pending');

      const exchangeId = searchParams.get('exchange');
      let transfer:
        | AuthTransferSession
        | (AuthTransferPayload & {
            pairingToken?: string | null;
            connectMode?: boolean;
          })
        | null = null;

      if (exchangeId) {
        try {
          const response = await fetch(`${config.apiUrl}/api/auth/exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ exchangeId }),
          });

          if (!response.ok) {
            const message =
              response.status === 404
                ? 'Authentication session has expired. Please sign in again.'
                : 'Failed to finalize authentication. Please try again.';
            setError(message);
            setIsProcessing(false);
            return;
          }

          transfer = (await response.json()) as AuthTransferPayload;
        } catch (error) {
          console.error('Auth success - exchange retrieval failed:', error);
          setError('Could not complete authentication. Please try again.');
          setIsProcessing(false);
          return;
        }
      }

      if (!transfer && typeof window !== 'undefined') {
        const raw = sessionStorage.getItem(AUTH_TRANSFER_KEY);
        if (raw) {
          try {
            transfer = JSON.parse(raw) as AuthTransferSession;
          } catch (parseError) {
            console.warn(
              'Auth success - failed to parse transfer payload',
              parseError,
            );
          }
          sessionStorage.removeItem(AUTH_TRANSFER_KEY);
        }
      }

      if (!transfer && typeof window !== 'undefined') {
        const tokenFromStorage = localStorage.getItem('token');
        const refreshFromStorage = getStoredRefreshToken();
        const userFromStorage = localStorage.getItem('user');

        if (tokenFromStorage && userFromStorage) {
          const storedUser = parseStoredUserProfile(userFromStorage);
          if (storedUser) {
            transfer = {
              token: tokenFromStorage,
              refreshToken: refreshFromStorage,
              user: storedUser,
              connectMode:
                localStorage.getItem('clink_connect_mode') === 'true',
              pairingToken: localStorage.getItem(
                'clink_connect_pairing_token',
              ),
            };
          }
        }
      }

      if (!transfer) {
        setError(
          'No authentication information was provided. Please sign in again.',
        );
        setIsProcessing(false);
        cleanupConnectStorage();
        return;
      }

      const token = transfer.token || transfer.accessToken;
      const refreshToken =
        transfer.refreshToken || transfer.refresh_token || null;
      const userPayload: AuthUserPayload | null =
        transfer.user ||
        (transfer.id || transfer.email || transfer.name
          ? {
              id: transfer.id,
              email: transfer.email,
              name: transfer.name,
              plan: isUserPlan((transfer as AuthUserPayload)?.plan)
                ? (transfer as AuthUserPayload).plan
                : 'free',
            }
          : null);

      const normalizedUserPayload = userPayload
        ? {
            ...userPayload,
            plan: isUserPlan(userPayload.plan) ? userPayload.plan : 'free',
            planActivatedAt: userPayload.planActivatedAt ?? null,
            planExpiresAt: userPayload.planExpiresAt ?? null,
            stripeCustomerId: userPayload.stripeCustomerId ?? null,
          }
        : null;

      if (!token) {
        setError('Authentication token missing. Please try again.');
        setIsProcessing(false);
        cleanupConnectStorage();
        return;
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
        if (refreshToken) {
          setStoredRefreshToken(refreshToken);
        } else {
          clearStoredRefreshToken();
        }

        if (normalizedUserPayload) {
          localStorage.setItem('user', JSON.stringify(normalizedUserPayload));

          // Identify user in Amplitude
          if (normalizedUserPayload.id) {
            const userProps: Record<string, string | number | boolean> = {
              plan: normalizedUserPayload.plan,
            };
            if (normalizedUserPayload.email) userProps.email = normalizedUserPayload.email;
            if (normalizedUserPayload.name) userProps.name = normalizedUserPayload.name;

            identifyUser(normalizedUserPayload.id, userProps);
          }
        }
      }

      if (cancelled) {
        return;
      }

      const isPopup =
        typeof window !== 'undefined' && window.opener && !window.opener.closed;

      console.log('🔍 Auth success - popup detection:', {
        isPopup,
        hasWindow: typeof window !== 'undefined',
        hasOpener: typeof window !== 'undefined' && !!window.opener,
        openerClosed: typeof window !== 'undefined' && window.opener ? window.opener.closed : 'N/A',
        origin: typeof window !== 'undefined' ? window.location.origin : 'N/A'
      });

      if (isPopup) {
        console.log('✅ Detected as popup, sending GITHUB_OAUTH_SUCCESS message');
        window.opener.postMessage(
          {
            type: 'GITHUB_OAUTH_SUCCESS',
            token,
            refreshToken,
            user: normalizedUserPayload,
          },
          window.location.origin,
        );
        console.log('📤 Message sent to opener');
        queueTimeout(() => window.close(), 500);
        return;
      }

      console.log('❌ Not detected as popup, redirecting to homepage');

      const connectModeStored =
        typeof window !== 'undefined' &&
        localStorage.getItem('clink_connect_mode') === 'true';
      const pairingTokenStored =
        typeof window !== 'undefined'
          ? localStorage.getItem('clink_connect_pairing_token')
          : null;

      const activePairingToken =
        transfer.pairingToken ?? pairingTokenStored ?? null;
      const shouldConnect = transfer.connectMode ?? connectModeStored;

      setIsConnectMode(Boolean(shouldConnect));
      setPairingToken(activePairingToken);

      if (shouldConnect) {
        if (!activePairingToken) {
          setError(
            'Pairing token is missing. Please try the desktop login again.',
          );
          setStage('error');
          setIsProcessing(false);
          cleanupConnectStorage();
          return;
        }

        const alreadyPaired =
          typeof window !== 'undefined' &&
          localStorage.getItem(CONNECT_PAIRED_FLAG) === 'true';

        if (alreadyPaired) {
          startFinalizeFlow();
          setIsProcessing(false);
          cleanupConnectStorage();
          return;
        }

        const authData: AuthTransferPayload = {
          token,
          refreshToken,
        user: normalizedUserPayload,
        environment: process.env.NODE_ENV || 'production',
      };

        await sendToConnectApp(authData, activePairingToken);
        startFinalizeFlow();
        setIsProcessing(false);
        cleanupConnectStorage();
        return;
      }

      setIsProcessing(false);
      queueTimeout(() => {
        router.push('/');
      }, 1500);
      cleanupConnectStorage();
    };

    resolveTransfer().catch((error) => {
      console.error('Auth success - unexpected error:', error);
      setError('Authentication failed unexpectedly. Please try again.');
      setIsProcessing(false);
      cleanupConnectStorage();
    });

    return () => {
      cancelled = true;
      clearQueuedTimeouts();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, searchParams, isPreview]);

  const renderConnectContent = () => {
    if (stage === 'error' || error) {
      return (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg">
            <svg
              className="h-8 w-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>Pairing Failed</h2>
          <p className="text-sm text-gray-100" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
            {error || 'We could not reach the desktop app. Please try again.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-white rounded-full px-6 py-2 text-sm font-medium text-gray-900 shadow-lg hover:shadow-xl transition-all"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (stage === 'completed') {
      return (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg">
            <svg
              className="h-10 w-10 text-emerald-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            Browser Login Complete
          </h2>
          <p className="text-sm text-gray-100" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
            Returning you to Clink App...
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inline-flex h-full w-full rounded-full" />
          <span className="relative h-12 w-12 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
        </div>
        <h2 className="text-2xl font-semibold text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
          {stage === 'finalizing'
            ? 'Finishing secure hand-off'
            : 'Browser Login Detected'}
        </h2>
        <p className="text-sm text-gray-100 leading-relaxed" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
          {stage === 'finalizing'
            ? 'Syncing your session with the desktop app. Hang tight.'
            : 'Passing your browser session to Clink App.'}
        </p>
      </div>
    );
  };

  const renderDefaultContent = () => {
    if (error) {
      return (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg">
            <svg
              className="h-8 w-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            Authentication Failed
          </h2>
          <p className="text-sm text-gray-100" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="bg-white rounded-full px-6 py-2 text-sm font-medium text-gray-900 shadow-lg hover:shadow-xl transition-all"
          >
            Go to Login
          </button>
        </div>
      );
    }

    if (isProcessing) {
      return (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <span className="absolute inline-flex h-full w-full rounded-full" />
            <span className="relative h-12 w-12 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
          </div>
          <h2 className="text-2xl font-semibold text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            Verifying your session
          </h2>
          <p className="text-sm text-gray-100" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
            Sit tight—redirecting to your Clink dashboard.
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg">
          <svg
            className="h-10 w-10 text-emerald-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
          Signed in successfully!
        </h2>
        <p className="text-sm text-gray-100" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
          Heading back to the homepage. One moment...
        </p>
      </div>
    );
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center px-4"
      style={{
        backgroundImage: 'url(/assets/clink-hero.png)',
        backgroundSize: 'cover',
        backgroundPosition: '50% 40%',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-black/50 z-0" />
      
      <div className="relative z-10 w-full max-w-lg">
        <div className="rounded-3xl border border-white/60 bg-white/90 px-10 py-12 shadow-2xl backdrop-blur-lg liquid-card">
          <div className="flex flex-col items-center gap-8">
            <Image
              src="/assets/logo_svg/clink_logo_white.svg"
              alt="Clink"
              className="w-40"
              width={160}
              height={48}
              priority
            />
            {isConnectMode ? renderConnectContent() : renderDefaultContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthSuccess() {
  return (
    <Suspense fallback={null}>
      <AuthSuccessInner />
    </Suspense>
  );
}
