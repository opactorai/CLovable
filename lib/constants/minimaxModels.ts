export type MiniMaxModelId = 'MiniMax-M3' | 'MiniMax-M2.7';

export interface MiniMaxModelDefinition {
  id: MiniMaxModelId;
  /** User facing display name */
  name: string;
  /** Longer description shown in pickers */
  description?: string;
  /** Whether the model accepts image input */
  supportsImages?: boolean;
  /** Alias strings that should resolve to this model */
  aliases: string[];
}

export const MINIMAX_MODEL_DEFINITIONS: MiniMaxModelDefinition[] = [
  {
    id: 'MiniMax-M3',
    name: 'MiniMax M3',
    description: 'MiniMax M3 with 1M context, multimodal input and Claude Code compatible agent runtime',
    supportsImages: true,
    aliases: [
      'minimax-m3',
      'minimaxm3',
      'minimax m3',
      'minimax_m3',
      'm3',
      'minimax-latest',
      'minimax',
    ],
  },
  {
    id: 'MiniMax-M2.7',
    name: 'MiniMax M2.7',
    description: 'MiniMax M2.7 text model with 204k context and always-on thinking',
    supportsImages: false,
    aliases: [
      'minimax-m2.7',
      'minimaxm2.7',
      'minimax m2.7',
      'minimax_m2_7',
      'm2.7',
      'm27',
    ],
  },
];

export const MINIMAX_DEFAULT_MODEL: MiniMaxModelId = 'MiniMax-M3';

const MINIMAX_MODEL_ALIAS_MAP: Record<string, MiniMaxModelId> = MINIMAX_MODEL_DEFINITIONS.reduce(
  (map, definition) => {
    definition.aliases.forEach((alias) => {
      const key = alias.trim().toLowerCase();
      map[key] = definition.id;
    });
    map[definition.id.toLowerCase()] = definition.id;
    return map;
  },
  {} as Record<string, MiniMaxModelId>,
);

export function normalizeMiniMaxModelId(model?: string | null): MiniMaxModelId {
  if (!model) {
    return MINIMAX_DEFAULT_MODEL;
  }
  const normalized = model.trim().toLowerCase();
  if (!normalized) {
    return MINIMAX_DEFAULT_MODEL;
  }
  return MINIMAX_MODEL_ALIAS_MAP[normalized] ?? MINIMAX_DEFAULT_MODEL;
}

export function getMiniMaxModelDefinition(id: string): MiniMaxModelDefinition | undefined {
  return (
    MINIMAX_MODEL_DEFINITIONS.find((definition) => definition.id === id) ??
    MINIMAX_MODEL_DEFINITIONS.find((definition) =>
      definition.aliases.some((alias) => alias.toLowerCase() === id.toLowerCase()),
    )
  );
}

export function getMiniMaxModelDisplayName(id?: string | null): string {
  if (!id) {
    return getMiniMaxModelDefinition(MINIMAX_DEFAULT_MODEL)?.name ?? MINIMAX_DEFAULT_MODEL;
  }
  const normalized = normalizeMiniMaxModelId(id);
  return getMiniMaxModelDefinition(normalized)?.name ?? normalized;
}
