import React, { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { toRelativePath } from '@/lib/utils/path';
import { ToolActionIcon } from './ToolActionIcon';
import type { ToolAction } from './toolActions';

interface ToolResultItemProps {
  action: ToolAction;
  filePath: string;
  content?: string;
  isExpanded?: boolean;
  onToggle?: (nextExpanded: boolean) => void;
}

const ToolResultItem: React.FC<ToolResultItemProps> = ({
  action,
  filePath,
  content,
  isExpanded: controlledExpanded,
  onToggle,
}) => {
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(false);
  const contentId = useId();
  const isControlled = typeof controlledExpanded === 'boolean';
  const isExpanded = isControlled ? controlledExpanded : uncontrolledExpanded;
  const hasContent = Boolean(content);

  const handleToggle = () => {
    if (!hasContent) return;
    const nextExpanded = !isExpanded;
    if (!isControlled) {
      setUncontrolledExpanded(nextExpanded);
    }
    onToggle?.(nextExpanded);
  };

  // Convert to relative path for display
  const displayPath = toRelativePath(filePath);
  const normalizedLabel = displayPath.trim() || filePath.trim() || action;
  const previewSource = normalizedLabel.replace(/\s+/g, ' ');
  const MAX_PREVIEW_LENGTH = 60;
  const shouldTruncate = previewSource.length > MAX_PREVIEW_LENGTH;
  const truncatedLabel = shouldTruncate ? `${previewSource.slice(0, MAX_PREVIEW_LENGTH)}…` : previewSource;
  const displayLabel = isExpanded || !shouldTruncate ? previewSource : truncatedLabel;
  const baseCodeClasses =
    'inline-flex max-w-full items-center align-middle rounded-md border border-primary bg-interactive-secondary text-secondary px-1.5 py-0.25 font-mono text-[0.65rem] font-semibold leading-tight shadow-[0_1px_2px_rgba(15,23,42,0.16)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.45)]';
  const interactiveClasses = hasContent
    ? 'cursor-pointer hover:bg-interactive-hover hover:border-primary hover:text-gray-700 dark:hover:bg-interactive-secondary dark:hover:border-primary dark:hover:text-gray-300 transition-colors'
    : 'cursor-text';
  
  return (
    <div className="space-y-1.5 text-xs text-secondary">
      <div className="relative flex items-start gap-2 max-w-full overflow-hidden">
        <div className="inline-flex items-center gap-1.5 rounded-md bg-interactive-secondary px-1.5 py-0.25 align-middle text-[0.65rem] font-semibold text-secondary flex-shrink-0">
          <ToolActionIcon action={action} className="h-3 w-3 text-tertiary" />
          <span className="tracking-tight">{action}</span>
        </div>
        <code
          className={`${baseCodeClasses} ${interactiveClasses} ${
            isExpanded ? 'whitespace-pre-wrap break-words' : 'truncate'
          }`}
          onClick={hasContent ? handleToggle : undefined}
          onKeyDown={(event) => {
            if (!hasContent) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleToggle();
            }
          }}
          role={hasContent ? 'button' : undefined}
          tabIndex={hasContent ? 0 : undefined}
          aria-expanded={hasContent ? Boolean(isExpanded) : undefined}
          aria-controls={hasContent ? contentId : undefined}
        >
          <span>{displayLabel}</span>
        </code>
        {hasContent && (
          <button
            type="button"
            onClick={handleToggle}
            className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm text-secondary hover:text-primary focus:outline-none transition-colors"
            aria-label={isExpanded ? 'Collapse tool result' : 'Expand tool result'}
          >
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
      </div>

      {hasContent && (
        <motion.div
          key={contentId}
          initial={false}
          animate={isExpanded ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ overflow: 'hidden', pointerEvents: isExpanded ? 'auto' : 'none' }}
          aria-hidden={!isExpanded}
          id={contentId}
        >
          <div className="rounded-lg border border-primary bg-interactive-secondary/70 px-3 py-3 text-[0.65rem] text-secondary shadow-sm dark:bg-interactive-secondary/40">
            <pre className="whitespace-pre-wrap break-words font-mono text-[0.65rem] leading-relaxed">
              {content}
            </pre>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ToolResultItem;
