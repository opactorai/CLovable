'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface NewChatConfirmationModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function NewChatConfirmationModal({
  isOpen,
  onCancel,
  onConfirm,
}: NewChatConfirmationModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

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
          aria-labelledby="new-chat-dialog-title"
          onClick={onCancel}
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
            className="liquid relative z-10 w-full max-w-md mx-auto overflow-hidden rounded-3xl border border-gray-300 bg-white/95 p-6 text-left shadow-2xl dark:border-gray-700 dark:bg-gray-900/95 font-primary"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-4">
              <header className="space-y-2">
                <h2
                  id="new-chat-dialog-title"
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  Start a new chat?
                </h2>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  You won't be able to modify work from the previous chat. Continue?
                </p>
              </header>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  className="rounded-full bg-gray-900 dark:bg-white px-4 py-2 text-sm font-medium text-white dark:text-gray-900 shadow-sm transition hover:bg-gray-800 dark:hover:bg-gray-100"
                >
                  Start
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
