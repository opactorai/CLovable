import { motion, type MotionProps } from 'framer-motion'

// Define types for different HTML elements with motion props
type MotionDivProps = MotionProps & React.HTMLAttributes<HTMLDivElement>
type MotionH3Props = MotionProps & React.HTMLAttributes<HTMLHeadingElement>
type MotionPProps = MotionProps & React.HTMLAttributes<HTMLParagraphElement>
type MotionButtonProps = MotionProps & React.ButtonHTMLAttributes<HTMLButtonElement>

// Export typed motion components
export const MotionDiv = motion.div as React.FC<MotionDivProps>
export const MotionH3 = motion.h3 as React.FC<MotionH3Props>
export const MotionP = motion.p as React.FC<MotionPProps>
export const MotionButton = motion.button as React.FC<MotionButtonProps>
