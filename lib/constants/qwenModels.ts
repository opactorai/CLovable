export type QwenModelId =
  | 'qwen3-coder-plus'
  | 'qwen3-coder-pro'
  | 'qwen3-coder';

export interface QwenModelDefinition {
  id: QwenModelId;
  /** User facing display name */
  name: string;
  /** Longer description shown in pickers */
  description?: string;
  /** Whether the model accepts image input */
  supportsImages?: boolean;
  /** Alias strings that should resolve to this model */
  aliases: string[];
}

export const QWEN_MODEL_DEFINITIONS: QwenModelDefinition[] = [
  {
    id: 'qwen3-coder-plus',
    name: 'Qwen3 Coder Plus',
    description: 'Balanced 32k context model optimised for coding tasks',
    aliases: [
      'qwen3-coder-plus',
      'qwen3-coder+',
      'qwen3-plus',
      'qwen3 coder plus',
      'qwen-coder-plus',
      'qwen-coder+',
      'qwen-plus',
      'qwen coder plus',
    ],
  },
  {
    id: 'qwen3-coder-pro',
    name: 'Qwen3 Coder Pro',
    description: 'Larger 128k context model with stronger reasoning',
    aliases: [
      'qwen3-coder-pro',
      'qwen3-pro',
      'qwen3 coder pro',
      'qwen-coder-pro',
      'qwen-pro',
      'qwen coder pro',
    ],
  },
  {
    id: 'qwen3-coder',
    name: 'Qwen3 Coder',
    description: 'Default quick model for fast iteration',
    aliases: [
      'qwen3-coder',
      'qwen3',
      'qwen coder',
      'qwen-coder',
      'qwen',
    ],
  },
];

export const QWEN_DEFAULT_MODEL: QwenModelId = 'qwen3-coder-plus';

const QWEN_MODEL_ALIAS_MAP: Record<string, QwenModelId> = QWEN_MODEL_DEFINITIONS.reduce(
  (map, definition) => {
    definition.aliases.forEach((alias) => {
      const key = alias.trim().toLowerCase().replace(/[\s_]+/g, '-');
      map[key] = definition.id;
    });
    map[definition.id.toLowerCase()] = definition.id;
    return map;
  },
  {} as Record<string, QwenModelId>,
);

export function normalizeQwenModelId(model?: string | null): QwenModelId {
  if (!model) {
    return QWEN_DEFAULT_MODEL;
  }
  const normalized = model.trim().toLowerCase().replace(/[\s_]+/g, '-');
  return QWEN_MODEL_ALIAS_MAP[normalized] ?? QWEN_DEFAULT_MODEL;
}

export function getQwenModelDefinition(id: string): QwenModelDefinition | undefined {
  return (
    QWEN_MODEL_DEFINITIONS.find((definition) => definition.id === id) ??
    QWEN_MODEL_DEFINITIONS.find((definition) =>
      definition.aliases.some((alias) => alias.toLowerCase() === id.toLowerCase()),
    )
  );
}

export function getQwenModelDisplayName(id?: string | null): string {
  if (!id) {
    return getQwenModelDefinition(QWEN_DEFAULT_MODEL)?.name ?? QWEN_DEFAULT_MODEL;
  }
  const normalized = normalizeQwenModelId(id);
  return getQwenModelDefinition(normalized)?.name ?? normalized;
}
