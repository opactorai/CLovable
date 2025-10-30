"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { AnimatePresence } from 'framer-motion';
import { MotionDiv } from '@/lib/motion';
import ServiceConnectionModal from '@/components/modals/ServiceConnectionModal';
import { FaCog } from 'react-icons/fa';
import { useGlobalSettings } from '@/contexts/GlobalSettingsContext';
import { getModelDefinitionsForCli, normalizeModelId } from '@/lib/constants/cliModels';
import { fetchCliStatusSnapshot, createCliStatusFallback } from '@/hooks/useCLI';
import type { CLIStatus } from '@/types/cli';
import type { MCPServerConfig } from '@/types/settings';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

interface GlobalSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'general' | 'ai-agents' | 'mcp' | 'services' | 'about';
}

interface CLIOption {
  id: string;
  name: string;
  icon: string;
  description: string;
  models: { id: string; name: string; }[];
  color: string;
  brandColor: string;
  downloadUrl: string;
  installCommand: string;
  enabled?: boolean;
}

const CLI_OPTIONS: CLIOption[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    icon: '',
    description: 'Anthropic Claude with advanced reasoning',
    color: 'from-orange-500 to-red-600',
    brandColor: '#DE7356',
    downloadUrl: 'https://docs.anthropic.com/en/docs/claude-code/overview',
    installCommand: 'npm install -g @anthropic-ai/claude-code',
    enabled: true,
    models: getModelDefinitionsForCli('claude').map(({ id, name }) => ({ id, name })),
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    icon: '',
    description: 'OpenAI Codex agent with GPT-5 support',
    color: 'from-slate-900 to-gray-700',
    brandColor: '#000000',
    downloadUrl: 'https://github.com/openai/codex',
    installCommand: 'npm install -g @openai/codex',
    enabled: true,
    models: getModelDefinitionsForCli('codex').map(({ id, name }) => ({ id, name })),
  },
  {
    id: 'cursor',
    name: 'Cursor Agent',
    icon: '',
    description: 'Cursor CLI with multi-model router and autonomous tooling',
    color: 'from-slate-500 to-gray-600',
    brandColor: '#6B7280',
    downloadUrl: 'https://docs.cursor.com/en/cli/overview',
    installCommand: 'curl https://cursor.com/install -fsS | bash',
    enabled: true,
    models: getModelDefinitionsForCli('cursor').map(({ id, name }) => ({ id, name })),
  },
  {
    id: 'qwen',
    name: 'Qwen Coder',
    icon: '',
    description: 'Alibaba Qwen Code CLI with sandbox capabilities',
    color: 'from-emerald-500 to-teal-600',
    brandColor: '#11A97D',
    downloadUrl: 'https://github.com/QwenLM/qwen-code',
    installCommand: 'npm install -g @qwen-code/qwen-code',
    enabled: true,
    models: getModelDefinitionsForCli('qwen').map(({ id, name }) => ({ id, name })),
  },
  {
    id: 'glm',
    name: 'GLM CLI',
    icon: '',
    description: 'Zhipu GLM agent running on Claude Code runtime',
    color: 'from-blue-500 to-indigo-600',
    brandColor: '#1677FF',
    downloadUrl: 'https://docs.z.ai/devpack/tool/claude',
    installCommand: 'zai devpack install claude',
    enabled: true,
    models: getModelDefinitionsForCli('glm').map(({ id, name }) => ({ id, name })),
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    icon: '',
    description: 'Open-source terminal agent with MCP tooling',
    color: 'from-gray-800 to-slate-700',
    brandColor: '#111827',
    downloadUrl: 'https://opencode.ai',
    installCommand: 'npm i -g opencode-ai',
    enabled: true,
    models: [],
  },
];

const MCP_SUPPORTED_CLIS = ['claude', 'codex', 'cursor', 'glm', 'qwen'] as const;
type MCPCliId = (typeof MCP_SUPPORTED_CLIS)[number];
const MCP_SUPPORTED_SET = new Set<string>(MCP_SUPPORTED_CLIS);
const isMcpSupported = (cliId: string): cliId is MCPCliId => MCP_SUPPORTED_SET.has(cliId);

const createMcpServerId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `mcp-${Date.now()}-${Math.floor(Math.random() * 1_000)}`;

const sanitizeServerId = (value: unknown, fallback?: string) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed.replace(/\s+/g, '-');
    }
  }
  const fallbackTrimmed = typeof fallback === 'string' ? fallback.trim() : '';
  if (fallbackTrimmed.length > 0) {
    return fallbackTrimmed;
  }
  return createMcpServerId();
};

const sanitizeArgs = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    const filtered = value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);
    return filtered.length > 0 ? filtered : undefined;
  }
  if (typeof value === 'string') {
    const parts = value
      .split(/\r?\n/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    return parts.length > 0 ? parts : undefined;
  }
  return undefined;
};

const sanitizeStringRecord = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, entry]) => {
      const trimmedKey = key.trim();
      if (!trimmedKey) return null;
      if (typeof entry === 'string') {
        return [trimmedKey, entry] as [string, string];
      }
      if (entry == null) return [trimmedKey, ''];
      return [trimmedKey, String(entry)] as [string, string];
    })
    .filter((entry): entry is [string, string] => Boolean(entry));
  if (entries.length === 0) {
    return undefined;
  }
  return Object.fromEntries(entries);
};

const serializeKeyValuePairs = (record?: Record<string, string>): string => {
  if (!record) return '';
  return Object.entries(record)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
};

const parseKeyValueTextarea = (input: string): Record<string, string> | undefined => {
  if (!input) return undefined;
  const lines = input.split(/\r?\n/);
  const pairs: [string, string][] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [rawKey, ...rest] = trimmed.split('=');
    const key = rawKey.trim();
    if (!key) continue;
    const value = rest.length > 0 ? rest.join('=').trim() : '';
    pairs.push([key, value]);
  }
  if (pairs.length === 0) return undefined;
  return Object.fromEntries(pairs);
};

