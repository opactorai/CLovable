/**
 * Cursor CLI model definitions and helpers. The Cursor Agent currently exposes a
 * small, well-defined set of models. We mirror the Python adapter from the
 * original Claudable repository to keep behaviour aligned across runtimes.
 */

export interface CursorModelDefinition {
  id: string;
  name: string;
  description?: string;
  supportsImages?: boolean;
}

export const CURSOR_DEFAULT_MODEL = 'gpt-5';

export const CURSOR_MODEL_DEFINITIONS: CursorModelDefinition[] = [
  {
    id: 'gpt-5',
    name: 'GPT-5',
    description: 'Cursor Agent default multi-model router (auto-selects best model)',
  },
  {
    id: 'sonnet-4',
    name: 'Claude Sonnet 4',
    description: 'Anthropic Claude Sonnet via Cursor Agent router',
  },
  {
    id: 'sonnet-4-thinking',
    name: 'Claude Sonnet 4 (Thinking)',
    description: 'High-depth Claude Sonnet reasoning mode',
  },
];

const CURSOR_MODEL_ALIASES: Record<string, string> = {
  'gpt5': 'gpt-5',
  'gpt-5.0': 'gpt-5',
  'sonnet4': 'sonnet-4',
  'sonnet-4.5': 'sonnet-4',
  'sonnet-45': 'sonnet-4',
  'claude-sonnet-4.5': 'sonnet-4',
  'claude-sonnet-45': 'sonnet-4',
  'claude-sonnet-4_5': 'sonnet-4',
  'claude-sonnet-4': 'sonnet-4',
  'sonnet-4.0-thinking': 'sonnet-4-thinking',
  'claude-sonnet-4-thinking': 'sonnet-4-thinking',
  'opus-4.1': 'sonnet-4',
  'claude-opus-4.1': 'sonnet-4',
  'claude-opus-41': 'sonnet-4',
  'claude-opus-4_1': 'sonnet-4',
};

const KNOWN_CURSOR_MODEL_IDS = new Set(CURSOR_MODEL_DEFINITIONS.map((model) => model.id));

const CURSOR_CLI_MODEL_IDS: Record<string, string> = {
  'gpt-5': 'gpt-5',
  'sonnet-4': 'sonnet-4',
  'sonnet-4-thinking': 'sonnet-4-thinking',
};

export function normalizeCursorModelId(model?: string | null): string {
  if (!model || typeof model !== 'string') {
    return CURSOR_DEFAULT_MODEL;
  }

  const trimmed = model.trim();
  if (!trimmed) {
    return CURSOR_DEFAULT_MODEL;
  }

  const lowered = trimmed.toLowerCase();
  if (CURSOR_MODEL_ALIASES[lowered]) {
    return CURSOR_MODEL_ALIASES[lowered];
  }

  if (KNOWN_CURSOR_MODEL_IDS.has(lowered)) {
    return lowered;
  }

  if (KNOWN_CURSOR_MODEL_IDS.has(trimmed)) {
    return trimmed;
  }

  return CURSOR_DEFAULT_MODEL;
}

export function getCursorModelDisplayName(id?: string | null): string {
  if (!id) {
    return (
      CURSOR_MODEL_DEFINITIONS.find((model) => model.id === CURSOR_DEFAULT_MODEL)?.name ??
      CURSOR_DEFAULT_MODEL
    );
  }

  const normalized = normalizeCursorModelId(id);
  const match = CURSOR_MODEL_DEFINITIONS.find((model) => model.id === normalized);
  return match?.name ?? normalized;
}

export function resolveCursorCliModelId(modelId?: string | null): string {
  const normalized = normalizeCursorModelId(modelId);
  return CURSOR_CLI_MODEL_IDS[normalized] ?? normalized;
}
