'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function ConnectSuccess() {
  const [shouldClose, setShouldClose] = useState(false);

  useEffect(() => {
    // Try to close the window after a short delay
    const timer = setTimeout(() => {
      setShouldClose(true);
      try {
        window.close();
      } catch (err) {
        console.debug('Could not close window automatically:', err);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="flex justify-center mb-6"
          >
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
              <svg
                className="w-12 h-12 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <motion.path
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold text-white text-center mb-3"
            style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}
          >
            Login Complete
          </motion.h1>

          {/* Message */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-white/90 text-center mb-8 text-lg"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
          >
            Please return to the Clink app
          </motion.p>

          {/* Close instruction */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center"
          >
            <p className="text-white/70 text-sm mb-4">
              {shouldClose
                ? 'You can close this window'
                : 'This window will close automatically'}
            </p>

            <button
              onClick={() => window.close()}
              className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full text-sm font-medium transition-all duration-200 backdrop-blur border border-white/30 hover:scale-105"
            >
              Close Window
            </button>
          </motion.div>

          {/* App Icon */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-8 flex justify-center"
          >
            <div className="text-white/50 text-xs">
              Clink Connect
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