// Global settings are provided by context

interface ServiceToken {
  id: string;
  provider: string;
  token: string;
  name?: string;
  created_at: string;
  last_used?: string;
}

export default function GlobalSettings({ isOpen, onClose, initialTab = 'general' }: GlobalSettingsProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'ai-agents' | 'mcp' | 'services' | 'about'>(initialTab);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'github' | 'supabase' | 'vercel' | null>(null);
  const [tokens, setTokens] = useState<{ [key: string]: ServiceToken | null }>({
    github: null,
    supabase: null,
    vercel: null
  });
  const [cliStatus, setCLIStatus] = useState<CLIStatus>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const { settings: globalSettings, setSettings: setGlobalSettings, refresh: refreshGlobalSettings } = useGlobalSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [selectedCLI, setSelectedCLI] = useState<CLIOption | null>(null);
  const [apiKeyVisibility, setApiKeyVisibility] = useState<Record<string, boolean>>({});

  // Show toast function
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadAllTokens = useCallback(async () => {
    const providers = ['github', 'supabase', 'vercel'];
    const newTokens: { [key: string]: ServiceToken | null } = {};
    
    for (const provider of providers) {
      try {
        const response = await fetch(`${API_BASE}/api/tokens/${provider}`);
        if (response.ok) {
          newTokens[provider] = await response.json();
        } else {
          newTokens[provider] = null;
        }
      } catch {
        newTokens[provider] = null;
      }
    }
    
    setTokens(newTokens);
  }, []);

  const handleServiceClick = (provider: 'github' | 'supabase' | 'vercel') => {
    setSelectedProvider(provider);
    setServiceModalOpen(true);
  };

  const handleServiceModalClose = () => {
    setServiceModalOpen(false);
    setSelectedProvider(null);
    loadAllTokens(); // Reload tokens after modal closes
  };

  const loadGlobalSettings = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/settings/global`);
      if (response.ok) {
        const settings = await response.json();
        if (settings?.cli_settings) {
          for (const [cli, config] of Object.entries(settings.cli_settings)) {
            if (config && typeof config === 'object' && 'model' in config) {
              (config as any).model = normalizeModelId(cli, (config as any).model as string);
            }
          }
        }
        setGlobalSettings(settings);
      }
    } catch (error) {
      console.error('Failed to load global settings:', error);
    }
  }, [setGlobalSettings]);

  const checkCLIStatus = useCallback(async () => {
    const checkingStatus: CLIStatus = CLI_OPTIONS.reduce((acc, cli) => {
      acc[cli.id] = { installed: true, checking: true };
      return acc;
    }, {} as CLIStatus);
    setCLIStatus(checkingStatus);

    try {
      const status = await fetchCliStatusSnapshot();
      setCLIStatus(status);
    } catch (error) {
      console.error('Error checking CLI status:', error);
      setCLIStatus(createCliStatusFallback());
    }
  }, []);

  // Load all service tokens and CLI data
  useEffect(() => {
    if (isOpen) {
      loadAllTokens();
      loadGlobalSettings();
      checkCLIStatus();
    }
  }, [isOpen, loadAllTokens, loadGlobalSettings, checkCLIStatus]);

  const saveGlobalSettings = async () => {
    setIsLoading(true);
    setSaveMessage(null);
    
    try {
      const payload = JSON.parse(JSON.stringify(globalSettings));
      if (payload?.cli_settings) {
        for (const [cli, config] of Object.entries(payload.cli_settings)) {
          if (config && typeof config === 'object' && 'model' in config) {
            (config as any).model = normalizeModelId(cli, (config as any).model as string);
          }
        }
      }

      const response = await fetch(`${API_BASE}/api/settings/global`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save settings');
      }
      
      setSaveMessage({ 
        type: 'success', 
        text: 'Settings saved successfully!' 
      });
      // make sure context stays in sync
      try {
        await refreshGlobalSettings();
      } catch {}
      
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
      
    } catch (error) {
      console.error('Failed to save global settings:', error);
      setSaveMessage({ 
        type: 'error', 
        text: 'Failed to save settings. Please try again.' 
      });
      
      // Clear error message after 5 seconds
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };


  const setDefaultCLI = (cliId: string) => {
    const cliInstalled = cliStatus[cliId]?.installed;
    if (!cliInstalled) return;
    
    setGlobalSettings(prev => ({
      ...prev,
      default_cli: cliId
    }));
  };

  const setDefaultModel = (cliId: string, modelId: string) => {
    const trimmed = modelId.trim();
    setGlobalSettings(prev => {
      const nextCliSettings = { ...(prev?.cli_settings ?? {}) };
      const existing = { ...(nextCliSettings[cliId] ?? {}) };

      if (trimmed.length > 0) {
        existing.model = normalizeModelId(cliId, trimmed);
        nextCliSettings[cliId] = existing;
      } else {
        delete existing.model;
        if (Object.keys(existing).length > 0) {
          nextCliSettings[cliId] = existing;
        } else {
          delete nextCliSettings[cliId];
        }
      }

      return {
        ...prev,
        cli_settings: nextCliSettings,
      };
    });
  };

  const setCliApiKey = (cliId: string, apiKey: string) => {
    setGlobalSettings(prev => {
      const nextCliSettings = { ...(prev?.cli_settings ?? {}) };
      const existing = { ...(nextCliSettings[cliId] ?? {}) };
      const trimmed = apiKey.trim();

      if (trimmed.length > 0) {
        existing.apiKey = trimmed;
        nextCliSettings[cliId] = existing;
      } else {
        delete existing.apiKey;
        if (Object.keys(existing).length > 0) {
          nextCliSettings[cliId] = existing;
        } else {
          delete nextCliSettings[cliId];
        }
      }

      return {
        ...prev,
        cli_settings: nextCliSettings,
      };
    });
  };

  const toggleApiKeyVisibility = (cliId: string) => {
    setApiKeyVisibility(prev => ({
      ...prev,
      [cliId]: !prev[cliId],
    }));
  };

  const mcpCliOptions = useMemo(() => CLI_OPTIONS.filter(cli => isMcpSupported(cli.id)), []);

  const updateCliSettingsEntry = useCallback(
    (cliId: string, transformer: (entry: Record<string, unknown>) => Record<string, unknown>) => {
      setGlobalSettings(prev => {
        const nextCliSettings = { ...(prev?.cli_settings ?? {}) };
        const currentEntry = { ...(nextCliSettings[cliId] ?? {}) } as Record<string, unknown>;
        const transformed = transformer(currentEntry);
        nextCliSettings[cliId] = transformed;
        return {
          ...prev,
          cli_settings: nextCliSettings,
        };
      });
    },
    [setGlobalSettings],
  );

  const addMcpServer = useCallback(
    (cliId: string) => {
      updateCliSettingsEntry(cliId, (entry) => {
        const currentServers = Array.isArray((entry as { mcpServers?: MCPServerConfig[] }).mcpServers)
          ? ((entry as { mcpServers?: MCPServerConfig[] }).mcpServers ?? []).map(server => ({ ...server }))
          : [];
        const newServer: MCPServerConfig = {
          id: createMcpServerId(),
          transport: 'stdio',
          enabled: true,
          autoStart: true,
        };
        currentServers.push(newServer);
        return {
          ...entry,
          mcpServers: currentServers,
        };
      });
    },
    [updateCliSettingsEntry],
  );

  const updateMcpServer = useCallback(
    (cliId: string, serverId: string, updates: Partial<MCPServerConfig>) => {
      updateCliSettingsEntry(cliId, (entry) => {
        const rawServers = (entry as { mcpServers?: MCPServerConfig[] }).mcpServers;
        const servers = Array.isArray(rawServers)
          ? rawServers.map(server => ({ ...server }))
          : [];

        const normalizedUpdates: Partial<MCPServerConfig> = { ...updates };

        if ('id' in normalizedUpdates) {
          normalizedUpdates.id = sanitizeServerId(normalizedUpdates.id, serverId);
        }
        if ('args' in normalizedUpdates) {
          normalizedUpdates.args = sanitizeArgs(normalizedUpdates.args);
        }
        if ('env' in normalizedUpdates) {
          normalizedUpdates.env = sanitizeStringRecord(normalizedUpdates.env);
        }
        if ('headers' in normalizedUpdates) {
          normalizedUpdates.headers = sanitizeStringRecord(normalizedUpdates.headers);
        }
        if ('command' in normalizedUpdates) {
          normalizedUpdates.command =
            typeof normalizedUpdates.command === 'string'
              ? normalizedUpdates.command.trim() || undefined
              : undefined;
        }
        if ('url' in normalizedUpdates) {
          normalizedUpdates.url =
            typeof normalizedUpdates.url === 'string'
              ? normalizedUpdates.url.trim() || undefined
              : undefined;
        }

        const index = servers.findIndex(server => server.id === serverId);
        if (index === -1) {
          const created: MCPServerConfig = {
            id: sanitizeServerId(normalizedUpdates.id, serverId),
            transport: normalizedUpdates.transport ?? 'stdio',
            enabled: normalizedUpdates.enabled ?? true,
            autoStart: normalizedUpdates.autoStart ?? true,
            ...normalizedUpdates,
          };
          created.args = sanitizeArgs(created.args);
          created.env = sanitizeStringRecord(created.env);
          created.headers = sanitizeStringRecord(created.headers);
          if (!created.transport) {
            created.transport = 'stdio';
          }
          if (created.args && created.args.length === 0) {
            delete created.args;
          }
          if (created.env && Object.keys(created.env).length === 0) {
            delete created.env;
          }
          if (created.headers && Object.keys(created.headers).length === 0) {
            delete created.headers;
          }
          servers.push(created);
        } else {
          const baseline = servers[index];
          const merged: MCPServerConfig = {
            ...baseline,
            ...normalizedUpdates,
          };
          merged.id = sanitizeServerId(merged.id, baseline.id);
          merged.transport = merged.transport ?? 'stdio';
          merged.args = sanitizeArgs(merged.args);
          merged.env = sanitizeStringRecord(merged.env);
          merged.headers = sanitizeStringRecord(merged.headers);
          if (merged.args && merged.args.length === 0) {
            delete merged.args;
          }
          if (merged.env && Object.keys(merged.env).length === 0) {
            delete merged.env;
          }
          if (merged.headers && Object.keys(merged.headers).length === 0) {
            delete merged.headers;
          }
          if (merged.command) {
            merged.command = merged.command.trim();
            if (!merged.command) {
              delete merged.command;
            }
          }
          if (merged.url) {
            merged.url = merged.url.trim();
            if (!merged.url) {
              delete merged.url;
            }
          }
          if (typeof merged.enabled !== 'boolean') {
            merged.enabled = true;
          }
          if (typeof merged.autoStart !== 'boolean') {
            merged.autoStart = true;
          }
          servers[index] = merged;
        }

        return {
          ...entry,
          mcpServers: servers,
        };
      });
    },
    [updateCliSettingsEntry],
  );

  const removeMcpServer = useCallback(
    (cliId: string, serverId: string) => {
      updateCliSettingsEntry(cliId, (entry) => {
        const rawServers = (entry as { mcpServers?: MCPServerConfig[] }).mcpServers;
        const servers = Array.isArray(rawServers)
          ? rawServers.filter(server => server.id !== serverId)
          : [];
        return {
          ...entry,
          mcpServers: servers,
        };
      });
    },
    [updateCliSettingsEntry],
  );

  const duplicateMcpServer = useCallback(
    (cliId: string, server: MCPServerConfig) => {
      const cloned: MCPServerConfig = JSON.parse(JSON.stringify(server)) as MCPServerConfig;
      cloned.id = sanitizeServerId(`${server.id}-copy`);
      cloned.label = server.label ? `${server.label} Copy` : server.label;
      cloned.enabled = server.enabled ?? true;
      cloned.autoStart = server.autoStart ?? true;
      cloned.args = sanitizeArgs(cloned.args);
      cloned.env = sanitizeStringRecord(cloned.env);
      cloned.headers = sanitizeStringRecord(cloned.headers);

      updateCliSettingsEntry(cliId, (entry) => {
        const rawServers = (entry as { mcpServers?: MCPServerConfig[] }).mcpServers;
        const servers = Array.isArray(rawServers)
          ? rawServers.map(existing => ({ ...existing }))
          : [];
        const existingIds = new Set(servers.map(existing => existing.id));
        let candidateId = cloned.id;
        while (existingIds.has(candidateId)) {
          candidateId = sanitizeServerId(`${candidateId}-copy`);
        }
        cloned.id = candidateId;
        servers.push(cloned);
        return {
          ...entry,
          mcpServers: servers,
        };
      });
    },
    [updateCliSettingsEntry],
  );

  const handleTransportChange = useCallback(
    (cliId: string, server: MCPServerConfig, transport: MCPServerConfig['transport']) => {
      const updates: Partial<MCPServerConfig> = { transport };
      if (transport === 'stdio') {
        updates.url = undefined;
      } else {
        updates.command = undefined;
        updates.args = undefined;
        updates.cwd = undefined;
      }
      updateMcpServer(cliId, server.id, updates);
    },
    [updateMcpServer],
  );

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'github':
        return (
          <svg width="20" height="20" viewBox="0 0 98 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" fill="currentColor"/>
          </svg>
        );
      case 'supabase':
        return (
          <svg width="20" height="20" viewBox="0 0 109 113" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint0_linear)"/>
            <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" fill="#3ECF8E"/>
            <defs>
              <linearGradient id="paint0_linear" x1="53.9738" y1="54.974" x2="94.1635" y2="71.8295" gradientUnits="userSpaceOnUse">
                <stop stopColor="#249361"/>
                <stop offset="1" stopColor="#3ECF8E"/>
              </linearGradient>
            </defs>
          </svg>
        );
      case 'vercel':
        return (
          <svg width="20" height="20" viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="currentColor"/>
          </svg>
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
          onClick={onClose}
        />
        
        <MotionDiv 
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[700px] border border-gray-200 flex flex-col"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Header */}
          <div className="p-5 border-b border-gray-200 ">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-gray-600 ">
                  <FaCog size={20} />
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 ">Global Settings</h2>
                  <p className="text-sm text-gray-600 ">Configure your Claudable preferences</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-600 hover:text-gray-900 transition-colors p-1 hover:bg-gray-100 rounded-lg"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 ">
            <nav className="flex px-5">
              {[
                { id: 'general' as const, label: 'General' },
                { id: 'ai-agents' as const, label: 'AI Agents' },
                { id: 'mcp' as const, label: 'MCP' },
                { id: 'services' as const, label: 'Services' },
                { id: 'about' as const, label: 'About' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                    activeTab === tab.id
                      ? 'border-[#DE7356] text-gray-900 '
                      : 'border-transparent text-gray-600 hover:text-gray-700 hover:border-gray-300 '
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="flex-1 p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Preferences</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">Auto-save projects</p>
                        <p className="text-sm text-gray-600">Automatically save changes to projects</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-white rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#DE7356]"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900 ">Show file extensions</p>
                        <p className="text-sm text-gray-600 ">Display file extensions in code explorer</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-white rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#DE7356]"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ai-agents' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-1">CLI Agents</h3>
                      <p className="text-sm text-gray-600 ">
                        Manage your AI coding assistants
                      </p>
                    </div>
                    {/* Inline Default CLI Selector */}
                    <div className="flex items-center gap-2 ml-6 pl-6 border-l border-gray-200 ">
                      <span className="text-sm text-gray-600 ">Default:</span>
                      <select
                        value={globalSettings.default_cli}
                        onChange={(e) => setDefaultCLI(e.target.value)}
                        className="pl-3 pr-8 py-1.5 text-xs font-medium border border-gray-200/50 rounded-full bg-transparent hover:bg-gray-50 hover:border-gray-300/50 text-gray-700 focus:outline-none focus:ring-0 transition-colors cursor-pointer"
                      >
                        {CLI_OPTIONS.filter(cli => cliStatus[cli.id]?.installed && cli.enabled !== false).map(cli => (
                          <option key={cli.id} value={cli.id}>
                            {cli.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {saveMessage && (
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm ${
                        saveMessage.type === 'success' 
                          ? 'bg-green-100 text-green-700 '
                          : 'bg-red-100 text-red-700 '
                      }`}>
                        {saveMessage.type === 'success' ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        {saveMessage.text}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={checkCLIStatus}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-200/50 rounded-full bg-transparent hover:bg-gray-50 hover:border-gray-300/50 text-gray-700 transition-colors"
                      >
                        Refresh Status
                      </button>
                      <button
                        onClick={saveGlobalSettings}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs font-medium bg-gray-900 hover:bg-gray-800 text-white rounded-full transition-colors disabled:opacity-50"
                      >
                        {isLoading ? 'Saving...' : 'Save Settings'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* CLI Agents Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {CLI_OPTIONS.filter(cli => cli.enabled !== false).map((cli) => {
                    const status = cliStatus[cli.id];
                    const settings = globalSettings.cli_settings[cli.id] || {};
                    const isChecking = status?.checking || false;
                    const isInstalled = status?.installed || false;
                    const isDefault = globalSettings.default_cli === cli.id;

                    return (
                      <div 
                        key={cli.id} 
                        onClick={() => isInstalled && setDefaultCLI(cli.id)}
                        className={`border rounded-xl pl-4 pr-8 py-4 transition-all ${
                          !isInstalled 
                            ? 'border-gray-200/50 cursor-not-allowed bg-gray-50/50 ' 
                            : isDefault 
                              ? 'cursor-pointer' 
                              : 'border-gray-200/50 hover:border-gray-300/50 hover:bg-gray-50 cursor-pointer'
                        }`}
                        style={isDefault && isInstalled ? {
                          borderColor: cli.brandColor,
                          backgroundColor: `${cli.brandColor}08`
                        } : {}}
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className={`flex-shrink-0 ${!isInstalled ? 'opacity-40' : ''}`}>
                            {cli.id === 'claude' && (
                              <Image src="/claude.png" alt="Claude" width={32} height={32} className="w-8 h-8" />
                            )}
                            {cli.id === 'cursor' && (
                              <Image src="/cursor.png" alt="Cursor" width={32} height={32} className="w-8 h-8" />
                            )}
                            {cli.id === 'codex' && (
                              <Image src="/oai.png" alt="Codex" width={32} height={32} className="w-8 h-8" />
                            )}
                            {cli.id === 'qwen' && (
                              <Image src="/qwen.png" alt="Qwen" width={32} height={32} className="w-8 h-8" />
                            )}
                            {cli.id === 'glm' && (
                              <Image src="/glm.svg" alt="GLM" width={32} height={32} className="w-8 h-8" />
                            )}
                            {cli.id === 'gemini' && (
                              <Image src="/gemini.png" alt="Gemini" width={32} height={32} className="w-8 h-8" />
                            )}
                            {cli.id === 'opencode' && (
                              <Image src="/opencode.svg" alt="OpenCode" width={32} height={32} className="w-8 h-8" />
                            )}
                          </div>
                          <div className={`flex-1 min-w-0 ${!isInstalled ? 'opacity-40' : ''}`}>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-gray-900 text-sm">{cli.name}</h4>
                              {isDefault && isInstalled && (
                                <span className="text-xs font-medium" style={{ color: cli.brandColor }}>
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                              {cli.description}
                            </p>
                          </div>
                        </div>

                        {/* Model Selection or Not Installed */}
                        {isInstalled ? (
                          <div onClick={(e) => e.stopPropagation()} className="space-y-3">
                            {cli.models.length > 0 ? (
                              <select
                                value={settings.model || ''}
                                onChange={(e) => setDefaultModel(cli.id, e.target.value)}
                                className="w-full px-3 py-1.5 border border-gray-200/50 rounded-full bg-transparent hover:bg-gray-50 text-gray-700 text-xs font-medium transition-colors focus:outline-none focus:ring-0"
                              >
                                <option value="">Select model</option>
                                {cli.models.map(model => (
                                  <option key={model.id} value={model.id}>
                                    {model.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="p-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-600 leading-snug">
                                Manage OpenCode providers and models in each project&rsquo;s <code className="font-mono">.opencode/opencode.jsonc</code> file. Leave empty to let OpenCode auto-detect.
                              </div>
                            )}

                            {cli.id === 'glm' && (
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-600 ">
                                  API Key
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type={apiKeyVisibility[cli.id] ? 'text' : 'password'}
                                    value={settings.apiKey ?? ''}
                                    onChange={(e) => setCliApiKey(cli.id, e.target.value)}
                                    placeholder="Enter GLM API key"
                                    className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
                                  />
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      toggleApiKeyVisibility(cli.id);
                                    }}
                                    className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg bg-white transition-colors"
                                  >
                                    {apiKeyVisibility[cli.id] ? 'Hide' : 'Show'}
                                  </button>
                                </div>
                                <p className="text-[11px] text-gray-500 leading-snug">
                                  Stored locally and injected as <code className="font-mono">ZHIPU_API_KEY</code> (and aliases) when running GLM.
                                  Leave blank to rely on server environment variables instead.
                                </p>
                              </div>
                            )}
                            {cli.id === 'cursor' && (
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-600 ">
                                  API Key (optional)
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type={apiKeyVisibility[cli.id] ? 'text' : 'password'}
                                    value={settings.apiKey ?? ''}
                                    onChange={(e) => setCliApiKey(cli.id, e.target.value)}
                                    placeholder="Enter Cursor API key"
                                    className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
                                  />
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      toggleApiKeyVisibility(cli.id);
                                    }}
                                    className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg bg-white transition-colors"
                                  >
                                    {apiKeyVisibility[cli.id] ? 'Hide' : 'Show'}
                                  </button>
                                </div>
                                <p className="text-[11px] text-gray-500 leading-snug">
                                  Injected as <code className="font-mono">CURSOR_API_KEY</code> and passed to <code className="font-mono">cursor-agent</code>.
                                  Leave blank to rely on the logged-in Cursor CLI session.
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setSelectedCLI(cli);
                                setInstallModalOpen(true);
                              }}
                              className="w-full px-3 py-1.5 border-2 border-gray-900 rounded-full bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold transition-all transform hover:scale-105"
                            >
                              View Guide
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                </div>
              </div>
            )}

            {activeTab === 'mcp' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Model Context Protocol</h3>
                    <p className="text-sm text-gray-600">
                      Configure MCP servers for supported CLI agents. These definitions apply to every project.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {saveMessage && (
                      <div
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm ${
                          saveMessage.type === 'success'
                            ? 'bg-green-100 text-green-700 '
                            : 'bg-red-100 text-red-700 '
                        }`}
                      >
                        {saveMessage.type === 'success' ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        {saveMessage.text}
                      </div>
                    )}
                    <button
                      onClick={saveGlobalSettings}
                      disabled={isLoading}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-gray-900 hover:bg-gray-800 text-white rounded-full transition-colors disabled:opacity-50"
                    >
                      {isLoading ? 'Saving…' : 'Save Settings'}
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {mcpCliOptions.map(cli => {
                    const cliSettings = globalSettings.cli_settings[cli.id] || {};
                    const servers = Array.isArray((cliSettings as { mcpServers?: MCPServerConfig[] }).mcpServers)
                      ? ((cliSettings as { mcpServers?: MCPServerConfig[] }).mcpServers as MCPServerConfig[])
                      : [];
                    const brandColor = cli.brandColor ?? '#DE7356';
                    return (
                      <div key={cli.id} className="border border-gray-200 rounded-2xl bg-white shadow-sm">
                        <div className="p-5 border-b border-gray-200 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              {cli.id === 'claude' && (
                                <Image src="/claude.png" alt="Claude" width={32} height={32} className="w-8 h-8" />
                              )}
                              {cli.id === 'codex' && (
                                <Image src="/oai.png" alt="Codex" width={32} height={32} className="w-8 h-8" />
                              )}
                              {cli.id === 'cursor' && (
                                <Image src="/cursor.png" alt="Cursor" width={32} height={32} className="w-8 h-8" />
                              )}
                              {cli.id === 'qwen' && (
                                <Image src="/qwen.png" alt="Qwen" width={32} height={32} className="w-8 h-8" />
                              )}
                              {cli.id === 'glm' && (
                                <Image src="/glm.svg" alt="GLM" width={32} height={32} className="w-8 h-8" />
                              )}
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                {cli.name}
                                <span
                                  className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: `${brandColor}1A`, color: brandColor }}
                                >
                                  MCP
                                </span>
                              </h4>
                              <p className="text-xs text-gray-600">
                                {servers.length === 0
                                  ? 'No MCP servers configured.'
                                  : `${servers.length} MCP server${servers.length > 1 ? 's' : ''} configured.`}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => addMcpServer(cli.id)}
                            className="self-start inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 transition-colors"
                          >
                            <span className="text-lg leading-none">+</span>
                            Add MCP Server
                          </button>
                        </div>

                        <div className="p-5 space-y-4">
                          {servers.length === 0 ? (
                            <div className="border border-dashed border-gray-300 bg-gray-50 rounded-xl p-4 text-sm text-gray-600 leading-snug">
                              Define MCP servers to expose additional tools to {cli.name}. For stdio transports, Claudable
                              spawns the process before each session and streams tool output automatically.
                            </div>
                          ) : (
                            servers.map((server, index) => {
                              const transport = server.transport ?? 'stdio';
                              const isStdio = transport === 'stdio';
                              const argsPreview = server.args && server.args.length > 0 ? server.args.join(' ') : '';
                              const summary = isStdio
                                ? server.command
                                  ? `${server.command}${argsPreview ? ` ${argsPreview}` : ''}`
                                  : 'stdio transport'
                                : `${transport.toUpperCase()} ${server.url ?? ''}`.trim();
                              const envText = serializeKeyValuePairs(server.env);
                              const headersText = serializeKeyValuePairs(server.headers);
                              return (
                                <div key={server.id} className="border border-gray-200 rounded-xl bg-white/70 p-4 space-y-4">
                                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div>
                                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                        Server {index + 1}
                                      </div>
                                      <div className="text-sm font-semibold text-gray-900">
                                        {server.label && server.label.trim().length > 0 ? server.label : server.id}
                                      </div>
                                      <div className="text-xs text-gray-600 break-all">
                                        {summary || 'No command configured yet.'}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => duplicateMcpServer(cli.id, server)}
                                        className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
                                      >
                                        Duplicate
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeMcpServer(cli.id, server.id)}
                                        className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg bg-white hover:bg-red-50 transition-colors"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>

                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-medium text-gray-600">Display Name</label>
                                      <input
                                        value={server.label ?? ''}
                                        onChange={(e) => updateMcpServer(cli.id, server.id, { label: e.target.value })}
                                        placeholder="Optional label shown in the UI"
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-medium text-gray-600">Identifier</label>
                                      <input
                                        value={server.id}
                                        onChange={(e) => updateMcpServer(cli.id, server.id, { id: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-medium text-gray-600">Transport</label>
                                      <select
                                        value={transport}
                                        onChange={(e) =>
                                          handleTransportChange(cli.id, server, e.target.value as MCPServerConfig['transport'])
                                        }
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
                                      >
                                        <option value="stdio">stdio (spawn process)</option>
                                        <option value="sse">Server-Sent Events (remote)</option>
                                        <option value="websocket">WebSocket (remote)</option>
                                      </select>
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-medium text-gray-600">Notes</label>
                                      <input
                                        value={server.description ?? ''}
                                        onChange={(e) => updateMcpServer(cli.id, server.id, { description: e.target.value })}
                                        placeholder="Optional description"
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
                                      />
                                    </div>
                                  </div>

                                  {isStdio ? (
                                    <div className="grid gap-3 md:grid-cols-2">
                                      <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-600">Command</label>
                                        <input
                                          value={server.command ?? ''}
                                          onChange={(e) => updateMcpServer(cli.id, server.id, { command: e.target.value })}
                                          placeholder="e.g. npx -y my-mcp-server"
                                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-600">Arguments (one per line)</label>
                                        <textarea
                                          value={(server.args ?? []).join('\n')}
                                          onChange={(e) =>
                                            updateMcpServer(cli.id, server.id, {
                                              args: sanitizeArgs(e.target.value),
                                            })
                                          }
                                          rows={3}
                                          placeholder="--flag\n--option=value"
                                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
                                        />
                                      </div>
                                      <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-xs font-medium text-gray-600">Working Directory</label>
                                        <input
                                          value={server.cwd ?? ''}
                                          onChange={(e) => updateMcpServer(cli.id, server.id, { cwd: e.target.value })}
                                          placeholder="Optional path"
                                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="grid gap-3 md:grid-cols-2">
                                      <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-xs font-medium text-gray-600">Endpoint URL</label>
                                        <input
                                          value={server.url ?? ''}
                                          onChange={(e) => updateMcpServer(cli.id, server.id, { url: e.target.value })}
                                          placeholder="https://example.com/mcp"
                                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
                                        />
                                      </div>
                                      <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-xs font-medium text-gray-600">
                                          Headers (KEY=VALUE per line)
                                        </label>
                                        <textarea
                                          value={headersText}
                                          onChange={(e) =>
                                            updateMcpServer(cli.id, server.id, {
                                              headers: parseKeyValueTextarea(e.target.value),
                                            })
                                          }
                                          rows={3}
                                          placeholder="Authorization=Bearer ..."
                                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-1.5 md:col-span-2">
                                      <label className="text-xs font-medium text-gray-600">
                                        Environment Variables (KEY=VALUE per line)
                                      </label>
                                      <textarea
                                        value={envText}
                                        onChange={(e) =>
                                          updateMcpServer(cli.id, server.id, {
                                            env: parseKeyValueTextarea(e.target.value),
                                          })
                                        }
                                        rows={3}
                                        placeholder="PATH=/usr/local/bin"
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
                                      />
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                                        <input
                                          type="checkbox"
                                          checked={server.autoStart ?? true}
                                          onChange={(e) =>
                                            updateMcpServer(cli.id, server.id, { autoStart: e.target.checked })
                                          }
                                          className="w-4 h-4 text-[#DE7356] border-gray-300 rounded focus:ring-[#DE7356]"
                                        />
                                        Auto-start before each run
                                      </label>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                                        <input
                                          type="checkbox"
                                          checked={server.enabled ?? true}
                                          onChange={(e) =>
                                            updateMcpServer(cli.id, server.id, { enabled: e.target.checked })
                                          }
                                          className="w-4 h-4 text-[#DE7356] border-gray-300 rounded focus:ring-[#DE7356]"
                                        />
                                        Enabled
                                      </label>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'services' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Service Tokens</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Configure your API tokens for external services. These tokens are stored encrypted and used across all projects.
                  </p>
                  
                  <div className="space-y-4">
                    {Object.entries(tokens).map(([provider, token]) => (
                      <div key={provider} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 ">
                        <div className="flex items-center gap-3">
                          <div className="text-gray-700 ">
                            {getProviderIcon(provider)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 capitalize">{provider}</p>
                            <p className="text-sm text-gray-600 ">
                              {token ? (
                                <>
                                  Token configured • Added {new Date(token.created_at).toLocaleDateString()}
                                </>
                              ) : (
                                'Token not configured'
                              )}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {token && (
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                          )}
                          <button
                            onClick={() => handleServiceClick(provider as 'github' | 'supabase' | 'vercel')}
                            className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all"
                          >
                            {token ? 'Update Token' : 'Add Token'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200 ">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-[#DE7356]" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-gray-900 ">
                          Token Configuration
                        </h3>
                        <div className="mt-2 text-sm text-gray-700 ">
                          <p>
                            Tokens configured here will be available for all projects. To connect a project to specific repositories 
                            and services, use the Project Settings in each individual project.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#DE7356]/20 to-[#DE7356]/5 blur-xl rounded-2xl" />
                    <Image
                      src="/Claudable_Icon.png"
                      alt="Claudable Icon"
                      width={80}
                      height={80}
                      className="relative z-10 w-full h-full object-contain rounded-2xl shadow-lg"
                    />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 ">Claudable</h3>
                  <p className="text-gray-600 mt-2 font-medium">Version 1.0.0</p>
                </div>
                
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 space-y-4">
                  <div className="text-center">
                    <p className="text-base text-gray-700 leading-relaxed max-w-2xl mx-auto">
                      Claudable is an AI-powered development platform that integrates with GitHub, Supabase, and Vercel 
                      to streamline your web development workflow.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-3 rounded-xl border border-gray-200/50 bg-transparent">
                      <div className="flex items-center justify-center mb-2">
                        <svg className="w-5 h-5 text-[#DE7356]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <p className="text-xs font-medium text-gray-700 ">Fast Deploy</p>
                    </div>
                    <div className="p-3 rounded-xl border border-gray-200/50 bg-transparent">
                      <div className="flex items-center justify-center mb-2">
                        <svg className="w-5 h-5 text-[#DE7356]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <p className="text-xs font-medium text-gray-700 ">AI Powered</p>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <div className="flex justify-center gap-6">
                    <a 
                      href="https://github.com/opactorai/Claudable" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#DE7356] hover:text-[#c95940] transition-colors"
                    >
                      GitHub
                    </a>
                    <a 
                      href="https://discord.gg/NJNbafHNQC" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#DE7356] hover:text-[#c95940] transition-colors"
                    >
                      Discord
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </MotionDiv>
      </div>
      
      {/* Service Connection Modal */}
      {selectedProvider && (
        <ServiceConnectionModal
          isOpen={serviceModalOpen}
          onClose={handleServiceModalClose}
          provider={selectedProvider}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-[80] px-4 py-3 rounded-lg shadow-2xl transition-all transform animate-slide-in-up ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' && (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Install Guide Modal */}
      {installModalOpen && selectedCLI && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" key={`modal-${selectedCLI.id}`}>
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={() => {
              setInstallModalOpen(false);
              setSelectedCLI(null);
            }}
          />
          
          <div 
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 transform"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-gray-200 ">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedCLI.id === 'claude' && (
                    <Image src="/claude.png" alt="Claude" width={32} height={32} className="w-8 h-8" />
                  )}
                  {selectedCLI.id === 'cursor' && (
                    <Image src="/cursor.png" alt="Cursor" width={32} height={32} className="w-8 h-8" />
                  )}
                  {selectedCLI.id === 'codex' && (
                    <Image src="/oai.png" alt="Codex" width={32} height={32} className="w-8 h-8" />
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 ">
                      Install {selectedCLI.name}
                    </h3>
                    <p className="text-sm text-gray-600 ">
                      Follow these steps to get started
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setInstallModalOpen(false);
                    setSelectedCLI(null);
                  }}
                  className="text-gray-600 hover:text-gray-900 transition-colors p-1 hover:bg-gray-100 rounded-lg"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Step 1: Install */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900 ">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full text-white text-xs" style={{ backgroundColor: selectedCLI.brandColor }}>
                    1
                  </span>
                  Install CLI
                </div>
                <div className="ml-8 flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                  <code className="text-sm text-gray-800 flex-1">
                    {selectedCLI.installCommand}
                  </code>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigator.clipboard.writeText(selectedCLI.installCommand);
                      showToast('Command copied to clipboard', 'success');
                    }}
                    className="text-gray-500 hover:text-gray-700 "
                    title="Copy command"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 3h10a2 2 0 012 2v10M9 3H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-2M9 3v2a2 2 0 002 2h6a2 2 0 002-2V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Step 2: Authenticate */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900 ">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full text-white text-xs" style={{ backgroundColor: selectedCLI.brandColor }}>
                    2
                  </span>
                  {selectedCLI.id === 'gemini' && 'Authenticate (OAuth or API Key)'}
                  {selectedCLI.id === 'glm' && 'Authenticate (Z.ai DevPack login)'}
                  {selectedCLI.id === 'qwen' && 'Authenticate (Qwen OAuth or API Key)'}
                  {selectedCLI.id === 'codex' && 'Start Codex and sign in'}
                  {selectedCLI.id === 'claude' && 'Start Claude and sign in'}
                  {selectedCLI.id === 'cursor' && 'Start Cursor CLI and sign in'}
                  {selectedCLI.id === 'opencode' && 'Run OpenCode once (optional)'}
                </div>
                <div className="ml-8 flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                  <code className="text-sm text-gray-800 flex-1">
                    {selectedCLI.id === 'claude' ? 'claude' :
                     selectedCLI.id === 'cursor' ? 'cursor-agent' :
                     selectedCLI.id === 'codex' ? 'codex' :
                     selectedCLI.id === 'qwen' ? 'qwen' :
                     selectedCLI.id === 'glm' ? 'zai' :
                     selectedCLI.id === 'gemini' ? 'gemini' :
                     selectedCLI.id === 'opencode' ? 'opencode' : ''}
                  </code>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const authCmd = selectedCLI.id === 'claude' ? 'claude' :
                                      selectedCLI.id === 'cursor' ? 'cursor-agent' :
                                      selectedCLI.id === 'codex' ? 'codex' :
                                      selectedCLI.id === 'qwen' ? 'qwen' :
                                      selectedCLI.id === 'glm' ? 'zai' :
                                      selectedCLI.id === 'gemini' ? 'gemini' :
                                      selectedCLI.id === 'opencode' ? 'opencode' : '';
                      if (authCmd) navigator.clipboard.writeText(authCmd);
                      showToast('Command copied to clipboard', 'success');
                    }}
                    className="text-gray-500 hover:text-gray-700 "
                    title="Copy command"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 3h10a2 2 0 012 2v10M9 3H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-2M9 3v2a2 2 0 002 2h6a2 2 0 002-2V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Step 3: Test */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900 ">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full text-white text-xs" style={{ backgroundColor: selectedCLI.brandColor }}>
                    3
                  </span>
                  Test your installation
                </div>
                <div className="ml-8 flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                  <code className="text-sm text-gray-800 flex-1">
                    {selectedCLI.id === 'claude' ? 'claude --version' :
                     selectedCLI.id === 'cursor' ? 'cursor-agent --version' :
                     selectedCLI.id === 'codex' ? 'codex --version' :
                     selectedCLI.id === 'qwen' ? 'qwen --version' :
                     selectedCLI.id === 'glm' ? 'zai --version' :
                     selectedCLI.id === 'gemini' ? 'gemini --version' :
                     selectedCLI.id === 'opencode' ? 'opencode --version' : ''}
                  </code>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const versionCmd = selectedCLI.id === 'claude' ? 'claude --version' :
                                        selectedCLI.id === 'cursor' ? 'cursor-agent --version' :
                                        selectedCLI.id === 'codex' ? 'codex --version' :
                                        selectedCLI.id === 'qwen' ? 'qwen --version' :
                                        selectedCLI.id === 'glm' ? 'zai --version' :
                                        selectedCLI.id === 'gemini' ? 'gemini --version' :
                                        selectedCLI.id === 'opencode' ? 'opencode --version' : '';
                      if (versionCmd) navigator.clipboard.writeText(versionCmd);
                      showToast('Command copied to clipboard', 'success');
                    }}
                    className="text-gray-500 hover:text-gray-700 "
                    title="Copy command"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 3h10a2 2 0 012 2v10M9 3H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-2M9 3v2a2 2 0 002 2h6a2 2 0 002-2V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Minimal guide only; removed extra info */}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-gray-200 flex justify-between">
              <button
                onClick={() => checkCLIStatus()}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Refresh Status
              </button>
              <button
                onClick={() => {
                  setInstallModalOpen(false);
                  setSelectedCLI(null);
                }}
                className="px-4 py-2 text-sm bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
