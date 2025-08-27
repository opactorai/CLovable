/**
 * Project CLI Setup Step
 * Configure AI assistant for the project
 */
import React from 'react';
import { CLIOption, CLI_OPTIONS } from '@/types/cli';

interface ProjectCLISetupProps {
  selectedCLI: string;
  fallbackEnabled: boolean;
  onCLISelect: (cliId: string) => void;
  onFallbackChange: (enabled: boolean) => void;
}

export function ProjectCLISetup({
  selectedCLI,
  fallbackEnabled,
  onCLISelect,
  onFallbackChange
}: ProjectCLISetupProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          AI Assistant Configuration
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Choose your preferred AI assistant for this project
        </p>
      </div>

      {/* CLI Options */}
      <div className="space-y-3">
        {CLI_OPTIONS.filter(option => option.enabled !== false).map((option) => (
          <div
            key={option.id}
            onClick={() => onCLISelect(option.id)}
            className={`p-4 border rounded-lg cursor-pointer transition-all ${
              selectedCLI === option.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                checked={selectedCLI === option.id}
                onChange={() => onCLISelect(option.id)}
                className="mt-1 text-blue-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {option.icon && (
                    <img src={option.icon} alt={option.name} className="w-5 h-5" />
                  )}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {option.name}
                  </span>
                  {option.id === 'claude' && (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {option.description}
                </p>
                
                {/* Show available models */}
                {option.models && option.models.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {option.models.slice(0, 3).map(model => (
                      <span
                        key={model.id}
                        className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded"
                      >
                        {model.name}
                      </span>
                    ))}
                    {option.models.length > 3 && (
                      <span className="text-xs px-2 py-1 text-gray-500">
                        +{option.models.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fallback Option */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={fallbackEnabled}
            onChange={(e) => onFallbackChange(e.target.checked)}
            className="mt-1 w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
          />
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Enable Automatic Fallback
            </span>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              If your selected AI assistant is unavailable, automatically try other configured assistants. 
              This ensures your development workflow continues uninterrupted.
            </p>
          </div>
        </label>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium">Configuration Required</p>
            <p className="mt-1">
              Make sure your selected AI assistant is properly configured with API keys in your environment variables.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}