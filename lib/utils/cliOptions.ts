import { CLI_OPTIONS, type CLIOption } from '@/types/cli';
import { getModelDefinitionsForCli, normalizeModelId } from '@/lib/constants/cliModels';

export const ACTIVE_CLI_IDS = ['claude', 'codex', 'cursor', 'qwen', 'glm'] as const;

export type ActiveCliId = (typeof ACTIVE_CLI_IDS)[number];

const ACTIVE_CLI_ID_SET = new Set<ActiveCliId>(ACTIVE_CLI_IDS);

const isActiveCliId = (value: string): value is ActiveCliId => {
  return ACTIVE_CLI_ID_SET.has(value as ActiveCliId);
};

export const DEFAULT_ACTIVE_CLI: ActiveCliId = 'claude';

type ActiveCliOption = CLIOption & { id: ActiveCliId };

export const ACTIVE_CLI_OPTIONS: ActiveCliOption[] = CLI_OPTIONS.filter((option): option is ActiveCliOption =>
  isActiveCliId(option.id)
);

export const ACTIVE_CLI_OPTIONS_MAP = ACTIVE_CLI_OPTIONS.reduce<Record<ActiveCliId, ActiveCliOption>>((acc, option) => {
  acc[option.id] = option;
  return acc;
}, {} as Record<ActiveCliId, ActiveCliOption>);

export const ACTIVE_CLI_BRAND_COLORS = ACTIVE_CLI_OPTIONS.reduce<Record<ActiveCliId, string>>((acc, option) => {
  acc[option.id] = option.brandColor ?? '#DE7356';
  return acc;
}, {} as Record<ActiveCliId, string>);

export const ACTIVE_CLI_NAME_MAP = ACTIVE_CLI_OPTIONS.reduce<Record<ActiveCliId, string>>((acc, option) => {
  acc[option.id] = option.name;
  return acc;
}, {} as Record<ActiveCliId, string>);

export const ACTIVE_CLI_ICON_MAP = ACTIVE_CLI_OPTIONS.reduce<Record<ActiveCliId, string>>((acc, option) => {
  if (option.icon) {
    acc[option.id] = option.icon;
  }
  return acc;
}, {} as Record<ActiveCliId, string>);

export const ACTIVE_CLI_MODEL_OPTIONS = ACTIVE_CLI_OPTIONS.reduce<Record<ActiveCliId, { id: string; name: string }[]>>(
  (acc, option) => {
    acc[option.id] = getModelDefinitionsForCli(option.id).map(({ id, name }) => ({
      id: normalizeModelId(option.id, id),
      name,
    }));
    return acc;
  },
  {} as Record<ActiveCliId, { id: string; name: string }[]>
);

export const sanitizeActiveCli = (cli: string | null | undefined, fallback: ActiveCliId = DEFAULT_ACTIVE_CLI): ActiveCliId => {
  if (!cli) {
    return fallback;
  }
  const normalized = cli.toLowerCase();
  return isActiveCliId(normalized) ? (normalized as ActiveCliId) : fallback;
};

export const normalizeModelForCli = (
  cli: string | null | undefined,
  model?: string | null,
  fallback: ActiveCliId = DEFAULT_ACTIVE_CLI
): string => {
  const sanitized = sanitizeActiveCli(cli, fallback);
  return normalizeModelId(sanitized, model);
};

export interface ModelAvailabilityEntry {
  available?: boolean;
  configured?: boolean;
  models?: string[];
}

export interface ActiveModelOption {
  id: string;
  name: string;
  cli: ActiveCliId;
  cliName: string;
  available: boolean;
}

export const buildActiveModelOptions = (statuses: Record<string, ModelAvailabilityEntry>): ActiveModelOption[] => {
  const options: ActiveModelOption[] = [];

  ACTIVE_CLI_OPTIONS.forEach(({ id, name }) => {
    const status = statuses?.[id];
    const availableModels = new Set((status?.models ?? []).map(modelId => normalizeModelId(id, modelId)));
    const baseAvailability = Boolean(status?.available ?? status?.configured ?? true);

    getModelDefinitionsForCli(id).forEach(definition => {
      const normalizedId = normalizeModelId(id, definition.id);
      const isAvailable = baseAvailability && (availableModels.size === 0 || availableModels.has(normalizedId));

      options.push({
        id: normalizedId,
        name: definition.name,
        cli: id,
        cliName: name,
        available: isAvailable,
      });
    });
  });

  return options;
};
