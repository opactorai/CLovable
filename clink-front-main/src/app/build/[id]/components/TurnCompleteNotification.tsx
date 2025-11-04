import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle } from 'lucide-react';
import type { TurnStats } from '@/types/streaming';

interface TurnCompleteNotificationProps {
  turnStats: TurnStats | null;
  onDismiss?: () => void;
}

export const TurnCompleteNotification: React.FC<
  TurnCompleteNotificationProps
> = ({ turnStats, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (turnStats) {
      setIsVisible(true);

      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [turnStats, onDismiss]);

  if (!turnStats || !isVisible) {
    return null;
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className={`rounded-lg border p-4 shadow-lg ${
          turnStats.success
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0">
            {turnStats.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3
              className={`text-sm font-medium ${
                turnStats.success
                  ? 'text-green-900 dark:text-green-100'
                  : 'text-red-900 dark:text-red-100'
              }`}
            >
              {turnStats.success ? '✅ Turn Complete' : '❌ Turn Failed'}
            </h3>
            <div
              className={`mt-1 text-xs ${
                turnStats.success
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-red-700 dark:text-red-300'
              }`}
            >
              {turnStats.filesModified > 0 && (
                <span>
                  Modified {turnStats.filesModified} file
                  {turnStats.filesModified > 1 ? 's' : ''}
                </span>
              )}
              {turnStats.filesModified > 0 && turnStats.commandsExecuted > 0 && (
                <span> • </span>
              )}
              {turnStats.commandsExecuted > 0 && (
                <span>
                  Ran {turnStats.commandsExecuted} command
                  {turnStats.commandsExecuted > 1 ? 's' : ''}
                </span>
              )}
              {(turnStats.filesModified > 0 || turnStats.commandsExecuted > 0) && (
                <span> • </span>
              )}
              <span>{formatDuration(turnStats.duration)}</span>
              {turnStats.cost && <span> • ${turnStats.cost.toFixed(4)}</span>}
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={() => {
              setIsVisible(false);
              onDismiss?.();
            }}
            className={`flex-shrink-0 ${
              turnStats.success
                ? 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200'
                : 'text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200'
            }`}
          >
            <span className="text-lg">×</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};