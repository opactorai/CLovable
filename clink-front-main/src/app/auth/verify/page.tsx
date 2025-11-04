'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { config } from '@/lib/config';
import { AuthTransferSession } from '@/types/auth';

function VerifyMagicLinkInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<
    'verifying' | 'success' | 'error' | 'expired'
  >('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setError('Invalid verification link');
        return;
      }

      // Since backend redirects to /auth/success?exchange={id}, just navigate directly
      window.location.href = `${config.apiUrl}/api/auth/passwordless/verify?token=${token}`;
    };

    verifyToken();
  }, [searchParams, router]);

  return (
    <div
      className="min-h-screen relative overflow-x-hidden flex items-center justify-center px-4"
      style={{
        backgroundImage: "url('/assets/blurred.png')",
        backgroundSize: '100%',
        backgroundPosition: '50% 10%',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div
          className="rounded-3xl shadow-2xl p-12 text-center space-y-6"
          style={{
            backgroundColor: 'color-mix(in srgb, #bbbbbc 12%, transparent)',
            backdropFilter: 'blur(8px) saturate(150%)',
            WebkitBackdropFilter: 'blur(8px) saturate(150%)',
            boxShadow: `
              inset 0 0 0 1px color-mix(in srgb, #fff 10%, transparent),
              inset 1.8px 3px 0px -2px color-mix(in srgb, #fff 90%, transparent),
              inset -2px -2px 0px -2px color-mix(in srgb, #fff 80%, transparent),
              inset -3px -8px 1px -6px color-mix(in srgb, #fff 60%, transparent),
              inset -0.3px -1px 4px 0px color-mix(in srgb, #000 12%, transparent),
              inset -1.5px 2.5px 0px -2px color-mix(in srgb, #000 20%, transparent),
              inset 0px 3px 4px -2px color-mix(in srgb, #000 20%, transparent),
              inset 2px -6.5px 1px -4px color-mix(in srgb, #000 10%, transparent),
              0px 1px 5px 0px color-mix(in srgb, #000 10%, transparent),
              0px 6px 16px 0px color-mix(in srgb, #000 8%, transparent)
            `,
            borderColor: 'color-mix(in srgb, #fff 20%, transparent)',
          }}
        >
          {status === 'verifying' && (
            <>
              <Loader2 className="w-16 h-16 mx-auto animate-spin text-white" />
              <h1 className="text-2xl font-bold text-white">
                Verifying your link...
              </h1>
              <p className="text-gray-300">Please wait a moment</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
              <h1 className="text-2xl font-bold text-white">Success!</h1>
              <p className="text-gray-300">
                Signing you in... Redirecting to your dashboard.
              </p>
            </>
          )}

          {(status === 'error' || status === 'expired') && (
            <>
              <XCircle className="w-16 h-16 mx-auto text-red-500" />
              <h1 className="text-2xl font-bold text-white">
                {status === 'expired' ? 'Link Expired' : 'Verification Failed'}
              </h1>
              <p className="text-gray-100">{error}</p>
              <button
                onClick={() => router.push('/login')}
                className="liquid mt-6 px-6 py-3 text-white rounded-full font-medium transition-colors"
              >
                Back to Login
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function VerifyMagicLink() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-white" />
        </div>
      }
    >
      <VerifyMagicLinkInner />
    </Suspense>
  );
}
