import { CLAUDE_DEFAULT_MODEL, CLAUDE_MODEL_DEFINITIONS, getClaudeModelDisplayName, normalizeClaudeModelId } from './claudeModels';
import { CODEX_DEFAULT_MODEL, CODEX_MODEL_DEFINITIONS, getCodexModelDisplayName, normalizeCodexModelId } from './codexModels';
import { CURSOR_DEFAULT_MODEL, CURSOR_MODEL_DEFINITIONS, getCursorModelDisplayName, normalizeCursorModelId } from './cursorModels';
import { QWEN_DEFAULT_MODEL, QWEN_MODEL_DEFINITIONS, getQwenModelDisplayName, normalizeQwenModelId } from './qwenModels';
import { GLM_DEFAULT_MODEL, GLM_MODEL_DEFINITIONS, getGLMModelDisplayName, normalizeGLMModelId } from './glmModels';
import type { CLAUDE_MODEL_DEFINITIONS as _Guard } from './claudeModels'; // Ensure module side effects preserved

type CLIKey = 'claude' | 'codex' | 'cursor' | 'gemini' | 'qwen' | 'glm';

type ModelDefinition = {
  id: string;
  name: string;
  description?: string;
  supportsImages?: boolean;
};

const DEFAULT_MODELS: Record<CLIKey, string> = {
  claude: CLAUDE_DEFAULT_MODEL,
  codex: CODEX_DEFAULT_MODEL,
  cursor: CURSOR_DEFAULT_MODEL,
  gemini: 'gemini-2.5-pro',
  qwen: QWEN_DEFAULT_MODEL,
  glm: GLM_DEFAULT_MODEL,
};

const MODEL_DEFINITIONS: Record<CLIKey, ModelDefinition[]> = {
  claude: CLAUDE_MODEL_DEFINITIONS,
  codex: CODEX_MODEL_DEFINITIONS,
  cursor: CURSOR_MODEL_DEFINITIONS,
  gemini: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  ],
  qwen: QWEN_MODEL_DEFINITIONS,
  glm: GLM_MODEL_DEFINITIONS,
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
    case 'cursor':
      return normalizeCursorModelId(model);
    case 'qwen':
      return normalizeQwenModelId(model);
    case 'glm':
      return normalizeGLMModelId(model);
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
    case 'cursor':
      return getCursorModelDisplayName(modelId);
    case 'qwen':
      return getQwenModelDisplayName(modelId);
    case 'glm':
      return getGLMModelDisplayName(modelId);
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
