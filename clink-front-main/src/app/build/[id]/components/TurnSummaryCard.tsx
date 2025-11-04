import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronDown, FileEdit, Terminal, Clock, DollarSign, XCircle } from 'lucide-react';
import type { TurnStats } from '@/types/streaming';

interface TurnSummaryCardProps {
  stats: TurnStats;
  changedFiles?: string[];
  onDismiss?: () => void;
  onFileClick?: (filePath: string) => void;
}

export const TurnSummaryCard: React.FC<TurnSummaryCardProps> = ({
  stats,
  changedFiles = [],
  onDismiss,
  onFileClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const durationSeconds = (stats.duration / 1000).toFixed(1);
  const minutes = Math.floor(stats.duration / 60000);
  const seconds = Math.floor((stats.duration % 60000) / 1000);
  const formattedDuration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`rounded-xl border overflow-hidden mb-4 ${
        stats.success
          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
          : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
      }`}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {stats.success ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              >
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              >
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </motion.div>
            )}
            <div>
              <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                {stats.success ? 'Turn Complete' : 'Turn Failed'}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                Finished in {formattedDuration}
              </p>
            </div>
          </div>

          {changedFiles.length > 0 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </button>
          )}
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {/* Files Modified */}
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <FileEdit className="w-3.5 h-3.5" />
              <span className="text-xs">Files</span>
            </div>
            <span className="text-xs font-bold text-gray-900 dark:text-white">
              {stats.filesModified}
            </span>
          </div>

          {/* Commands Executed */}
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <Terminal className="w-3.5 h-3.5" />
              <span className="text-xs">Commands</span>
            </div>
            <span className="text-xs font-bold text-gray-900 dark:text-white">
              {stats.commandsExecuted}
            </span>
          </div>

          {/* Duration or Cost */}
          {stats.cost !== undefined ? (
            <div className="flex flex-col items-start gap-1">
              <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                <DollarSign className="w-3.5 h-3.5" />
                <span className="text-xs">Cost</span>
              </div>
              <span className="text-xs font-bold text-gray-900 dark:text-white">
                ${stats.cost.toFixed(3)}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-1">
              <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs">Time</span>
              </div>
              <span className="text-xs font-bold text-gray-900 dark:text-white">
                {durationSeconds}s
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Expandable File List */}
      <AnimatePresence>
        {isExpanded && changedFiles.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="border-t border-green-200 dark:border-green-800 overflow-hidden"
          >
            <div className="p-4 bg-white/50 dark:bg-black/20">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Modified Files ({changedFiles.length})
              </h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {changedFiles.map((file, index) => (
                  <motion.div
                    key={file}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`text-xs font-mono text-gray-600 dark:text-gray-400 flex items-center gap-2 ${
                      onFileClick ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors' : ''
                    }`}
                    onClick={() => onFileClick?.(file)}
                  >
                    <span className="text-green-600 dark:text-green-400">✓</span>
                    {file}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
