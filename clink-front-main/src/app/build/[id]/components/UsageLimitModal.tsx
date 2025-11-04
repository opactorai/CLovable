'use client';

import { X, AlertCircle } from 'lucide-react';
import type { AssistantKey } from '@/lib/assistant-options';

interface UsageLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  cli: AssistantKey;
  data: {
    success: boolean;
    cli: string;
    data?: {
      currentSession?: {
        percentage: number;
        resetTime: string;
      };
      currentWeekAllModels?: {
        percentage: number;
        resetTime: string;
      };
      currentWeekOpus?: {
        percentage: number;
        resetTime: string;
      };
      primary?: {
        usedPercent: number;
        windowMinutes: number;
        resetsInSeconds: number;
        resetsAt: string;
        label: string;
      };
      secondary?: {
        usedPercent: number;
        windowMinutes: number;
        resetsInSeconds: number;
        resetsAt: string;
        label: string;
      };
      lastUpdatedAt: number;
    };
    error?: string;
    statusCode?: number;
  } | null;
  isLoading: boolean;
}

const ProgressBar = ({ percentage, label }: { percentage: number; label: string }) => {
  const getColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500 dark:bg-red-600';
    if (percent >= 70) return 'bg-yellow-500 dark:bg-yellow-600';
    return 'bg-green-500 dark:bg-green-600';
  };

  return (
    <div className="mb-4">
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-sm text-gray-600 dark:text-gray-400">{percentage.toFixed(1)}%</span>
      </div>
      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor(percentage)} transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
};

export const UsageLimitModal = ({
  isOpen,
  onClose,
  cli,
  data,
  isLoading,
}: UsageLimitModalProps) => {
  if (!isOpen) return null;

  const formatResetTime = (resetTime: string) => {
    try {
      const date = new Date(resetTime);
      return date.toLocaleString();
    } catch {
      return resetTime;
    }
  };

  const formatSecondsToTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative rounded-2xl max-w-[600px] w-full mx-4 border border-primary dark:border-primary bg-white dark:bg-secondary">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-primary dark:border-primary">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-primary dark:text-white">Usage Limits</h2>
            <span className="text-sm text-secondary dark:text-secondary">
              ({cli === 'claude' ? 'Claude' : cli === 'gemini' ? 'Gemini' : cli === 'glm' ? 'Z.ai' : 'Codex'})
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-secondary dark:text-secondary w-8 h-8 rounded-full flex items-center justify-center transition-colors liquid hover:bg-gray-100 dark:hover:bg-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Claude - External Link */}
          {cli === 'claude' && (
            <div className="flex items-start gap-3 p-4 bg-primary dark:bg-primary border border-primary dark:border-primary rounded-lg">
              <AlertCircle className="w-5 h-5 text-primary dark:text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-primary dark:text-primary">Check Claude Usage</p>
                <p className="text-sm text-primary dark:text-primary mt-1">
                  You can check your Claude usage limits at{' '}
                  <a
                    href="https://claude.ai/settings/usage"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-600 dark:hover:text-blue-300"
                  >
                    claude.ai/settings/usage
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* Gemini - Not Supported */}
          {cli === 'gemini' && (
            <div className="flex items-start gap-3 p-4 bg-primary dark:bg-primary border border-primary dark:border-primary rounded-lg">
              <AlertCircle className="w-5 h-5 text-primary dark:text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-primary dark:text-primary">Not Supported Yet</p>
                <p className="text-sm text-primary dark:text-primary mt-1">
                  Usage limit tracking for Gemini is not yet supported.
                </p>
              </div>
            </div>
          )}

          {/* Z.ai - Not Supported */}
          {cli === 'glm' && (
            <div className="flex items-start gap-3 p-4 bg-primary dark:bg-primary border border-primary dark:border-primary rounded-lg">
              <AlertCircle className="w-5 h-5 text-primary dark:text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-primary dark:text-primary">Not Supported Yet</p>
                <p className="text-sm text-primary dark:text-primary mt-1">
                  Usage limit tracking for Z.ai is not yet supported.
                </p>
              </div>
            </div>
          )}

          {/* Codex - Show loading/data */}
          {cli === 'codex' && isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-primary" />
            </div>
          )}

          {cli === 'codex' && !isLoading && data?.error && (
            <>
              {data.statusCode === 404 ? (
                <div className="flex items-start gap-3 p-4 bg-primary dark:bg-primary border border-primary dark:border-primary rounded-lg">
                  <AlertCircle className="w-5 h-5 text-primary dark:text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-primary dark:text-primary">No usage data collected yet</p>
                    <p className="text-sm text-primary dark:text-primary mt-1">
                      Usage data will be automatically collected when you send chat requests.
                    </p>
                  </div>
                </div>
              ) : data.statusCode === 500 ? (
                <div className="flex items-start gap-3 p-4 bg-primary dark:bg-primary border border-primary dark:border-primary rounded-lg">
                  <AlertCircle className="w-5 h-5 text-primary dark:text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-primary dark:text-primary">Feature Not Supported</p>
                    <p className="text-sm text-primary dark:text-primary mt-1">
                      This project does not support usage limit tracking. Please create a new project to check usage limits.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-900 dark:text-red-300">Error</p>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1">{data.error}</p>
                  </div>
                </div>
              )}
            </>
          )}

          {cli === 'codex' && !isLoading && data?.success && data.data && (
            <div className="space-y-6">
              {/* Codex Usage */}
              {(data.data.primary || data.data.secondary) && (
                <div>
                  <h3 className="text-sm font-semibold text-primary dark:text-primary mb-4">Codex Usage</h3>

                  {data.data.primary && (
                    <div className="mb-4">
                      <ProgressBar
                        percentage={data.data.primary.usedPercent}
                        label={data.data.primary.label}
                      />
                      <p className="text-xs text-primary dark:text-primary">
                        Window: {data.data.primary.windowMinutes} minutes •
                        Resets in: {formatSecondsToTime(data.data.primary.resetsInSeconds)}
                      </p>
                    </div>
                  )}

                  {data.data.secondary && (
                    <div className="mb-4">
                      <ProgressBar
                        percentage={data.data.secondary.usedPercent}
                        label={data.data.secondary.label}
                      />
                      <p className="text-xs text-primary dark:text-primary">
                        Window: {data.data.secondary.windowMinutes} minutes •
                        Resets in: {formatSecondsToTime(data.data.secondary.resetsInSeconds)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Last Updated */}
              {data.data.lastUpdatedAt && (
                <div className="text-xs text-primary dark:text-primary text-center pt-4 border-t border-primary dark:border-primary">
                  Last updated: {new Date(data.data.lastUpdatedAt).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-primary dark:border-primary">
          <button
            onClick={onClose}
            className="px-4 py-2 text-primary dark:text-primary rounded-lg transition-colors liquid hover:bg-primary dark:hover:bg-primary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
