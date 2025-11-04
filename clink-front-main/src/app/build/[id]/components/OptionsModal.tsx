'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { ASSISTANT_OPTIONS, AssistantKey } from '@/lib/assistant-options';

interface OptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCli: AssistantKey;
  onAssistantTabSelect: (cli: AssistantKey) => void;
  selectedModel: string;
  onModelChange: (value: string) => void;
  selectedEffort: 'low' | 'medium' | 'high';
  onEffortChange: (value: 'low' | 'medium' | 'high') => void;
}

export const OptionsModal = ({
  isOpen,
  onClose,
  selectedCli,
  onAssistantTabSelect,
  selectedModel,
  onModelChange,
  selectedEffort,
  onEffortChange,
}: OptionsModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
     
      
      {/* Modal */}
      <div className="relative rounded-2xl max-w-[800px] w-full mx-4 border border-gray-200 bg-white">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">AI Assistant Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 w-8 h-8 rounded-full flex items-center justify-center transition-colors liquid"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Assistant Selection - Read Only */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Assistant (Set at project creation)
            </label>
            <div className="grid grid-cols-3 gap-10">
              {(Object.keys(ASSISTANT_OPTIONS) as AssistantKey[]).map((key) => {
                const option = ASSISTANT_OPTIONS[key];
                const isActive = selectedCli === key;

                // Map assistant keys to their corresponding icon files
                const getIconPath = (assistantKey: AssistantKey) => {
                  switch (assistantKey) {
                    case 'codex':
                      return '/assets/provider/openai.png';
                    case 'claude':
                      return '/assets/provider/claude.png';
                    case 'gemini':
                      return '/assets/provider/gemini.png';
                    default:
                      return '/assets/provider/openai.png';
                  }
                };

                return (
                  <div
                    key={key}
                    className={`p-4 text-center rounded-lg border ${
                      isActive
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-gray-50 opacity-50'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <img
                        src={getIconPath(key)}
                        alt={option.label}
                        className="w-8 h-8 mb-2"
                      />
                      <div className={`font-medium mb-1 ${isActive ? 'text-blue-700' : 'text-gray-500'}`}>
                        {option.label}
                      </div>
                      <div className="text-xs text-gray-500">
                        {option.models.length} model{option.models.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              The AI assistant is fixed for this project. You can choose different models within the same assistant.
            </p>
          </div>

          {/* Model and Effort Selection - 2 Columns */}
          <div className="grid grid-cols-2 gap-6">
            {/* Model Selection */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Model
              </label>
              <select
                value={selectedModel}
                onChange={(event) => onModelChange(event.target.value)}
                className="w-full liquid rounded-lg border border-gray-200 px-3 py-2 pr-8 text-gray-700 focus:outline-none focus:border-transparent appearance-none"
                style={{ 
                  position: 'relative',
                  zIndex: 1000,
                  transform: 'translateZ(0)',
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.5rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em'
                }}
              >
                {ASSISTANT_OPTIONS[selectedCli].models.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Effort Selection */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Effort Level
              </label>
              <select
                value={selectedEffort}
                onChange={(event) => onEffortChange(event.target.value as 'low' | 'medium' | 'high')}
                className="w-full liquid rounded-lg border border-gray-200 px-3 py-2 pr-8 text-gray-700 focus:outline-none focus:border-transparent appearance-none"
                style={{ 
                  position: 'relative',
                  zIndex: 1000,
                  transform: 'translateZ(0)',
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.5rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em'
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <div className="mt-2 text-xs text-gray-500">
                <div>• <strong>Low:</strong> Quick responses, basic functionality</div>
                <div>• <strong>Medium:</strong> Balanced approach, good quality</div>
                <div>• <strong>High:</strong> Thorough analysis, maximum quality</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-blue-500 rounded-lg transition-colors liquid"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
