import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Clock, Check, AlertCircle } from 'lucide-react';

export interface TimelineEvent {
  id: string;
  type: 'thinking' | 'tool' | 'writing' | 'reading' | 'running' | 'success' | 'error';
  title: string;
  details?: string;
  status: 'active' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  children?: TimelineEvent[];
}

interface ActivityTimelineProps {
  events: TimelineEvent[];
  isStreaming: boolean;
}

const getEventIcon = (type: TimelineEvent['type'], status: TimelineEvent['status']) => {
  if (status === 'completed') {
    return <Check className="w-4 h-4 text-green-600 dark:text-green-400" />;
  }
  if (status === 'failed') {
    return <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
  }

  const icons: Record<TimelineEvent['type'], string> = {
    thinking: '🧠',
    tool: '🔧',
    writing: '✍️',
    reading: '📖',
    running: '⚙️',
    success: '✅',
    error: '❌',
  };

  return <span className="text-base">{icons[type]}</span>;
};

const getStatusColor = (status: TimelineEvent['status']) => {
  switch (status) {
    case 'active':
      return 'text-blue-600 dark:text-blue-400';
    case 'completed':
      return 'text-green-600 dark:text-green-400';
    case 'failed':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
};

const formatDuration = (startTime: number, endTime?: number) => {
  const end = endTime || Date.now();
  const duration = (end - startTime) / 1000;

  if (duration < 1) return '<1s';
  if (duration < 60) return `${duration.toFixed(1)}s`;
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  return `${minutes}m ${seconds}s`;
};

const TimelineItem: React.FC<{
  event: TimelineEvent;
  isLast: boolean;
  depth: number;
}> = ({ event, isLast, depth }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = event.children && event.children.length > 0;
  const statusColor = getStatusColor(event.status);
  const duration = formatDuration(event.startTime, event.endTime);

  return (
    <div className="relative">
      {/* Connection line to parent */}
      {!isLast && depth > 0 && (
        <div className="absolute left-2 top-6 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
      )}

      <div className={`flex items-start gap-2 ${depth > 0 ? 'ml-6' : ''}`}>
        {/* Expand/collapse button for items with children */}
        {hasChildren ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-1 flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div className="w-4 mt-1" />
        )}

        {/* Event icon */}
        <div className="flex-shrink-0 mt-0.5">
          {getEventIcon(event.type, event.status)}
        </div>

        {/* Event content */}
        <div className="flex-1 min-w-0 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${statusColor}`}>
              {event.title}
            </span>
            {event.details && (
              <code className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded truncate max-w-[200px]">
                {event.details}
              </code>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {duration}
            </span>
          </div>

          {/* Progress bar for active items */}
          {event.status === 'active' && (
            <div className="mt-1.5 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {event.children?.map((child, index) => (
              <TimelineItem
                key={child.id}
                event={child}
                isLast={index === event.children!.length - 1}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  events,
  isStreaming,
}) => {
  if (events.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white dark:bg-secondary border border-gray-200 dark:border-primary rounded-lg p-4 mb-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <span>Activity Timeline</span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-xs font-normal text-blue-600 dark:text-blue-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Streaming
            </span>
          )}
        </h3>
      </div>

      <div className="space-y-0">
        {events.map((event, index) => (
          <TimelineItem
            key={event.id}
            event={event}
            isLast={index === events.length - 1}
            depth={0}
          />
        ))}
      </div>
    </motion.div>
  );
};
