/**
 * AI Assistant Settings Component
 * Display current AI CLI and model (read-only)
 */
import React, { useMemo } from 'react';
import { useCLI } from '@/hooks/useCLI';

interface AIAssistantSettingsProps {
  projectId: string;
}

export function AIAssistantSettings({ projectId }: AIAssistantSettingsProps) {
  const { cliOptions, preference } = useCLI({ projectId });

  const selectedCLIOption = useMemo(
    () => cliOptions.find(opt => opt.id === preference?.preferredCli),
    [cliOptions, preference?.preferredCli],
  );

  const modelDisplayName = useMemo(() => {
    if (!preference?.selectedModel) return 'Default Model';
    if (selectedCLIOption?.models) {
      const model = selectedCLIOption.models.find(m => m.id === preference.selectedModel);
      return model?.name || preference.selectedModel;
    }
    return preference.selectedModel;
  }, [preference?.selectedModel, selectedCLIOption]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Current AI Assistant
        </h3>
        
        <div className="space-y-4">
          {/* Current CLI */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">
                  CLI Agent
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-900 ">
                    {selectedCLIOption?.name || preference?.preferredCli || 'Not configured'}
                  </span>
                  {selectedCLIOption?.configured ? (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                      Configured
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                      Not Configured
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Current Model */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-1">
              Model
            </h4>
            <span className="text-lg font-semibold text-gray-900 ">
              {modelDisplayName}
            </span>
          </div>


          {/* Note */}
          <div className="text-center">
            <p className="text-sm text-gray-500 ">
              To modify these settings, use Global Settings
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 border border-dashed border-gray-300 bg-gray-50 rounded-lg text-sm text-gray-600 leading-relaxed">
        <p>
          MCP server configuration now lives under <span className="font-medium text-gray-700">Global Settings → MCP</span>.
          Manage stdio processes, remote transports, and shared toolchains there for Claude Code, Codex, Cursor, Qwen, and GLM.
        </p>
        <p className="mt-2">
          If you still need advanced OpenCode overrides, edit <code className="font-mono text-xs bg-white px-1 py-0.5 rounded border border-gray-200">.opencode/opencode.jsonc</code> directly in your project workspace.
        </p>
      </div>
    </div>
  );
}
