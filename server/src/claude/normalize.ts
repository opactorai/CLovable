/**
 * Normalizes Claude Code tool calls into the app's common action vocabulary.
 * Condensed port of lib/services/cli/claude.ts from the desktop codebase.
 */
import type { ToolAction } from '../realtime/events';

const TOOL_NAME_ACTION_MAP: Record<string, ToolAction> = {
  read: 'Read',
  read_file: 'Read',
  write: 'Created',
  write_file: 'Created',
  create_file: 'Created',
  edit: 'Edited',
  edit_file: 'Edited',
  multiedit: 'Edited',
  update_file: 'Edited',
  apply_patch: 'Edited',
  notebookedit: 'Edited',
  delete_file: 'Deleted',
  remove_file: 'Deleted',
  ls: 'Searched',
  glob: 'Searched',
  grep: 'Searched',
  search_files: 'Searched',
  bash: 'Executed',
  run: 'Executed',
  shell: 'Executed',
  todowrite: 'Generated',
  task: 'Generated',
  webfetch: 'Read',
  websearch: 'Searched',
};

function fromKeyword(value: string): ToolAction | undefined {
  const c = value.toLowerCase();
  if (/(edit|modify|update|patch)/.test(c)) return 'Edited';
  if (/(write|create|add|append)/.test(c)) return 'Created';
  if (/(read|open|view|fetch)/.test(c)) return 'Read';
  if (/(delete|remove)/.test(c)) return 'Deleted';
  if (/(search|find|list|glob|grep|ls)/.test(c)) return 'Searched';
  if (/(generate|todo|plan|task)/.test(c)) return 'Generated';
  if (/(execute|exec|run|bash|shell|command)/.test(c)) return 'Executed';
  return undefined;
}

export function inferAction(toolName: string): ToolAction | undefined {
  const normalized = toolName.trim().toLowerCase();
  if (!normalized) return undefined;
  if (TOOL_NAME_ACTION_MAP[normalized]) return TOOL_NAME_ACTION_MAP[normalized];
  const suffix = normalized.split(/[:_-]/).pop() ?? normalized;
  return TOOL_NAME_ACTION_MAP[suffix] ?? fromKeyword(normalized);
}

const PATH_KEYS = [
  'file_path',
  'filePath',
  'path',
  'notebook_path',
  'target',
  'pattern',
  'directory',
];

/** Pull a representative file path or command out of a tool's input object. */
export function extractTarget(
  toolName: string,
  input: unknown,
): { filePath?: string; command?: string } {
  if (!input || typeof input !== 'object') return {};
  const rec = input as Record<string, unknown>;

  for (const key of PATH_KEYS) {
    const v = rec[key];
    if (typeof v === 'string' && v.trim()) return { filePath: v.trim() };
  }

  const cmd = rec.command ?? rec.cmd;
  if (typeof cmd === 'string' && cmd.trim()) {
    return { command: cmd.trim() };
  }
  return {};
}

/** Build the metadata blob persisted alongside a tool message. */
export function buildToolMetadata(toolName: string, input: unknown) {
  const action = inferAction(toolName);
  const { filePath, command } = extractTarget(toolName, input);
  return {
    toolName,
    action,
    ...(filePath ? { filePath } : {}),
    ...(command ? { command } : {}),
    toolInput: input,
  };
}
