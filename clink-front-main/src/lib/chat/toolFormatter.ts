import { formatCommand, formatJson } from './formatters/commonFormatter';

export interface ToolDetails {
  icon: string;
  label: string;
  details: string;
}

export interface ToolDisplay {
  title: string;
  content: string;
  todos?: any[];
  toolDetails?: ToolDetails;
}

export const formatToolDisplay = (
  toolName: string,
  input: any,
): ToolDisplay => {
  let parsed = input;

  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch {
      parsed = input;
    }
  }

  if (toolName === 'TodoWrite') {
    const todos = parsed?.todos;
    if (Array.isArray(todos)) {
      return {
        title: 'Todo List',
        content: '',
        todos,
      };
    }
    return {
      title: 'Todo List',
      content: typeof input === 'string' ? input : formatJson(input),
    };
  }

  if (toolName === 'Read') {
    const filePath = parsed?.file_path;
    const filePaths = parsed?.file_paths;

    let paths = '';
    if (Array.isArray(filePaths) && filePaths.length > 0) {
      paths = filePaths.join('\n');
    } else if (filePath) {
      paths = filePath;
    }

    if (paths) {
      return {
        title: '',
        content: '',
        toolDetails: {
          icon: '📖',
          label: 'Read file',
          details: paths,
        },
      };
    }
    return {
      title: 'Read',
      content: typeof input === 'string' ? input : formatJson(input),
    };
  }

  if (toolName === 'Write') {
    const filePath = parsed?.file_path;
    if (filePath) {
      return {
        title: '',
        content: '',
        toolDetails: {
          icon: '✏️',
          label: 'Edit',
          details: filePath,
        },
      };
    }
    return {
      title: 'Write',
      content: typeof input === 'string' ? input : formatJson(input),
    };
  }

  if (toolName === 'Edit' || toolName === 'MultiEdit') {
    const filePath = parsed?.file_path;
    if (filePath) {
      return {
        title: '',
        content: '',
        toolDetails: {
          icon: '✏️',
          label: 'Edit',
          details: filePath,
        },
      };
    }
    return {
      title: 'Edit',
      content: typeof input === 'string' ? input : formatJson(input),
    };
  }

  if (toolName === 'Bash') {
    const command = parsed?.command;
    if (command) {
      return {
        title: '',
        content: '',
        toolDetails: {
          icon: '▶',
          label: 'Ran command',
          details: command,
        },
      };
    }
    return {
      title: 'Bash',
      content: typeof input === 'string' ? input : formatJson(input),
    };
  }

  if (toolName === 'Run') {
    const commandText = formatCommand(parsed).trim();
    if (commandText && commandText !== '{}' && commandText !== '[]') {
      return {
        title: '',
        content: '',
        toolDetails: {
          icon: '▶',
          label: 'Run',
          details: commandText,
        },
      };
    }
    return {
      title: 'Run',
      content: typeof input === 'string' ? input : formatJson(input),
    };
  }

  if (toolName === 'Glob') {
    const pattern = parsed?.pattern;
    if (pattern) {
      return {
        title: '',
        content: '',
        toolDetails: {
          icon: '🔍',
          label: 'Search',
          details: pattern,
        },
      };
    }
    return {
      title: 'Glob',
      content: typeof input === 'string' ? input : formatJson(input),
    };
  }

  if (toolName === 'Grep') {
    const pattern = parsed?.pattern;
    if (pattern) {
      return {
        title: '',
        content: '',
        toolDetails: {
          icon: '🔍',
          label: 'Search',
          details: pattern,
        },
      };
    }
    return {
      title: 'Grep',
      content: typeof input === 'string' ? input : formatJson(input),
    };
  }

  return {
    title: toolName,
    content: typeof input === 'string' ? input : formatJson(input),
  };
};

export const CLAUDE_TOOL_PREVIEW_BLOCKLIST = new Set(['TodoWrite']);

export const CLAUDE_TOOL_PREVIEW_PATTERNS: Record<string, RegExp[]> = {
  Read: [/file_path["']?\s*:\s*["']([^"']+)["']/],
  Write: [/file_path["']?\s*:\s*["']([^"']+)["']/],
  Edit: [/file_path["']?\s*:\s*["']([^"']+)["']/],
  MultiEdit: [/file_path["']?\s*:\s*["']([^"']+)["']/],
  Bash: [/command["']?\s*:\s*["']([^"']+)["']/],
  Glob: [/pattern["']?\s*:\s*["']([^"']+)["']/],
  Grep: [/pattern["']?\s*:\s*["']([^"']+)["']/],
};

// Clean file path by removing /home/daytona/template/ prefix
const cleanFilePath = (path: string): string => {
  return path.replace(/^\/home\/daytona\/template\//, '');
};

export const extractToolPreviewValue = (
  toolName?: string,
  rawInput?: string | any,
): string | null => {
  if (!toolName || !rawInput || CLAUDE_TOOL_PREVIEW_BLOCKLIST.has(toolName)) {
    return null;
  }

  if (toolName === 'Run') {
    if (typeof rawInput === 'string') {
      const trimmed = rawInput.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (Array.isArray(rawInput)) {
      const joined = rawInput.join(' ').trim();
      return joined.length > 0 ? joined : null;
    }
    if (typeof rawInput === 'object') {
      const commandValue = rawInput.command ?? rawInput.description;
      if (typeof commandValue === 'string' && commandValue.trim().length > 0) {
        return commandValue.trim();
      }
    }
  }

  // If rawInput is an object, convert to JSON string for regex matching
  const inputStr =
    typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput);

  const patterns = CLAUDE_TOOL_PREVIEW_PATTERNS[toolName];
  if (!patterns) {
    return null;
  }

  for (const pattern of patterns) {
    const match = inputStr.match(pattern);
    if (match && match[1]) {
      let value = match[1];

      // Clean file paths for file-related tools
      if (['Read', 'Write', 'Edit', 'MultiEdit'].includes(toolName)) {
        value = cleanFilePath(value);
      }

      return value;
    }
  }

  return null;
};
