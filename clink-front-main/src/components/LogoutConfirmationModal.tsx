'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface LogoutConfirmationModalProps {
  isOpen: boolean;
  isLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function LogoutConfirmationModal({
  isOpen,
  isLoading = false,
  onCancel,
  onConfirm,
  title = 'Ready to sign out?',
  description = 'You will be signed out of your account. Make sure any in-progress work is saved before continuing.',
  confirmLabel = 'Sign out',
  cancelLabel = 'Cancel',
}: LogoutConfirmationModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-dialog-title"
          onClick={() => {
            if (!isLoading) onCancel();
          }}
        >
          <motion.div
            className="absolute inset-0 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="liquid relative z-10 w-full max-w-md mx-auto overflow-hidden rounded-3xl border border-gray-200/70 bg-white p-6 text-left shadow-2xl dark:border-gray-800/70 dark:bg-secondary"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-4">
              <header className="space-y-2">
                <h2
                  id="logout-dialog-title"
                  className="text-lg font-semibold text-white"
                >
                  {title}
                </h2>
                <p className="text-sm text-white">{description}</p>
              </header>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="rounded-full border border-white hover:opacity-70 px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      Signing out...
                    </>
                  ) : (
                    confirmLabel
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
