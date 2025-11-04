import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft } from 'lucide-react';
import { GlassButton } from './GlassButton';
import { config } from '@/lib/config';

interface MagicLinkSentProps {
  email: string;
  onBack: () => void;
}

export const MagicLinkSent: React.FC<MagicLinkSentProps> = ({
  email,
  onBack,
}) => {
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [canResend, setCanResend] = useState(true);

  const handleResend = async () => {
    if (!canResend) return;

    setIsResending(true);
    setResendMessage('');

    try {
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
        setResendMessage('Email sent! Check your inbox.');
        setCanResend(false);

        // Re-enable resend after 60 seconds
        setTimeout(() => {
          setCanResend(true);
        }, 60000);
      } else {
        setResendMessage('Failed to resend. Please try again.');
      }
    } catch {
      setResendMessage('Failed to resend. Please check your connection.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="text-center space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
        <p className="text-sm text-gray-100 mb-1">
          We'll email you a link for a password free sign in.
        </p>
      </div>

      <div className="space-y-3 pt-4 flex flex-col items-center gap-4">
        <div>
          <button
            onClick={handleResend}
            disabled={isResending || !canResend}
            className="text-sm text-gray-100 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResending ? (
              'Sending...'
            ) : canResend ? (
              <>
                Didn't receive it?{' '}
                <span className="text-white font-bold">Resend email</span>
              </>
            ) : (
              <span className="text-white font-normal">
                Email sent! Wait 60s to resend
              </span>
            )}
          </button>
          {resendMessage && (
            <p className="text-xs text-white mt-2">{resendMessage}</p>
          )}
        </div>

        <GlassButton
          type="button"
          onClick={onBack}
          className="text-white font-medium"
        >
          Back to Login
        </GlassButton>
      </div>
    </motion.div>
  );
};
