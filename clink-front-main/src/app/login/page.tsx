'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useConnectAppPairing } from './hooks/useConnectAppPairing';
import { useAuthForm } from './hooks/useAuthForm';
import { EmailForm } from './components/EmailForm';
import { MagicLinkSent } from './components/MagicLinkSent';
import { OAuthButtons } from './components/OAuthButtons';
import { GlassButton } from './components/GlassButton';
import { glassStyles } from './styles/glassMorphism';

function LoginPageInner() {
  const searchParams = useSearchParams();

  const {
    connectMode,
    pairingToken,
    autoConnectMessage,
    isLoading: pairingLoading,
    saveConnectInfo,
  } = useConnectAppPairing(searchParams, (error) => setError(error));

  const { email, setEmail, isLoading, error, magicLinkSent, handleSubmit, showValidation, loadingMessage } =
    useAuthForm({
      connectMode,
      pairingToken,
      saveConnectInfo,
    });

  const setError = (error: string) => {
    // This is handled by useAuthForm internally
  };

  const handleBackToLogin = () => {
    window.location.reload();
  };

  return (
    <div
      className="min-h-screen relative overflow-x-hidden bg-black"
      style={{
        backgroundImage: 'url(/assets/clink-hero.png)',
        backgroundSize: 'cover',
        backgroundPosition: '50% 40%',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark overlay for better readability */}
      <div className="absolute inset-0 bg-black/50 z-0" />
      
      <main className="relative z-10">
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 w-full max-w-lg"
          >
            <div
              className="rounded-3xl shadow-2xl py-6 border px-8"
              style={{
                ...glassStyles,
                borderColor: 'color-mix(in srgb, #fff 20%, transparent)',
              }}
            >
              {/* Logo */}
              <motion.div
                className="flex items-center justify-center mb-8"
                whileHover={{ scale: 1.05 }}
              >
                <Link href="/" className="inline-flex items-center">
                  <img
                    src="/assets/logo_svg/clink_symbol_white.svg"
                    alt="Clink Logo"
                    className="max-w-[50px]"
                  />
                </Link>
              </motion.div>

              {/* Header */}
              {!magicLinkSent && (
                <div className="text-center mb-8">
                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-2xl font-bold text-white mb-2"
                  >
                    Sign in / Sign up
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="text-sm text-gray-100"
                  >
                    We'll sign you in or create an account if you don't have one
                    yet
                  </motion.p>

                  {connectMode && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="mt-3 px-2 py-0.5 text-xs text-gray-400 inline-block"
                    >
                      {autoConnectMessage
                        ? autoConnectMessage
                        : 'Pairing with Clink App desktop app…'}
                    </motion.div>
                  )}
                </div>
              )}

              <AnimatePresence mode="wait">
                {magicLinkSent ? (
                  <MagicLinkSent
                    key="magic-link-sent"
                    email={email}
                    onBack={handleBackToLogin}
                  />
                ) : (
                  <motion.div
                    key="login-form"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {/* OAuth Buttons */}
                    <OAuthButtons
                      connectMode={connectMode}
                      pairingToken={pairingToken}
                      saveConnectInfo={saveConnectInfo}
                    />

                    {/* Divider */}
                    <div className="relative my-6 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div className="border-t border-gray-200"></div>
                      <span className="text-gray-100 text-sm bg-transparent">
                        OR
                      </span>
                      <div className="border-t border-gray-200"></div>
                    </div>

                    {/* Form */}
                    <form
                      onSubmit={handleSubmit}
                      className="space-y-6"
                      noValidate
                    >
                      <EmailForm email={email} setEmail={setEmail} showValidation={showValidation} />

                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-red-600 px-4 py-3 rounded-xl text-xs"
                        >
                          {error}
                        </motion.div>
                      )}

                      <GlassButton
                        type="submit"
                        disabled={isLoading || pairingLoading}
                        className="w-full text-white font-bold"
                      >
                        {isLoading || pairingLoading ? (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center justify-center gap-3"
                          >
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <motion.span
                              key={loadingMessage}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              transition={{ duration: 0.3 }}
                            >
                              {loadingMessage}
                            </motion.span>
                          </motion.div>
                        ) : (
                          <span>Continue</span>
                        )}
                      </GlassButton>

                      {/* Legal Links */}
                      <div className="flex items-center justify-center gap-3 text-sm mt-4">
                        <Link
                          href="/terms"
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          Terms of Service
                        </Link>
                        <span className="text-gray-600">|</span>
                        <Link
                          href="/privacy"
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          Privacy Policy
                        </Link>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
