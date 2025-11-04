import React from 'react';
import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import { GlassInput } from './GlassInput';

interface EmailFormProps {
  email: string;
  setEmail: (email: string) => void;
  showValidation?: boolean;
}

export const EmailForm: React.FC<EmailFormProps> = ({ email, setEmail, showValidation = false }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      className="space-y-6"
    >
      <GlassInput
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your work or personal email"
        required
        delay={0.1}
        showValidation={showValidation}
      />
    </motion.div>
  );
};
