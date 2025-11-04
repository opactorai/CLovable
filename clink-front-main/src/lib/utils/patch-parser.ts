/**
 * Parse a unified diff patch and reconstruct original and modified file contents
 */
export function patchToContent(patch: string): { original: string; modified: string } {
  const lines = patch.split('\n');
  const originalLines: string[] = [];
  const modifiedLines: string[] = [];

  let inHunk = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip diff header lines (---,  +++, @@, diff, index, etc.)
    if (line.startsWith('---') || line.startsWith('+++') ||
        line.startsWith('diff ') || line.startsWith('index ')) {
      continue;
    }

    // Hunk header (e.g., @@ -1,5 +1,6 @@)
    if (line.startsWith('@@')) {
      inHunk = true;
      continue;
    }

    if (!inHunk) continue;

    // Empty line at end
    if (line === '' && i === lines.length - 1) {
      break;
    }

    const firstChar = line[0];
    const content = line.substring(1);

    if (firstChar === '-') {
      // Line removed - only in original
      originalLines.push(content);
    } else if (firstChar === '+') {
      // Line added - only in modified
      modifiedLines.push(content);
    } else if (firstChar === ' ') {
      // Context line - in both
      originalLines.push(content);
      modifiedLines.push(content);
    } else if (firstChar === '\\') {
      // Metadata line like "\ No newline at end of file" - skip
      continue;
    } else {
      // Treat as context line (for lines that don't start with +, -, or space)
      originalLines.push(line);
      modifiedLines.push(line);
    }
  }

  return {
    original: originalLines.join('\n'),
    modified: modifiedLines.join('\n'),
  };
}

/**
 * Get the language from a filename
 */
export function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  const extMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'json': 'json',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'html': 'html',
    'md': 'markdown',
    'py': 'python',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'kt': 'kotlin',
    'swift': 'swift',
    'yaml': 'yaml',
    'yml': 'yaml',
    'sql': 'sql',
    'sh': 'bash',
    'bash': 'bash',
    'toml': 'toml',
  };

  return extMap[ext] || 'plaintext';
}
