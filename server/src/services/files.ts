/**
 * Read-only access to a project's generated files on the host workspace path.
 * Path traversal is blocked: resolved paths must stay within the workspace.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { httpErrors } from '../lib/errors';

const IGNORED = new Set(['node_modules', '.git', '.next', 'dist', '.turbo', '.cache']);

export interface FileNode {
  name: string;
  path: string; // relative to workspace root
  type: 'file' | 'dir';
  size?: number;
  children?: FileNode[];
}

function safeJoin(root: string, rel: string): string {
  const resolved = path.resolve(root, rel);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw httpErrors.badRequest('Path escapes workspace');
  }
  return resolved;
}

export async function listTree(workspacePath: string, maxDepth = 6): Promise<FileNode[]> {
  async function walk(dir: string, rel: string, depth: number): Promise<FileNode[]> {
    if (depth > maxDepth) return [];
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const nodes: FileNode[] = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (IGNORED.has(entry.name)) continue;
      const childRel = path.join(rel, entry.name);
      const childAbs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: childRel,
          type: 'dir',
          children: await walk(childAbs, childRel, depth + 1),
        });
      } else if (entry.isFile()) {
        let size: number | undefined;
        try {
          size = (await fs.stat(childAbs)).size;
        } catch {
          /* ignore */
        }
        nodes.push({ name: entry.name, path: childRel, type: 'file', size });
      }
    }
    return nodes;
  }
  return walk(workspacePath, '', 0);
}

const MAX_FILE_BYTES = 1024 * 1024; // 1MB read cap

export async function readFile(workspacePath: string, relPath: string): Promise<string> {
  const abs = safeJoin(workspacePath, relPath);
  const stat = await fs.stat(abs).catch(() => null);
  if (!stat || !stat.isFile()) {
    throw httpErrors.notFound('File not found');
  }
  if (stat.size > MAX_FILE_BYTES) {
    throw httpErrors.badRequest('File too large to preview');
  }
  return fs.readFile(abs, 'utf8');
}
