import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, FileCode, Terminal, CheckCircle2, XCircle } from 'lucide-react';

export interface ToolOutputCardProps {
  toolName: string;
  icon: string;
  label: string;
  details?: string;
  status?: 'running' | 'success' | 'error';
  duration?: string;
  output?: string;
  error?: string;
  exitCode?: number;
  fileStats?: {
    lines?: number;
    size?: string;
  };
  defaultExpanded?: boolean;
  groupCount?: number;
  groupedTools?: Array<{
    label: string;
    details: string;
  }>;
  onFileClick?: (filePath: string) => void;
}

const getStatusIcon = (status?: string) => {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
    case 'running':
      return (
        <div className="w-4 h-4">
          <svg className="animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      );
    default:
      return null;
  }
};

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'success':
      return 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10';
    case 'error':
      return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10';
    case 'running':
      return 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10';
    default:
      return 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800';
  }
};

export const ToolOutputCard: React.FC<ToolOutputCardProps> = ({
  toolName,
  icon,
  label,
  details,
  status,
  duration,
  output,
  error,
  exitCode,
  fileStats,
  defaultExpanded = false,
  groupCount,
  groupedTools,
  onFileClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const hasExpandableContent = !!(output || error || fileStats || groupedTools);
  const statusColor = getStatusColor(status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`rounded-xl ${statusColor} overflow-hidden mb-2`}
    >
      {/* Header */}
      <button
        onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 ${
          hasExpandableContent ? 'hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer' : 'cursor-default'
        } transition-all duration-200`}
      >
        {/* Expand icon */}
        {hasExpandableContent ? (
          <motion.div
            className="flex-shrink-0 text-gray-400"
            animate={{ rotate: isExpanded ? 0 : -90 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        ) : (
          <div className="w-4" />
        )}

        {/* Tool icon */}
        <span className="text-base flex-shrink-0">{icon}</span>

        {/* Label and details */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-900 dark:text-white">
            {label}
            {groupCount && groupCount > 1 && (
              <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                ({groupCount} files)
              </span>
            )}
          </span>
          {details && !groupedTools && (
            <code
              className={`text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md truncate max-w-[180px] font-mono ${
                onFileClick ? 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors' : ''
              }`}
              onClick={(e) => {
                if (onFileClick && details) {
                  e.stopPropagation();
                  onFileClick(details);
                }
              }}
            >
              {details}
            </code>
          )}
        </div>

        {/* Status and duration */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {status && (
            <div className="flex items-center gap-1">
              {getStatusIcon(status)}
              {status === 'success' && (
                <span className="text-xs text-green-600 dark:text-green-400">
                  Completed
                </span>
              )}
              {status === 'error' && (
                <span className="text-xs text-red-600 dark:text-red-400">
                  Failed
                </span>
              )}
            </div>
          )}
          {duration && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {duration}
            </span>
          )}
        </div>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && hasExpandableContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="border-t border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="px-3 py-3 space-y-3">
              {/* Grouped tools list */}
              {groupedTools && groupedTools.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Files ({groupedTools.length})
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {groupedTools.map((tool, index) => (
                      <div
                        key={index}
                        className={`text-xs font-mono text-gray-600 dark:text-gray-300 flex items-center gap-2 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded ${
                          onFileClick ? 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors' : ''
                        }`}
                        onClick={() => onFileClick?.(tool.details)}
                      >
                        <span className="text-green-600 dark:text-green-400">✓</span>
                        <span className="truncate">{tool.details}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* File stats */}
              {fileStats && (
                <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                  {fileStats.lines !== undefined && (
                    <div className="flex items-center gap-1">
                      <FileCode className="w-3.5 h-3.5" />
                      <span>{fileStats.lines} lines</span>
                    </div>
                  )}
                  {fileStats.size && (
                    <div className="flex items-center gap-1">
                      <span>📊</span>
                      <span>{fileStats.size}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Output */}
              {output && (
                <div>
                  <div className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Output</span>
                  </div>
                  <pre className="bg-gray-900 dark:bg-black text-gray-100 dark:text-gray-300 rounded p-3 overflow-x-auto max-h-64 text-xs font-mono">
                    {output}
                  </pre>
                </div>
              )}

              {/* Error */}
              {error && (
                <div>
                  <div className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 mb-1.5">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Error</span>
                  </div>
                  <pre className="bg-red-900/20 dark:bg-red-950/50 text-red-700 dark:text-red-300 rounded p-3 overflow-x-auto max-h-64 text-xs font-mono border border-red-200 dark:border-red-800">
                    {error}
                  </pre>
                </div>
              )}

              {/* Exit code */}
              {exitCode !== undefined && (
                <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <span className="font-medium">Exit code:</span>
                  <code className={`px-1.5 py-0.5 rounded font-mono ${
                    exitCode === 0
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                  }`}>
                    {exitCode}
                  </code>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
