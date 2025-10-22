/**
 * CLI Hook
 * Manages CLI configuration and status
 */
import { useState, useCallback, useEffect } from 'react';
import { CLIOption, CLIStatus, CLIPreference, CLI_OPTIONS, CLIType } from '@/types/cli';
import { getDefaultModelForCli, normalizeModelId } from '@/lib/constants/cliModels';

interface UseCLIOptions {
  projectId: string;
}

const buildOptimisticStatus = (): CLIStatus =>
  CLI_OPTIONS.reduce((acc, option) => {
    acc[option.id] = {
      installed: true,
      checking: false,
      available: true,
      configured: true,
      models: option.models?.map((model) => model.id),
    };
    return acc;
  }, {} as CLIStatus);

export const createCliStatusFallback = (): CLIStatus => buildOptimisticStatus();

export async function fetchCliStatusSnapshot(): Promise<CLIStatus> {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';
  try {
    const response = await fetch(`${API_BASE}/api/settings/cli-status`);
    if (!response.ok) {
      throw new Error(`Failed to fetch CLI status: ${response.status}`);
    }

    const payload = (await response.json()) as CLIStatus;
    const optimistic = buildOptimisticStatus();

    for (const option of CLI_OPTIONS) {
      const entry = payload[option.id];
      if (!entry) {
        continue;
      }
      optimistic[option.id] = {
        ...optimistic[option.id],
        ...entry,
        checking: false,
        available: entry.available ?? entry.installed ?? optimistic[option.id]?.available ?? false,
        configured: entry.configured ?? entry.installed ?? optimistic[option.id]?.configured ?? false,
        models: entry.models ?? option.models?.map((model) => model.id),
      };
    }

    return optimistic;
  } catch (error) {
    console.warn('Failed to fetch CLI status from API:', error);
    return buildOptimisticStatus();
  }
}

export function useCLI({ projectId }: UseCLIOptions) {
  const [cliOptions, setCLIOptions] = useState<CLIOption[]>(() => CLI_OPTIONS.map((option) => ({ ...option })));
  const [preference, setPreference] = useState<CLIPreference | null>(null);
  const [statuses, setStatuses] = useState<CLIStatus>(() => createCliStatusFallback());
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
    const normalizedModel = normalizeModelId(preferredCli, rawModel);

    return {
      preferredCli: (preferredCli || 'claude') as CLIType,
      fallbackEnabled,
      selectedModel: normalizedModel ?? getDefaultModelForCli(preferredCli),
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
        selectedModel: getDefaultModelForCli('claude'),
      });
    }
  }, [projectId, parsePreference]);

  const applyStatusToState = useCallback((status: CLIStatus) => {
    setStatuses(status);
    setCLIOptions(
      CLI_OPTIONS.map((option) => {
        const entry = status[option.id];
        return {
          ...option,
          available: Boolean(entry?.available ?? entry?.installed ?? option.available),
          configured: Boolean(entry?.configured ?? entry?.installed ?? option.configured),
        };
      })
    );
  }, []);

  // Load all CLI statuses
  const loadStatuses = useCallback(async () => {
    try {
      setIsLoading(true);
      const status = await fetchCliStatusSnapshot();
      applyStatusToState(status);
    } finally {
      setIsLoading(false);
    }
  }, [applyStatusToState]);

  // Check single CLI status
  const checkCLIStatus = useCallback(async (cliType: string) => {
    const status = await fetchCliStatusSnapshot();
    applyStatusToState(status);
    return status[cliType];
  }, [applyStatusToState]);

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
            ? normalizeModelId(project.preferredCli ?? project.preferred_cli ?? preferredCli, project.selectedModel ?? project.selected_model)
            : prev?.selectedModel ?? getDefaultModelForCli(project.preferredCli ?? project.preferred_cli ?? preferredCli),
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

      const cliForNormalization = project.preferredCli ?? project.preferred_cli ?? preference?.preferredCli ?? 'claude';
      const normalized = normalizeModelId(
        cliForNormalization,
        project.selectedModel ?? project.selected_model ?? modelId
      );

      setPreference(prev =>
        prev
          ? {
              ...prev,
              selectedModel: normalizeModelId(cliForNormalization, normalized),
            }
          : {
              preferredCli: 'claude',
              fallbackEnabled: false,
              selectedModel: normalizeModelId(cliForNormalization, normalized),
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
