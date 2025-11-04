import { motion } from 'framer-motion';
import { Code, Sparkles } from 'lucide-react';

export const ChatLoadingAnimation = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      {/* Static icon */}
      <motion.div
        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mb-6 shadow-lg"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Code className="w-8 h-8 text-white" />
      </motion.div>

      {/* Loading text */}
      <motion.h3
        className="text-xs font-semibold text-gray-900 dark:text-white mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        Connecting to workspace
      </motion.h3>

      {/* Animated dots */}
      <motion.div
        className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <span>Setting up your environment</span>
        <div className="flex gap-1 ml-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{
                opacity: [0.2, 1, 0.2],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
                ease: 'easeInOut',
              }}
            >
              •
            </motion.span>
          ))}
        </div>
      </motion.div>

      {/* Progress steps */}
      <motion.div
        className="mt-8 space-y-3 max-w-xs"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        {[
          { label: 'Initializing sandbox', delay: 0 },
          { label: 'Loading project files', delay: 0.3 },
          { label: 'Preparing AI assistant', delay: 0.6 },
        ].map((step, index) => (
          <motion.div
            key={index}
            className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 + step.delay, duration: 0.4 }}
          >
            <motion.div
              className="w-2 h-2 rounded-full bg-purple-500"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: step.delay,
                ease: 'easeInOut',
              }}
            />
            <span>{step.label}</span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};
