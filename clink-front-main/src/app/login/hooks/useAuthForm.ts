import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { config } from '@/lib/config';
import { clientLogger } from '@/lib/client-logger';
import { AuthTransferSession } from '@/types/auth';

interface UseAuthFormProps {
  connectMode: boolean;
  pairingToken: string | null;
  saveConnectInfo: () => void;
}

export const useAuthForm = ({
  connectMode,
  pairingToken,
  saveConnectInfo,
}: UseAuthFormProps) => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing...');

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setShowValidation(true);

      // Check if email is valid before proceeding
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return;
      }

      setIsLoading(true);
      setError('');
      setLoadingMessage('Checking your email...');

      // Minimum loading time to prevent flickering
      const startTime = Date.now();
      const minLoadingTime = 800; // 800ms minimum

      try {
        // Check if user exists first
        const checkResponse = await fetch(
          `${config.apiUrl}/api/auth/check-email?email=${encodeURIComponent(email)}`,
          {
            method: 'GET',
            credentials: 'include',
          },
        );

        const { exists } = await checkResponse.json();

        if (exists) {
          // Existing user - send magic link
          setLoadingMessage('Sending magic link...');

          const response = await fetch(
            `${config.apiUrl}/api/auth/passwordless/magic-link`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({ email }),
            },
          );

          if (response.ok) {
            // Ensure minimum loading time
            const elapsed = Date.now() - startTime;
            if (elapsed < minLoadingTime) {
              await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsed));
            }

            setMagicLinkSent(true);
            setError('');
          } else {
            const errorData = await response.json();

            // Map common error messages to user-friendly versions
            let errorMessage =
              errorData.message || 'Failed to send magic link. Please try again.';

            if (response.status === 500) {
              errorMessage = 'Server error. Please try again later.';
            } else if (response.status === 400) {
              if (errorMessage.toLowerCase().includes('email')) {
                errorMessage = 'Invalid email format.';
              }
            } else if (response.status === 429) {
              errorMessage = 'Too many requests. Please try again later.';
            }

            setError(errorMessage);
          }
        } else {
          // New user - signup and auto-login (no email verification)
          setLoadingMessage('Creating your account...');

          const signupResponse = await fetch(
            `${config.apiUrl}/api/auth/passwordless/signup`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({ email }),
            },
          );

          if (signupResponse.ok) {
            const data = await signupResponse.json();

            setLoadingMessage('Signing you in...');

            // Note: Signup tracking is handled by backend

            // Store auth session
            const transferPayload = {
              token: data.token,
              refreshToken: data.refreshToken ?? null,
              user: data.user,
              pairingToken: connectMode ? pairingToken : null,
              connectMode,
            } satisfies AuthTransferSession;

            try {
              sessionStorage.setItem(
                'clink_auth_transfer',
                JSON.stringify(transferPayload),
              );
            } catch (storageError) {
              console.warn('Failed to persist transfer payload', storageError);
            }

            // Ensure minimum loading time
            const elapsed = Date.now() - startTime;
            if (elapsed < minLoadingTime) {
              await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsed));
            }

            // Redirect to auth success page (keep loading state until navigation completes)
            router.push('/auth/success');
            // Don't set isLoading to false - let the page navigation complete
            return;
          } else {
            const errorData = await signupResponse.json();

            let errorMessage =
              errorData.message || 'Failed to create account. Please try again.';

            if (signupResponse.status === 500) {
              errorMessage = 'Server error. Please try again later.';
            } else if (signupResponse.status === 400) {
              if (errorMessage.toLowerCase().includes('email')) {
                errorMessage = 'Invalid email format.';
              }
            } else if (signupResponse.status === 429) {
              errorMessage = 'Too many requests. Please try again later.';
            }

            setError(errorMessage);
          }
        }
      } catch {
        setError('Connection failed. Please check your network.');
      } finally {
        setIsLoading(false);
      }
    },
    [email, connectMode, pairingToken, router],
  );

  return {
    email,
    setEmail,
    isLoading,
    error,
    magicLinkSent,
    handleSubmit,
    showValidation,
    loadingMessage,
  };
};
