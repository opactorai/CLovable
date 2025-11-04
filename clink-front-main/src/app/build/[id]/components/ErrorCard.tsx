'use client';

import { AlertCircle, Code, Wrench, Eye } from 'lucide-react';

export interface IFrameError {
  id: string;
  timestamp: number;
  type: 'vite' | 'runtime' | 'promise' | 'console';
  level?: 'log' | 'warn' | 'error' | 'info';
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  raw?: string;
  html?: string;
  args?: string[];
}

interface ErrorCardProps {
  error: IFrameError;
  onFix?: (error: IFrameError) => void;
  onOpenDetail?: (error: IFrameError) => void;
  isHidden?: boolean;
  onHide?: (errorId: string) => void;
}

function parseViteError(raw: string): { title: string; file?: string; line?: number; cleanError?: string } {
  // Vite 에러 파싱
  // 예: "[plugin:vite:css] [postcss] /path/to/file.css:10:5: error message"
  const lines = raw.split('\n');

  const fileMatch = raw.match(/([\/\w\-\.]+\.(tsx?|jsx?|css|html|json|vue)):(\d+):(\d+)/);

  if (fileMatch) {
    const file = fileMatch[1].split('/').pop() || fileMatch[1];
    const line = parseInt(fileMatch[3], 10);

    // 에러 메시지 추출
    const errorLine = lines.find(l => l.includes('error') || l.includes('Error'));
    const title = errorLine || lines[0] || 'Build error';

    // 깨끗한 에러 메시지 생성 (스택 트레이스 제거)
    const cleanLines: string[] = [];
    let foundCodeSnippet = false;

    for (const line of lines) {
      // 스택 트레이스 시작 지점에서 중단 (at, node_modules 등)
      if (line.trim().startsWith('at ') ||
          line.includes('node_modules') ||
          line.includes('node:internal') ||
          line.includes('new Promise') ||
          line.includes('processTicksAndRejections')) {
        break;
      }

      // 코드 스니펫 감지 (숫자 | 로 시작하는 라인)
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

    const cleanError = cleanLines.join('\n').trim();

    return { title: title.trim(), file, line, cleanError };
  }

  // 일반적인 에러 메시지
  return { title: lines[0] || 'Build error', cleanError: raw };
}

export const ErrorCard = ({ error, onFix, onOpenDetail, isHidden, onHide }: ErrorCardProps) => {
  if (isHidden) return null;

  const getErrorIcon = () => {
    if (error.type === 'console') {
      if (error.level === 'error') return <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />;
      if (error.level === 'warn') return <AlertCircle className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />;
      return <AlertCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
    }
    return <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />;
  };

  const getErrorColor = () => {
    if (error.type === 'console') {
      if (error.level === 'error') return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20';
      if (error.level === 'warn') return 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20';
      return 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20';
    }
    return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20';
  };

  const parsedViteError = error.type === 'vite' && error.raw ? parseViteError(error.raw) : null;

  const getErrorTitle = () => {
    if (parsedViteError) {
      return parsedViteError.file ? `${parsedViteError.file}:${parsedViteError.line}` : parsedViteError.title;
    }
    if (error.type === 'runtime') {
      return error.filename ? `${error.filename}:${error.lineno}` : error.message;
    }
    if (error.type === 'console') {
      return error.args?.[0] || error.message;
    }
    return error.message;
  };

  const getErrorDescription = () => {
    if (parsedViteError) {
      return parsedViteError.title;
    }
    if (error.type === 'runtime') {
      return error.message;
    }
    if (error.type === 'console' && error.args) {
      return error.args.slice(1).join(' ');
    }
    return null;
  };

  const getErrorTypeLabel = () => {
    if (error.type === 'vite') return 'Build';
    if (error.type === 'runtime') return 'Runtime';
    if (error.type === 'promise') return 'Promise';
    if (error.type === 'console') {
      if (error.level === 'warn') return 'Warning';
      if (error.level === 'error') return 'Error';
      if (error.level === 'info') return 'Info';
      return 'Log';
    }
    return 'Error';
  };

  const title = getErrorTitle();
  const description = getErrorDescription();
  const typeLabel = getErrorTypeLabel();

  return (
    <div className={`rounded-lg border ${getErrorColor()} px-3 py-2 mb-2`}>
      <div className="flex items-start justify-between gap-3">
        {/* Left: Error info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {getErrorIcon()}
            <span className="text-[10px] font-medium text-tertiary uppercase tracking-wide">
              {typeLabel}
            </span>
          </div>
          <div className="text-xs font-medium text-primary truncate mb-0.5">
            {title}
          </div>
          {description && (
            <div className="text-[10px] text-tertiary truncate">
              {description}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {onOpenDetail && (
            <button
              type="button"
              onClick={() => onOpenDetail(error)}
              title="Show details in modal"
              className="px-2.5 py-1 text-[11px] rounded-md bg-interactive-secondary hover:bg-interactive-hover text-primary border border-primary whitespace-nowrap flex items-center gap-1"
            >
              <Eye className="w-3 h-3" />
              Detail
            </button>
          )}
          {onFix && error.type !== 'console' && (
            <button
              type="button"
              onClick={() => onFix(error)}
              title="Ask AI to fix this error"
              className="px-2.5 py-1 text-[11px] rounded-md bg-interactive-primary hover:bg-interactive-hover text-white border border-interactive-primary whitespace-nowrap flex items-center gap-1"
            >
              <Wrench className="w-3 h-3" />
              Fix
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
