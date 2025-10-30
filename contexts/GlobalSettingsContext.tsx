"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getDefaultModelForCli } from '@/lib/constants/cliModels';
import type { CLISettingsEntry, GlobalSettingsState, MCPServerConfig } from '@/types/settings';

export type GlobalAISettings = GlobalSettingsState;

type GlobalSettingsCtx = {
  settings: GlobalAISettings;
  setSettings: React.Dispatch<React.SetStateAction<GlobalAISettings>>;
  refresh: () => Promise<void>;
};

const defaultSettings: GlobalAISettings = {
  default_cli: 'claude',
  cli_settings: {
    claude: { model: getDefaultModelForCli('claude'), mcpServers: [] },
    codex: { model: getDefaultModelForCli('codex'), mcpServers: [] },
    cursor: { model: getDefaultModelForCli('cursor'), mcpServers: [] },
    qwen: { model: getDefaultModelForCli('qwen'), mcpServers: [] },
    glm: { model: getDefaultModelForCli('glm'), mcpServers: [] },
    opencode: { mcpServers: [] },
  },
};

const normalizeMcpServers = (value: unknown): MCPServerConfig[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((entry, index) => {
        if (!entry || typeof entry !== 'object') return null;
        const record = entry as Record<string, unknown>;
        const idCandidate =
          typeof record.id === 'string' && record.id.trim().length > 0
            ? record.id.trim()
            : `server-${index + 1}`;
        return {
          ...(record as Record<string, unknown>),
          id: idCandidate,
        } as MCPServerConfig;
      })
      .filter((entry): entry is MCPServerConfig => Boolean(entry));
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => {
        if (!entry || typeof entry !== 'object') return null;
        const record = entry as Record<string, unknown>;
        const idCandidate =
          typeof record.id === 'string' && record.id.trim().length > 0
            ? record.id.trim()
            : key;
        return {
          ...(record as Record<string, unknown>),
          id: idCandidate,
        } as MCPServerConfig;
      })
      .filter((entry): entry is MCPServerConfig => Boolean(entry));
  }

  return [];
};

const mergeWithDefaults = (incoming?: Record<string, CLISettingsEntry> | null): Record<string, CLISettingsEntry> => {
  const result: Record<string, CLISettingsEntry> = {};

  for (const [cli, baseConfig] of Object.entries(defaultSettings.cli_settings)) {
    const candidate = incoming?.[cli];
    const { mcpServers: _ignoredBase, ...baseRest } = (baseConfig ?? {}) as CLISettingsEntry;
    const { mcpServers: candidateServersRaw, ...candidateRest } = (candidate ?? {}) as CLISettingsEntry;

    const hasCandidateServers =
      candidate && Object.prototype.hasOwnProperty.call(candidate, 'mcpServers');

    result[cli] = {
      ...baseRest,
      ...candidateRest,
      mcpServers: hasCandidateServers
        ? normalizeMcpServers(candidateServersRaw)
        : normalizeMcpServers(baseConfig?.mcpServers),
    };
  }

  if (incoming) {
    for (const [cli, config] of Object.entries(incoming)) {
      if (!result[cli]) {
        const { mcpServers: rawServers, ...rest } = (config ?? {}) as CLISettingsEntry;
        const hasServers = Object.prototype.hasOwnProperty.call(config ?? {}, 'mcpServers');
        result[cli] = {
          ...rest,
          mcpServers: hasServers ? normalizeMcpServers(rawServers) : [],
        };
      }
    }
  }

  return result;
};

const Ctx = createContext<GlobalSettingsCtx | null>(null);

export function useGlobalSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGlobalSettings must be used within GlobalSettingsProvider');
  return ctx;
}

export default function GlobalSettingsProvider({ children }: { children: React.ReactNode }) {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';
  const [settings, setSettings] = useState<GlobalAISettings>(() => ({
    default_cli: defaultSettings.default_cli,
    cli_settings: mergeWithDefaults(defaultSettings.cli_settings),
  }));

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/global`);
      if (res.ok) {
        const payload = (await res.json()) as GlobalSettingsState;
        setSettings({
          default_cli:
            typeof payload?.default_cli === 'string'
              ? payload.default_cli
              : defaultSettings.default_cli,
          cli_settings: mergeWithDefaults(payload?.cli_settings as Record<string, CLISettingsEntry>),
        });
      }
    } catch (e) {
      console.warn('Failed to refresh global settings', e);
    }
  }, [API_BASE]);

  // Load once on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(() => ({ settings, setSettings, refresh }), [settings, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
