'use client';

import { X } from 'lucide-react';
import type { IFrameError } from './ErrorCard';

interface ErrorDetailModalProps {
  errors: IFrameError[];
  onClose: () => void;
}

function parseViteError(raw: string): string {
  const lines = raw.split('\n');
  const cleanLines: string[] = [];
  let foundCodeSnippet = false;

  for (const line of lines) {
    // 스택 트레이스 시작 지점에서 중단
    if (line.trim().startsWith('at ') ||
        line.includes('node_modules') ||
        line.includes('node:internal') ||
        line.includes('new Promise') ||
        line.includes('processTicksAndRejections')) {
      break;
    }

    // 코드 스니펫 감지
    if (/^\s*\d+\s*\|/.test(line)) {
      foundCodeSnippet = true;
    }

    // 코드 스니펫 이후 빈 줄 2개 이상이면 중단
    if (foundCodeSnippet && line.trim() === '') {
      const nextIdx = lines.indexOf(line) + 1;
      if (nextIdx < lines.length && lines[nextIdx].trim() === '') {
        break;
      }
    }

    cleanLines.push(line);
  }

  return cleanLines.join('\n').trim();
}

export const ErrorDetailModal = ({ errors, onClose }: ErrorDetailModalProps) => {
  if (errors.length === 0) return null;

  const getErrorContent = (error: IFrameError) => {
    if (error.type === 'vite' && error.raw) {
      return parseViteError(error.raw);
    }
    if (error.stack) {
      return error.stack;
    }
    if (error.type === 'console' && error.args) {
      return error.args.join('\n');
    }
    return error.message;
  };

  const getErrorTitle = (error: IFrameError) => {
    if (error.type === 'vite') return 'Build Error';
    if (error.type === 'runtime') return 'Runtime Error';
    if (error.type === 'promise') return 'Promise Rejection';
    return 'Error';
  };

  const modalTitle = errors.length === 1
    ? getErrorTitle(errors[0])
    : `${errors.length} Errors`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-primary rounded-lg border border-primary max-w-4xl w-full max-h-[80vh] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-primary">
          <h2 className="text-base font-semibold text-primary">{modalTitle}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-interactive-hover rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {errors.map((error, index) => (
            <div key={error.id}>
              {errors.length > 1 && (
                <div className="text-sm font-semibold text-primary mb-2">
                  {index + 1}. {getErrorTitle(error)}
                </div>
              )}
              <pre className="text-xs font-mono text-secondary bg-secondary dark:bg-elevated rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-words">
                {getErrorContent(error)}
              </pre>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-primary flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-interactive-secondary hover:bg-interactive-hover text-primary border border-primary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
