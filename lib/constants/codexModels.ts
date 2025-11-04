/**
 * Codex CLI model definitions and helpers
 */

export interface CodexModelDefinition {
  id: string;
  name: string;
  description?: string;
  supportsImages?: boolean;
}

export const CODEX_DEFAULT_MODEL = 'gpt-5';

export const CODEX_MODEL_DEFINITIONS: CodexModelDefinition[] = [
  {
    id: 'gpt-5',
    name: 'GPT-5',
    description: 'OpenAI flagship reasoning model',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'General-purpose model with multimodal support',
    supportsImages: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Cost-efficient GPT-4o variant',
    supportsImages: true,
  },
  {
    id: 'o1-preview',
    name: 'o1 Preview',
    description: 'OpenAI o1 preview model focused on agent use-cases',
  },
  {
    id: 'o1-mini',
    name: 'o1 Mini',
    description: 'Lightweight o1 model for faster iterations',
  },
  {
    id: 'claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet (via Codex)',
    description: 'Anthropic Claude via Codex router',
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku (via Codex)',
    description: 'Anthropic Haiku model routed through Codex',
  },
];

const ALIAS_MAP: Record<string, string> = {
  'gpt5': 'gpt-5',
  'gpt_5': 'gpt-5',
  'gpt-5.0': 'gpt-5',
  'gpt-4o-mini-high': 'gpt-4o-mini',
  'gpt-4o-mini-low': 'gpt-4o-mini',
  'claude-sonnet-3.5': 'claude-3.5-sonnet',
  'claude35-sonnet': 'claude-3.5-sonnet',
  'claude-3-haiku': 'claude-3-haiku',
};

const KNOWN_IDS = new Set(CODEX_MODEL_DEFINITIONS.map((model) => model.id));

export function normalizeCodexModelId(model?: string | null): string {
  if (!model || typeof model !== 'string') {
    return CODEX_DEFAULT_MODEL;
  }

  const trimmed = model.trim();
  if (!trimmed) {
    return CODEX_DEFAULT_MODEL;
  }

  const lower = trimmed.toLowerCase();
  if (ALIAS_MAP[lower]) {
    return ALIAS_MAP[lower];
  }

  if (KNOWN_IDS.has(lower)) {
    return lower;
  }

  // If the exact casing exists, allow it
  if (KNOWN_IDS.has(trimmed)) {
    return trimmed;
  }

  return CODEX_DEFAULT_MODEL;
}

export function getCodexModelDisplayName(id?: string | null): string {
  if (!id) {
    return CODEX_MODEL_DEFINITIONS.find((model) => model.id === CODEX_DEFAULT_MODEL)?.name ?? CODEX_DEFAULT_MODEL;
  }

  const normalized = normalizeCodexModelId(id);
  const match = CODEX_MODEL_DEFINITIONS.find((model) => model.id === normalized);
  return match?.name ?? normalized;
}
