import React from 'react';
import { motion } from 'framer-motion';
import { glassStyles } from '../styles/glassMorphism';

interface GlassInputProps {
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  required?: boolean;
  delay?: number;
  error?: string;
  showValidation?: boolean;
}

export const GlassInput: React.FC<GlassInputProps> = ({
  type,
  value,
  onChange,
  placeholder,
  required = false,
  delay = 0,
  error,
  showValidation = false,
}) => {
  const [validationError, setValidationError] = React.useState('');
  const [isHovered, setIsHovered] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);

  // Validate when showValidation is true (triggered by form submission)
  React.useEffect(() => {
    if (showValidation) {
      if (required && !value) {
        setValidationError('This field is required');
      } else if (type === 'email' && value && !value.includes('@')) {
        setValidationError('Please include an @ in the email address');
      } else if (
        type === 'email' &&
        value &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ) {
        setValidationError('Please enter a valid email address');
      } else {
        setValidationError('');
      }
    }
  }, [showValidation, value, required, type]);

  const displayError = showValidation && (error || validationError);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.4,
        delay,
        ease: 'easeInOut',
      }}
    >
      <input
        type={type}
        value={value}
        onChange={onChange}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="w-full px-4 py-3 rounded-xl focus:outline-none transition-all text-gray-100 placeholder-gray-500"
        style={{
          ...glassStyles,
          backgroundColor: isHovered || isFocused
            ? 'rgba(255, 255, 255, 0.20)'
            : glassStyles.backgroundColor,
          border: displayError
            ? '2px solid #f87171'
            : isHovered || isFocused
            ? '1px solid rgba(255, 255, 255, 0.30)'
            : glassStyles.border,
        }}
        placeholder={placeholder}
      />
      {displayError && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 px-3 py-1.5 rounded-lg text-xs text-red-600"
        >
          {error || validationError}
        </motion.div>
      )}
    </motion.div>
  );
};
