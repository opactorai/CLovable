import React from 'react';
import { motion } from 'framer-motion';
import { glassStyles } from '../styles/glassMorphism';

interface GlassButtonProps {
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  type = 'button',
  onClick,
  disabled = false,
  children,
  className = '',
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.03 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-3 rounded-xl font-medium transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2 ${className}`}
      style={{
        ...glassStyles,
        opacity: disabled ? 0.7 : 1,
        backgroundColor: isHovered && !disabled
          ? 'rgba(255, 255, 255, 0.25)'
          : glassStyles.backgroundColor,
        border: isHovered && !disabled
          ? '1px solid rgba(255, 255, 255, 0.35)'
          : glassStyles.border,
      }}
    >
      {children}
    </motion.button>
  );
};
