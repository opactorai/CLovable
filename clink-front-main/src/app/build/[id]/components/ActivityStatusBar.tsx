import { motion, AnimatePresence } from 'framer-motion';
import type { ActivityState } from '@/types/streaming';

interface ActivityStatusBarProps {
  activity: ActivityState | null;
}

const activityIcons: Record<ActivityState['type'], string> = {
  thinking: '🤔',
  writing: '✍️',
  reading: '📖',
  running_command: '⚙️',
  applying_patch: '🔧',
  searching: '🔍',
  idle: '',
};

export const ActivityStatusBar: React.FC<ActivityStatusBarProps> = ({
  activity,
}) => {
  if (!activity || activity.type === 'idle') {
    return null;
  }

  const icon = activityIcons[activity.type];
  const displayMessage = activity.target
    ? `${activity.message} ${activity.target}`
    : activity.message;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activity.message}
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="liquid relative overflow-hidden rounded-xl p-3 mb-3"
      >
        <div className="flex items-center gap-3 relative z-10">
          <span className="text-xs font-normal text-gray-800 dark:text-gray-200">
            {displayMessage}
          </span>
        </div>

        {/* Animated shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/10"
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        {/* Animated progress bar */}
        <motion.div
          className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </motion.div>
    </AnimatePresence>
  );
};