import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { ToolExecution, ToolStatus } from '@/types/streaming';

interface ToolExecutionPanelProps {
  tools: Map<string, ToolExecution>;
}

const statusIcons: Record<ToolStatus, string> = {
  pending: '⏸️',
  running: '⏳',
  success: '✅',
  failed: '❌',
};

const statusColors: Record<ToolStatus, string> = {
  pending: 'text-gray-500 dark:text-gray-400',
  running: 'text-blue-500 dark:text-blue-400',
  success: 'text-green-500 dark:text-green-400',
  failed: 'text-red-500 dark:text-red-400',
};

export const ToolExecutionPanel: React.FC<ToolExecutionPanelProps> = ({
  tools,
}) => {
  const [isExpanded, setIsExpanded] = useState(true); // Auto-expand by default
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);

  const toolsArray = Array.from(tools.values());

  if (toolsArray.length === 0) {
    return null;
  }

  const toggleExpanded = () => setIsExpanded(!isExpanded);
  const toggleToolDetails = (toolId: string) => {
    setExpandedToolId(expandedToolId === toolId ? null : toolId);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl mb-3 overflow-hidden shadow-sm"
    >
      {/* Header */}
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between p-3.5 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all duration-200"
      >
        <div className="flex items-center gap-2.5">
          <motion.span
            className="text-base"
            animate={{
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            ⚙️
          </motion.span>
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
            Active Tools ({toolsArray.length})
          </span>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </motion.div>
      </button>

      {/* Tool List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="border-t border-gray-200 dark:border-gray-700"
          >
            <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
              {toolsArray.map((tool, index) => (
                <motion.div
                  key={tool.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.2 }}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
                >
                  {/* Tool Summary */}
                  <button
                    onClick={() => toggleToolDetails(tool.id)}
                    className="w-full flex items-center justify-between p-2.5 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all duration-200"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <motion.span
                        className={statusColors[tool.status]}
                        animate={
                          tool.status === 'running'
                            ? {
                                scale: [1, 1.2, 1],
                              }
                            : {}
                        }
                        transition={{
                          duration: 1.5,
                          repeat: tool.status === 'running' ? Infinity : 0,
                          ease: 'easeInOut',
                        }}
                      >
                        {statusIcons[tool.status]}
                      </motion.span>
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                        {tool.name}
                        {tool.input?.command && (
                          <span className="text-gray-500 dark:text-gray-400 font-normal">
                            : {tool.input.command}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {tool.duration !== undefined && tool.duration !== null && (
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          {(tool.duration / 1000).toFixed(1)}s
                        </span>
                      )}
                      {tool.status === 'running' && (
                        <motion.span
                          className="text-xs font-semibold text-blue-600 dark:text-blue-400"
                          animate={{ opacity: [1, 0.5, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          Running
                        </motion.span>
                      )}
                    </div>
                  </button>

                  {/* Tool Details */}
                  <AnimatePresence>
                    {expandedToolId === tool.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                      >
                        <div className="p-3 space-y-2 text-xs">
                          {/* Output */}
                          {tool.output && (
                            <div>
                              <div className="font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Output:
                              </div>
                              <pre className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 overflow-x-auto max-h-32 text-gray-700 dark:text-gray-300">
                                {tool.output}
                              </pre>
                            </div>
                          )}

                          {/* Error */}
                          {tool.error && (
                            <div>
                              <div className="font-medium text-red-600 dark:text-red-400 mb-1">
                                Error:
                              </div>
                              <pre className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded p-2 overflow-x-auto max-h-32 text-red-700 dark:text-red-300">
                                {tool.error}
                              </pre>
                            </div>
                          )}

                          {/* Exit Code */}
                          {tool.exitCode !== undefined && (
                            <div className="text-gray-600 dark:text-gray-400">
                              Exit code: {tool.exitCode}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
