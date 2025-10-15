/**
 * AI Assistant Settings Component
 * Display current AI CLI and model (read-only)
 */
import React from 'react';
import { useCLI } from '@/hooks/useCLI';

interface AIAssistantSettingsProps {
  projectId: string;
  onOpenGlobalSettings?: () => void;
}

export function AIAssistantSettings({ projectId, onOpenGlobalSettings }: AIAssistantSettingsProps) {
  const { cliOptions, preference } = useCLI({ projectId });

  const selectedCLIOption = cliOptions.find(opt => opt.id === preference?.preferred_cli);
  
  // Debug logging
  console.log('🔍 AIAssistantSettings Debug:', {
    projectId,
    preference,
    selectedCLIOption,
    cliOptions
  });
  
  // Get the actual model name from preference data
  const getModelDisplayName = () => {
    if (!preference?.selected_model) return 'Default Model';
    
    // Find the model name from the CLI options
    const currentCLI = selectedCLIOption;
    if (currentCLI?.models) {
      const model = currentCLI.models.find(m => m.id === preference.selected_model);
      console.log('🔍 Model search:', {
        selected_model: preference.selected_model,
        available_models: currentCLI.models,
        found_model: model
      });
      return model?.name || preference.selected_model;
    }
    
    return preference.selected_model;
  };
  
  const modelDisplayName = getModelDisplayName();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Current AI Assistant
        </h3>
        
        <div className="space-y-4">
          {/* Current CLI */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  CLI Agent
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedCLIOption?.name || preference?.preferred_cli || 'Not configured'}
                  </span>
                  {selectedCLIOption?.configured ? (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded">
                      Configured
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 rounded">
                      Not Configured
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Current Model */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Model
            </h4>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              {modelDisplayName}
            </span>
          </div>


          {/* Note */}
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              To modify these settings, use{' '}
              {onOpenGlobalSettings ? (
                <button
                  onClick={onOpenGlobalSettings}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline decoration-dotted underline-offset-2 transition-colors cursor-pointer"
                >
                  Global Settings
                </button>
              ) : (
                <span className="text-gray-700 dark:text-gray-300">Global Settings</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}