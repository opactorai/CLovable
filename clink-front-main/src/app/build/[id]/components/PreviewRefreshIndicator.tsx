import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

interface PreviewRefreshIndicatorProps {
  isRefreshing: boolean;
  changedFiles: string[];
}

export const PreviewRefreshIndicator: React.FC<
  PreviewRefreshIndicatorProps
> = ({ isRefreshing, changedFiles }) => {
  if (!isRefreshing || changedFiles.length === 0) {
    return null;
  }

  const displayFiles =
    changedFiles.length <= 3
      ? changedFiles
      : [...changedFiles.slice(0, 2), `+${changedFiles.length - 2} more`];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border-b border-blue-200 dark:border-blue-700 p-3"
      >
        <div className="flex items-center gap-2">
          {/* Spinning icon */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </motion.div>

          {/* Message */}
          <div className="flex-1">
            <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
              🔄 Updating preview...
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
              Modified: {displayFiles.join(', ')}
            </div>
          </div>
        </div>

        {/* Animated progress bar */}
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </motion.div>
    </AnimatePresence>
  );
};