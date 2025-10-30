import fs from 'fs/promises';
import path from 'path';
import { getDefaultModelForCli, normalizeModelId } from '@/lib/constants/cliModels';
import type { CLISettingsEntry, GlobalSettingsState, MCPServerConfig } from '@/types/settings';

const DATA_DIR = process.env.SETTINGS_DIR || path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'global-settings.json');

type CLISettings = Record<string, CLISettingsEntry>;

const DEFAULT_SETTINGS: GlobalSettingsState = {
  default_cli: 'claude',
  cli_settings: {
    claude: {
      model: getDefaultModelForCli('claude'),
      mcpServers: [],
    },
    codex: {
      model: getDefaultModelForCli('codex'),
      mcpServers: [],
    },
    cursor: {
      model: getDefaultModelForCli('cursor'),
      mcpServers: [],
    },
    qwen: {
      model: getDefaultModelForCli('qwen'),
      mcpServers: [],
    },
    glm: {
      model: getDefaultModelForCli('glm'),
      mcpServers: [],
    },
    opencode: {
      mcpServers: [],
    },
  },
};

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
};

const normalizeStringRecord = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const map: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string') {
      map[key] = entry;
    } else if (entry != null) {
      map[key] = String(entry);
    }
  }
  return Object.keys(map).length > 0 ? map : undefined;
};

const normalizeArgs = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    const filtered = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    return filtered.length > 0 ? filtered : undefined;
  }
  if (typeof value === 'string') {
    const parts = value
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : undefined;
  }
  return undefined;
};

function normalizeMcpServers(value: unknown): MCPServerConfig[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((entry, index) => {
        if (!entry || typeof entry !== 'object') return null;
        const record = entry as Record<string, unknown>;
        const {
          id: rawId,
          args: rawArgs,
          env: rawEnv,
          headers: rawHeaders,
          metadata,
          ...rest
        } = record;
        const idCandidate =
          typeof rawId === 'string' && rawId.trim().length > 0
            ? rawId.trim()
            : `server-${index + 1}`;
        const normalized: MCPServerConfig = { id: idCandidate } as MCPServerConfig;
        Object.assign(normalized, rest);

        const args = normalizeArgs(rawArgs);
        if (args) {
          normalized.args = args;
        } else {
          delete normalized.args;
        }

        const env = normalizeStringRecord(rawEnv);
        if (env) {
          normalized.env = env;
        } else {
          delete normalized.env;
        }

        const headers = normalizeStringRecord(rawHeaders);
        if (headers) {
          normalized.headers = headers;
        } else {
          delete normalized.headers;
        }

        if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
          normalized.metadata = metadata as Record<string, unknown>;
        }

        if (typeof normalized.enabled !== 'boolean') {
          delete normalized.enabled;
        }

        return normalized;
      })
      .filter((entry): entry is MCPServerConfig => Boolean(entry));
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => {
        if (!entry || typeof entry !== 'object') return null;
        const record = entry as Record<string, unknown>;
        const {
          id: rawId,
          args: rawArgs,
          env: rawEnv,
          headers: rawHeaders,
          metadata,
          ...rest
        } = record;
        const idCandidate =
          typeof rawId === 'string' && rawId.trim().length > 0
            ? rawId.trim()
            : String(key);
        const normalized: MCPServerConfig = { id: idCandidate } as MCPServerConfig;
        Object.assign(normalized, rest);

        const args = normalizeArgs(rawArgs);
        if (args) {
          normalized.args = args;
        } else {
          delete normalized.args;
        }

        const env = normalizeStringRecord(rawEnv);
        if (env) {
          normalized.env = env;
        } else {
          delete normalized.env;
        }

        const headers = normalizeStringRecord(rawHeaders);
        if (headers) {
          normalized.headers = headers;
        } else {
          delete normalized.headers;
        }

        if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
          normalized.metadata = metadata as Record<string, unknown>;
        }

        if (typeof normalized.enabled !== 'boolean') {
          delete normalized.enabled;
        }
        return normalized;
      })
      .filter((entry): entry is MCPServerConfig => Boolean(entry));
  }

  return [];
}

