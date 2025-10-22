import { CLAUDE_DEFAULT_MODEL, CLAUDE_MODEL_DEFINITIONS, getClaudeModelDisplayName, normalizeClaudeModelId } from './claudeModels';
import { CODEX_DEFAULT_MODEL, CODEX_MODEL_DEFINITIONS, getCodexModelDisplayName, normalizeCodexModelId } from './codexModels';
import type { CLAUDE_MODEL_DEFINITIONS as _Guard } from './claudeModels'; // Ensure module side effects preserved

type CLIKey = 'claude' | 'codex' | 'cursor' | 'gemini' | 'qwen';

type ModelDefinition = {
  id: string;
  name: string;
  description?: string;
  supportsImages?: boolean;
};

const DEFAULT_MODELS: Record<CLIKey, string> = {
  claude: CLAUDE_DEFAULT_MODEL,
  codex: CODEX_DEFAULT_MODEL,
  cursor: 'gpt-5',
  gemini: 'gemini-2.5-pro',
  qwen: 'qwen3-coder-plus',
};

const MODEL_DEFINITIONS: Record<CLIKey, ModelDefinition[]> = {
  claude: CLAUDE_MODEL_DEFINITIONS,
  codex: CODEX_MODEL_DEFINITIONS,
  cursor: [
    { id: 'gpt-5', name: 'GPT-5' },
    { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5' },
    { id: 'claude-opus-4.1', name: 'Claude Opus 4.1' },
    { id: 'gpt-4', name: 'GPT-4' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  ],
  gemini: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  ],
  qwen: [
    { id: 'qwen3-coder-plus', name: 'Qwen3 Coder Plus' },
  ],
};

export function getDefaultModelForCli(cli: string | null | undefined): string {
  if (!cli) {
    return CLAUDE_DEFAULT_MODEL;
  }
  const normalized = cli.toLowerCase() as CLIKey;
  return DEFAULT_MODELS[normalized] ?? CLAUDE_DEFAULT_MODEL;
}

export function normalizeModelId(cli: string | null | undefined, model?: string | null): string {
  if (!cli) {
    return normalizeClaudeModelId(model);
  }
  switch (cli.toLowerCase()) {
    case 'codex':
      return normalizeCodexModelId(model);
    case 'claude':
    default:
      return normalizeClaudeModelId(model);
  }
}

export function getModelDisplayName(cli: string | null | undefined, modelId?: string | null): string {
  if (!cli) {
    return getClaudeModelDisplayName(normalizeClaudeModelId(modelId));
  }

  switch (cli.toLowerCase()) {
    case 'codex':
      return getCodexModelDisplayName(modelId);
    case 'claude':
    default:
      return getClaudeModelDisplayName(normalizeClaudeModelId(modelId));
  }
}

export function getModelDefinitionsForCli(cli: string | null | undefined): ModelDefinition[] {
  if (!cli) {
    return MODEL_DEFINITIONS.claude;
  }
  const normalized = cli.toLowerCase() as CLIKey;
  return MODEL_DEFINITIONS[normalized] ?? MODEL_DEFINITIONS.claude;
}
