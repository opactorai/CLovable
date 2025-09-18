/**
 * CLI Selector Component
 * Modal for selecting AI CLI
 */
import React from 'react';
import { CLIOption } from '@/types/cli';

interface CLISelectorProps {
  options: CLIOption[];
  selected?: string;
  onSelect: (cliId: string) => void;
  onClose: () => void;
}

export function CLISelector({ options, selected, onSelect, onClose }: CLISelectorProps) {
  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Select AI Assistant
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-2">
          {options.map(option => (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className={`w-full p-4 rounded-lg border transition-all ${
                selected === option.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              } ${
                !option.available || !option.configured || option.enabled === false
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
              disabled={!option.available || !option.configured || option.enabled === false}
            >
              <div className="flex items-start justify-between">
                <div className="text-left">
                  <div className="flex items-center gap-3">
                    {option.icon && (
                      <img src={option.icon} alt={option.name} className="w-6 h-6" />
                    )}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {option.name}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {option.description}
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-1">
                  {selected === option.id && (
                    <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  
                  {!option.available && (
                    <span className="text-xs text-red-500">Not installed</span>
                  )}
                  
                  {option.available && !option.configured && (
                    <span className="text-xs text-yellow-500">Not configured</span>
                  )}
                  
                  {option.available && option.configured && (
                    <span className="text-xs text-green-500">Ready</span>
                  )}
                </div>
              </div>

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
            </button>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}