/**
 * CLI Type Definitions
 */

export interface CLIOption {
  id: string;
  name: string;
  description: string;
  icon?: string;
  available: boolean;
  configured: boolean;
  models?: CLIModel[];
  enabled?: boolean;
}

export interface CLIModel {
  id: string;
  name: string;
  description?: string;
}

export interface CLIStatus {
  cli_type: string;
  available: boolean;
  configured: boolean;
  error?: string;
  models?: string[];
}

export interface CLIPreference {
  preferred_cli: string;
  fallback_enabled: boolean;
  selected_model?: string;
}

export const CLI_OPTIONS: CLIOption[] = [
  {
    id: 'claude',
    name: 'Claude',
    description: '',
    available: true,
    configured: false,
    enabled: true,
    models: [
      { id: 'claude-sonnet-4', name: 'Claude Sonnet 4' },
      { id: 'claude-opus-4.1', name: 'Claude Opus 4.1' },
      { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-opus', name: 'Claude 3 Opus' },
      { id: 'claude-3-haiku', name: 'Claude 3 Haiku' }
    ]
  },
  {
    id: 'cursor',
    name: 'Cursor',
    description: '',
    available: true,
    configured: false,
    enabled: true,
    models: [
      { id: 'gpt-5', name: 'GPT-5' },
      { id: 'claude-sonnet-4', name: 'Claude Sonnet 4' },
      { id: 'claude-opus-4.1', name: 'Claude Opus 4.1' },
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ]
  },
  {
    id: 'qwen',
    name: 'Qwen Coder',
    description: 'Alibaba Qwen Coder',
    icon: '/qwen.png',
    available: true,
    configured: false,
    enabled: true,
    models: [
      { id: 'qwen3-coder-plus', name: 'Qwen3 Coder Plus' }
    ]
  },
  {
    id: 'gemini',
    name: 'Gemini',
    description: 'Gemini CLI',
    icon: '/gemini.png',
    available: true,
    configured: false,
    enabled: true,
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }
    ]
  },
  {
    id: 'codex',
    name: 'Codex',
    description: 'Advanced AI coding assistant with autonomous development capabilities',
    icon: '/oai.png',
    available: true,
    configured: false,
    enabled: true,
    models: [
      { id: 'gpt-5', name: 'GPT-5' }
    ]
  }
];
