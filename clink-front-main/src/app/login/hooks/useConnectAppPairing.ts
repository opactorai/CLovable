import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { config } from '@/lib/config';
import { clientLogger } from '@/lib/client-logger';
import { AuthTransferSession, AuthUserPayload } from '@/types/auth';
import { getStoredRefreshToken } from '@/lib/auth-storage';

const CONNECT_PAIRED_FLAG = 'clink_connect_paired_once';

export interface ConnectAppPairingState {
  connectMode: boolean;
  pairingToken: string | null;
  autoConnectMessage: string;
  autoConnectAttempted: boolean;
  isLoading: boolean;
  error: string;
}

export const useConnectAppPairing = (
  searchParams: URLSearchParams,
  setError: (error: string) => void,
) => {
  const router = useRouter();
  const [connectMode, setConnectMode] = useState(false);
  const [pairingToken, setPairingToken] = useState<string | null>(null);
  const [autoConnectMessage, setAutoConnectMessage] = useState('');
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check for Connect app mode from URL parameters
  useEffect(() => {
    const isConnect = searchParams.get('connect') === 'true';
    const pairing = searchParams.get('pairing');

    clientLogger.debug(
      'Login page - URL search params:',
      Object.fromEntries(searchParams.entries()),
    );
    clientLogger.debug(
      'Login page - connect mode check:',
      isConnect,
      'pairing:',
      pairing,
    );

    if (isConnect && pairing) {
      clientLogger.debug(
        'Login page - Setting connect mode to true with pairing token',
      );
      setConnectMode(true);
      setPairingToken(pairing);
    } else {
      clientLogger.debug('Login page - Not in connect mode');
    }
  }, [searchParams]);

  // Send authentication data to Connect app
  const sendToConnectApp = useCallback(
    async (
      authData: {
        token: string;
        refreshToken?: string | null;
        user?: AuthUserPayload | null;
      },
      pairing: string,
    ) => {
      try {
        const payload = {
          accessToken: authData.token,
          refreshToken: authData.refreshToken || authData.token,
          expiresIn: 2592000,
          user: {
            id: authData.user?.id,
            email: authData.user?.email,
            name: authData.user?.name,
          },
          environment: process.env.NODE_ENV || 'production',
        };

        const response = await fetch(
          `${config.apiUrl}/api/connect/pairings/complete`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ token: pairing, payload }),
          },
        );

        if (!response.ok) {
          throw new Error(`Pairing API responded with ${response.status}`);
        }

        try {
          localStorage.setItem(CONNECT_PAIRED_FLAG, 'true');
        } catch (storageError) {
          clientLogger.warn(
            'Auto-connect - failed to set paired flag',
            storageError,
          );
        }

        return true;
      } catch (autoError) {
        console.error(
          'Auto-connect - failed to register session with backend:',
          autoError,
        );
        setError(
          'Failed to pair with the desktop app. Please try signing in again.',
        );
        return false;
      }
    },
    [setError],
  );

  // Auto-connect effect for existing logged-in users
  useEffect(() => {
    if (!connectMode || !pairingToken || autoConnectAttempted) {
      return;
    }

    const existingToken = localStorage.getItem('token');
    if (!existingToken) {
      return;
    }

    setAutoConnectAttempted(true);
    setError('');
    setIsLoading(true);
    setAutoConnectMessage(
      'Detected existing login. Completing desktop pairing...',
    );

    try {
      localStorage.removeItem(CONNECT_PAIRED_FLAG);
    } catch (storageError) {
      clientLogger.warn(
        'Auto-connect - failed to clear paired flag',
        storageError,
      );
    }

    const storedUserRaw = localStorage.getItem('user');
    let storedUser: AuthUserPayload | null = null;
    if (storedUserRaw) {
      try {
        storedUser = JSON.parse(storedUserRaw);
      } catch (parseError) {
        clientLogger.warn(
          'Auto-connect - failed to parse stored user',
          parseError,
        );
      }
    }

    const refreshToken = getStoredRefreshToken();

    localStorage.setItem('clink_connect_mode', 'true');
    localStorage.setItem('clink_connect_pairing_token', pairingToken);
    try {
      localStorage.removeItem(CONNECT_PAIRED_FLAG);
    } catch (storageError) {
      clientLogger.warn(
        'Auto-connect - failed to clear paired flag',
        storageError,
      );
    }

    const run = async () => {
      const success = await sendToConnectApp(
        {
          token: existingToken,
          refreshToken,
          user: storedUser,
        },
        pairingToken,
      );

      setIsLoading(false);

      if (!success) {
        setAutoConnectMessage(
          'Automatic pairing failed. Please sign in again.',
        );
        return;
      }

      const transferPayload: AuthTransferSession = {
        token: existingToken,
        refreshToken: refreshToken || null,
        user: storedUser,
        pairingToken,
        connectMode: true,
      };

      try {
        sessionStorage.setItem(
          'clink_auth_transfer',
          JSON.stringify(transferPayload),
        );
      } catch (storageError) {
        clientLogger.warn(
          'Auto-connect - failed to persist transfer payload',
          storageError,
        );
      }

      router.push('/auth/success');
    };

    run().catch((connectError) => {
      console.error('Auto-connect - unexpected error:', connectError);
      setIsLoading(false);
      setAutoConnectMessage('Automatic pairing failed. Please sign in again.');
    });
  }, [
    connectMode,
    pairingToken,
    autoConnectAttempted,
    router,
    sendToConnectApp,
    setError,
  ]);

  // Save Connect info to localStorage
  const saveConnectInfo = useCallback(() => {
    if (connectMode && pairingToken) {
      localStorage.setItem('clink_connect_mode', 'true');
      localStorage.setItem('clink_connect_pairing_token', pairingToken);
      try {
        localStorage.removeItem(CONNECT_PAIRED_FLAG);
      } catch (storageError) {
        clientLogger.warn('Failed to clear paired flag:', storageError);
      }
    } else {
      localStorage.removeItem('clink_connect_mode');
      localStorage.removeItem('clink_connect_pairing_token');
    }
  }, [connectMode, pairingToken]);

  return {
    connectMode,
    pairingToken,
    autoConnectMessage,
    autoConnectAttempted,
    isLoading,
    saveConnectInfo,
  };
};