function mergeWithDefaults(
  source: Partial<CLISettings> | null | undefined,
): CLISettings {
  const result: CLISettings = {};
  for (const [cli, defaultConfig] of Object.entries(DEFAULT_SETTINGS.cli_settings)) {
    const candidate = source?.[cli];
    const merged: CLISettingsEntry = {
      ...(defaultConfig ?? {}),
      ...(candidate ?? {}),
    };
    merged.mcpServers = normalizeMcpServers(candidate?.mcpServers ?? merged.mcpServers);
    result[cli] = merged;
  }

  if (source) {
    for (const [cli, config] of Object.entries(source)) {
      if (!result[cli]) {
        const normalized: CLISettingsEntry = {
          ...(config ?? {}),
        };
        normalized.mcpServers = normalizeMcpServers(config?.mcpServers);
        result[cli] = normalized;
      }
    }
  }

  return result;
}

async function readSettingsFile(): Promise<GlobalSettingsState | null> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as GlobalSettingsState;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const defaultCli = typeof parsed.default_cli === 'string'
      ? parsed.default_cli
      : DEFAULT_SETTINGS.default_cli;

    const cliSettings = toRecord(parsed.cli_settings);

    return {
      default_cli: typeof parsed.default_cli === 'string' ? parsed.default_cli : DEFAULT_SETTINGS.default_cli,
      cli_settings: mergeWithDefaults(cliSettings as CLISettings),
    };
  } catch (error) {
    return null;
  }
}

async function writeSettings(settings: GlobalSettingsState): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
}

export async function loadGlobalSettings(): Promise<GlobalSettingsState> {
  const existing = await readSettingsFile();
  if (existing) {
    const merged: GlobalSettingsState = {
      default_cli: existing.default_cli ?? DEFAULT_SETTINGS.default_cli,
      cli_settings: mergeWithDefaults(existing.cli_settings),
    };
    return merged;
  }

  await writeSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export function normalizeCliSettings(settings: unknown): CLISettings | undefined {
  if (!settings || typeof settings !== 'object') {
    return undefined;
  }

  const normalized: CLISettings = {};
  for (const [cli, config] of Object.entries(settings)) {
    if (config && typeof config === 'object' && !Array.isArray(config)) {
      const entry = config as CLISettingsEntry;
      const nextConfig: CLISettingsEntry = { ...entry };
      const model = typeof nextConfig.model === 'string' ? nextConfig.model : undefined;
      if (model) {
        nextConfig.model = normalizeModelId(cli, model);
      }
      if (entry.mcpServers) {
        nextConfig.mcpServers = normalizeMcpServers(entry.mcpServers);
      }
      normalized[cli] = nextConfig;
    } else if (config && typeof config === 'object' && Array.isArray(config)) {
      normalized[cli] = {
        mcpServers: normalizeMcpServers(config),
      };
    }
  }

  return normalized;
}

export async function updateGlobalSettings(partial: Partial<GlobalSettingsState>): Promise<GlobalSettingsState> {
  const current = await loadGlobalSettings();

  const cliSettings = normalizeCliSettings(partial.cli_settings);

  const next: GlobalSettingsState = {
    default_cli: partial.default_cli ?? current.default_cli,
    cli_settings: mergeWithDefaults(current.cli_settings),
  };

  if (cliSettings) {
    for (const [cli, config] of Object.entries(cliSettings)) {
      const currentEntry = next.cli_settings[cli] ?? {};
      const merged: CLISettingsEntry = {
        ...currentEntry,
        ...config,
      };
      merged.mcpServers = normalizeMcpServers(config.mcpServers ?? currentEntry.mcpServers);
      next.cli_settings[cli] = merged;
    }
  }

  await writeSettings(next);
  return next;
}
