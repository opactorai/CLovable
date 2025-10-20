/**
 * CLI Hook
 * Manages CLI configuration and status
 */
import { useState, useCallback, useEffect } from 'react';
import { CLIOption, CLIStatus, CLIPreference, CLI_OPTIONS, CLIType } from '@/types/cli';
import { CLAUDE_DEFAULT_MODEL, normalizeClaudeModelId } from '@/lib/constants/claudeModels';

interface UseCLIOptions {
  projectId: string;
}

export function useCLI({ projectId }: UseCLIOptions) {
  const [cliOptions, setCLIOptions] = useState<CLIOption[]>(CLI_OPTIONS);
  const [preference, setPreference] = useState<CLIPreference | null>(null);
  const [statuses, setStatuses] = useState<CLIStatus>({});
  const [isLoading, setIsLoading] = useState(false);

  const parsePreference = useCallback((payload: unknown): CLIPreference => {
    const data = payload as Record<string, unknown> | null | undefined;

    const preferredCli =
      typeof data?.preferredCli === 'string'
        ? data.preferredCli
        : typeof data?.preferred_cli === 'string'
        ? data.preferred_cli
        : 'claude';

    const fallbackEnabled =
      typeof data?.fallbackEnabled === 'boolean'
        ? data.fallbackEnabled
        : typeof data?.fallback_enabled === 'boolean'
        ? data.fallback_enabled
        : false;

    const rawModel =
      typeof data?.selectedModel === 'string'
        ? data.selectedModel
        : typeof data?.selected_model === 'string'
        ? data.selected_model
        : undefined;
    const normalizedModel = normalizeClaudeModelId(rawModel);

    return {
      preferredCli: (preferredCli || 'claude') as CLIType,
      fallbackEnabled,
      selectedModel: normalizedModel ?? CLAUDE_DEFAULT_MODEL,
    };
  }, []);

  // Load CLI preference
  const loadPreference = useCallback(async () => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';
      const response = await fetch(`${API_BASE}/api/projects/${projectId}`);
      if (!response.ok) {
        throw new Error('Failed to load project preferences');
      }

      const payload = await response.json();
      const project = payload?.data ?? payload ?? {};
      setPreference(parsePreference(project));
    } catch (error) {
      console.error('Failed to load CLI preference:', error);
      setPreference({
        preferredCli: 'claude',
        fallbackEnabled: false,
        selectedModel: CLAUDE_DEFAULT_MODEL,
      });
    }
  }, [projectId, parsePreference]);

  // Load all CLI statuses
  const loadStatuses = useCallback(async () => {
    try {
      setIsLoading(true);
      const fallbackStatus: CLIStatus = CLI_OPTIONS.reduce((acc, option) => {
        acc[option.id] = {
          installed: true,
          checking: false,
          available: true,
          configured: true,
          models: option.models?.map(model => model.id),
        };
        return acc;
      }, {} as CLIStatus);

      setStatuses(fallbackStatus);
      setCLIOptions(prevOptions =>
        prevOptions.map(option => ({
          ...option,
          available: true,
          configured: true,
        }))
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check single CLI status
  const checkCLIStatus = useCallback(async (cliType: string) => {
    const fallback = {
      installed: true,
      checking: false,
      available: true,
      configured: true,
      models: CLI_OPTIONS.find(option => option.id === cliType)?.models?.map(model => model.id),
    };
    setStatuses(prev => ({ ...prev, [cliType]: fallback }));
    setCLIOptions(prevOptions =>
      prevOptions.map(option =>
        option.id === cliType
          ? { ...option, available: true, configured: true }
          : option
      )
    );
    return fallback;
  }, []);

  // Update CLI preference
  const updatePreference = useCallback(async (preferredCli: string) => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';
      const response = await fetch(`${API_BASE}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredCli }),
      });

      if (!response.ok) throw new Error('Failed to update CLI preference');

      const payload = await response.json();
      const project = payload?.data ?? payload ?? {};

      setPreference(prev => ({
        preferredCli: (project.preferredCli ?? project.preferred_cli ?? preferredCli) as CLIType,
        fallbackEnabled: prev?.fallbackEnabled ?? false,
        selectedModel:
          project.selectedModel || project.selected_model
            ? normalizeClaudeModelId(project.selectedModel ?? project.selected_model)
            : prev?.selectedModel ?? CLAUDE_DEFAULT_MODEL,
      }));
      return project;
    } catch (error) {
      console.error('Failed to update CLI preference:', error);
      throw error;
    }
  }, [projectId]);

  // Update model preference
  const updateModelPreference = useCallback(async (modelId: string) => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';
      const response = await fetch(`${API_BASE}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedModel: modelId }),
      });

      if (!response.ok) throw new Error('Failed to update model preference');

      const payload = await response.json();
      const project = payload?.data ?? payload ?? {};

      const normalized = normalizeClaudeModelId(project.selectedModel ?? project.selected_model ?? modelId);

      setPreference(prev =>
        prev
          ? {
              ...prev,
              selectedModel: normalized,
            }
          : {
              preferredCli: 'claude',
              fallbackEnabled: false,
              selectedModel: normalized,
            }
      );

      return project;
    } catch (error) {
      console.error('Failed to update model preference:', error);
      throw error;
    }
  }, [projectId]);


  // Load on mount
  useEffect(() => {
    loadPreference();
    loadStatuses();
  }, [loadPreference, loadStatuses]);

  return {
    cliOptions,
    preference,
    statuses,
    isLoading,
    checkCLIStatus,
    updatePreference,
    updateModelPreference,
    reload: () => {
      loadPreference();
      loadStatuses();
    }
  };
}
