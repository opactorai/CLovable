export type ClaudeModelId =
  | 'claude-opus-4-1-20250805'
  | 'claude-sonnet-4-5-20250929'
  | 'claude-haiku-4-5-20251001';

export interface ClaudeModelDefinition {
  id: ClaudeModelId;
  /** Human friendly display name */
  name: string;
  /** Optional longer description */
  description?: string;
  /** Whether the model can accept images */
  supportsImages?: boolean;
  /** Acceptable alias strings that should resolve to this model id */
  aliases: string[];
}

export const CLAUDE_MODEL_DEFINITIONS: ClaudeModelDefinition[] = [
  {
    id: 'claude-opus-4-1-20250805',
    name: 'Claude Opus 4.1',
    description: 'Newest Opus release with the strongest reasoning skills',
    supportsImages: true,
    aliases: [
      'claude-opus-4-1-20250805',
      'claude-opus-4-1',
      'claude-opus-4.1',
      'claude-opus-4',
      'claude-opus',
      'opus-4-1-20250805',
      'opus-4-1',
      'opus-4.1',
      'opus-4',
      'opus',
      'claude-3-opus',
      'claude-3-opus-20240229',
      'claude-3-opus-latest',
    ],
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: 'Balanced Sonnet tier with a large context window',
    supportsImages: true,
    aliases: [
      'claude-sonnet-4-5-20250929',
      'claude-sonnet-4-5',
      'claude-sonnet-4.5',
      'claude-sonnet-4',
      'claude-sonnet',
      'sonnet-4-5-20250929',
      'sonnet-4-5',
      'sonnet-4.5',
      'sonnet-4',
      'sonnet',
      'claude-3.5-sonnet',
      'claude-3-5-sonnet',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-latest',
    ],
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    description: 'Fastest Haiku tier for lightweight tasks',
    supportsImages: true,
    aliases: [
      'claude-haiku-4-5-20251001',
      'claude-haiku-4-5',
      'claude-haiku-4.5',
      'claude-haiku-4',
      'claude-haiku',
      'haiku-4-5-20251001',
      'haiku-4-5',
      'haiku-4.5',
      'haiku-4',
      'haiku',
      'claude-3-haiku',
      'claude-3-haiku-20240307',
      'claude-3-haiku-latest',
      'claude-haiku-3.5',
    ],
  },
];

export const CLAUDE_DEFAULT_MODEL: ClaudeModelId = 'claude-sonnet-4-5-20250929';

const CLAUDE_MODEL_ALIAS_MAP: Record<string, ClaudeModelId> = CLAUDE_MODEL_DEFINITIONS.reduce(
  (map, definition) => {
    definition.aliases.forEach(alias => {
      const key = alias.trim().toLowerCase().replace(/[\s_]+/g, '-');
      map[key] = definition.id;
    });
    map[definition.id.toLowerCase()] = definition.id;
    return map;
  },
  {} as Record<string, ClaudeModelId>
);

export function normalizeClaudeModelId(model?: string | null): ClaudeModelId {
  if (!model) return CLAUDE_DEFAULT_MODEL;
  const normalized = model.trim().toLowerCase().replace(/[\s_]+/g, '-');
  return CLAUDE_MODEL_ALIAS_MAP[normalized] ?? CLAUDE_DEFAULT_MODEL;
}

export function getClaudeModelDefinition(id: string): ClaudeModelDefinition | undefined {
  return (
    CLAUDE_MODEL_DEFINITIONS.find(def => def.id === id) ??
    CLAUDE_MODEL_DEFINITIONS.find(def =>
      def.aliases.some(alias => alias.toLowerCase() === id.toLowerCase())
    )
  );
}

export function getClaudeModelDisplayName(id: string): string {
  return getClaudeModelDefinition(id)?.name ?? id;
}
