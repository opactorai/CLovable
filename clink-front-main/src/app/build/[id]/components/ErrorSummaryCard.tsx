'use client';

import { AlertTriangle } from 'lucide-react';
import type { IFrameError } from './ErrorCard';

interface ErrorSummaryCardProps {
  errors: IFrameError[];
  onOpenDetail?: () => void;
  onFix?: () => void;
}

export const ErrorSummaryCard = ({ errors, onOpenDetail, onFix }: ErrorSummaryCardProps) => {
  if (errors.length === 0) return null;

  const getErrorText = () => {
    const count = errors.length;
    return count === 1 ? '1 Error Detected' : `${count} Errors Detected`;
  };

  return (
    <div className="rounded-lg border border-primary bg-secondary dark:bg-secondary px-3 py-2 mb-2">
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes pulse-warning {
            0%, 100% {
              opacity: 0.4;
            }
            50% {
              opacity: 1;
            }
          }
        `
      }} />

      <div className="flex items-center justify-between gap-3">
        {/* Left: Icon + Error info */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Pulsing warning icon */}
          <AlertTriangle
            className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0"
            style={{ animation: 'pulse-warning 2s ease-in-out infinite' }}
          />

          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-primary">
              {getErrorText()}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {onOpenDetail && (
            <button
              type="button"
              onClick={onOpenDetail}
              className="px-2.5 py-1 text-[11px] rounded-md bg-interactive-secondary hover:bg-interactive-hover text-primary border border-primary whitespace-nowrap"
            >
              Detail
            </button>
          )}
          {onFix && (
            <button
              type="button"
              onClick={onFix}
              className="px-2.5 py-1 text-[11px] rounded-md bg-interactive-primary hover:bg-interactive-hover text-white border border-interactive-primary whitespace-nowrap"
            >
              Fix
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
