import { motion } from 'framer-motion';
import type { DevServerStatus } from '@/types/streaming';

interface DevServerStatusBadgeProps {
  status: DevServerStatus;
}

const statusConfig: Record<
  DevServerStatus,
  { label: string; icon: string; color: string; bgColor: string }
> = {
  live: {
    label: 'Live',
    icon: '⚡',
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700',
  },
  stopped: {
    label: 'Stopped',
    icon: '⏸️',
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600',
  },
  error: {
    label: 'Error',
    icon: '⚠️',
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700',
  },
  restarting: {
    label: 'Restarting',
    icon: '🔄',
    color: 'text-yellow-700 dark:text-yellow-300',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700',
  },
};

export const DevServerStatusBadge: React.FC<DevServerStatusBadgeProps> = ({
  status,
}) => {
  const config = statusConfig[status];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${config.bgColor} ${config.color}`}
    >
      <span className={status === 'restarting' ? 'animate-spin' : ''}>
        {config.icon}
      </span>
      <span>{config.label}</span>
    </motion.div>
  );
};