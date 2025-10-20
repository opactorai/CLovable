'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ThinkingSectionProps {
  content: string;
  isExpanded?: boolean;
}

export default function ThinkingSection({ 
  content, 
  isExpanded: initialExpanded = false
}: ThinkingSectionProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  
  // Get first line as title
  const lines = content.split('\n').filter(line => line.trim());
  const firstLine = lines[0] || content.substring(0, 100);
  const restContent = lines.slice(1).join('\n');
  const hasMoreContent = lines.length > 1;
  
  // Parse content for special formatting
  const formatThinkingContent = (text: string) => {
    // Split by double asterisks for emphasis
    const parts = text.split(/\*\*(.*?)\*\*/g);
    
    return parts.map((part, index) => {
      // Odd indices are the emphasized text
      if (index % 2 === 1) {
        return (
          <span key={index} className="font-medium text-gray-600 dark:text-gray-400">
            {part}
          </span>
        );
      }
      
      // Format regular text with proper line breaks
      return part.split('\n').map((line, lineIndex) => (
        <React.Fragment key={`${index}-${lineIndex}`}>
          {lineIndex > 0 && <br />}
          {line}
        </React.Fragment>
      ));
    });
  };

  return (
    <div className="my-2 text-sm text-gray-500 dark:text-gray-500">
      {/* Always visible first line */}
      <div 
        onClick={() => hasMoreContent && setIsExpanded(!isExpanded)}
        className={`${hasMoreContent ? 'cursor-pointer hover:text-gray-600 dark:hover:text-gray-400' : ''} transition-colors`}
      >
        <span className="italic">Thinking: </span>
        <span className="italic">{formatThinkingContent(firstLine.replace(/^\*\*/, '').replace(/\*\*$/, ''))}</span>
      </div>
      
      {/* Expanded content - rest of the thinking */}
      {hasMoreContent && (
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{ marginTop: '0.5rem', overflow: 'hidden' }}
            >
              <div className="italic text-gray-500 dark:text-gray-500 leading-relaxed whitespace-pre-wrap">
                {formatThinkingContent(restContent)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}