'use client';

import { useEffect, useState } from 'react';
import { MessageCircleMore, Flag, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaDiscord } from 'react-icons/fa';

/**
 * Unified Help FAB (Floating Action Button)
 * Provides access to:
 * - Crisp Live Chat (customer support)
 * - Marker.io Bug Reporting (screenshot & feedback)
 * - Discord Community
 */
export function HelpFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [markerReady, setMarkerReady] = useState(false);

  useEffect(() => {
    // Initialize Crisp
    if (typeof window !== 'undefined') {
      (window as any).$crisp = (window as any).$crisp || [];
      (window as any).$crisp.push(['do', 'chat:hide']); // Hide default launcher
    }

    // Check if Marker is ready
    const checkMarker = () => {
      if ((window as any).Marker) {
        setMarkerReady(true);
      } else {
        setTimeout(checkMarker, 100);
      }
    };
    checkMarker();
  }, []);

  const openChat = () => {
    console.log('openChat called');
    if ((window as any).Intercom) {
      console.log('Intercom found, opening messenger');
      (window as any).Intercom('show');
    } else {
      console.error('Intercom not loaded');
    }
    setIsOpen(false);
  };

  const openBugReport = () => {
    if ((window as any).Marker) {
      (window as any).Marker.capture('advanced');
    }
    setIsOpen(false);
  };

  const openDiscord = () => {
    window.open('https://discord.gg/69HQhzEY', '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-2">
      {/* Menu Items */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-1.5"
          >
            {/* Chat Button */}
            <motion.button
              onClick={openChat}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group flex items-center gap-2.5 rounded-xl liquid-card px-4 py-2 hover:brightness-105 transition-all duration-200 border border-white/20"
              aria-label="Open live chat"
            >
              <MessageCircleMore className="w-4 h-4 text-white" strokeWidth={1.7} />
              <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                Chat Support
              </span>
            </motion.button>

            {/* Bug Report Button */}
            <motion.button
              onClick={openBugReport}
              disabled={!markerReady}
              whileHover={{ scale: markerReady ? 1.02 : 1 }}
              whileTap={{ scale: markerReady ? 0.98 : 1 }}
              className="group flex items-center gap-2.5 rounded-xl liquid-card px-4 py-2 hover:brightness-105 transition-all duration-200 border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Report bug or send feedback"
            >
              <Flag className="w-4 h-4 text-white" strokeWidth={1.7} />
              <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                Bug Report
              </span>
            </motion.button>

            {/* Discord Button */}
            <motion.button
              onClick={openDiscord}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group flex items-center gap-2.5 rounded-xl liquid-card px-4 py-2 hover:brightness-105 transition-all duration-200 border border-white/20"
              aria-label="Join Discord community"
            >
              <FaDiscord className="w-4 h-4 text-white" />
              <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                Join Discord
              </span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main FAB Toggle */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-12 h-12 rounded-full liquid-card border border-white/20 hover:brightness-110 transition-all duration-200"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label={isOpen ? 'Close help menu' : 'Open help menu'}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X className="w-5 h-5 text-white" />
            </motion.div>
          ) : (
            <motion.div
              key="question"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-white text-xl font-bold"
            >
              ?
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
