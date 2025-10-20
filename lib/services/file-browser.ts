/**
 * File Browser Service - Project file browsing utility
 */

import fs from 'fs/promises';
import path from 'path';
import { getProjectById } from '@/lib/services/project';
import type { ProjectFileEntry } from '@/backend-types';
import type { Project } from '@/backend-types';

const EXCLUDED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  '.cache',
  '.vercel',
  '.idea',
  '.vscode',
]);

const EXCLUDED_FILES = new Set(['.DS_Store']);

export class FileBrowserError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'FileBrowserError';
    this.status = status;
  }
}

function resolveRepoRoot(project: Project): string {
  const repoPath =
    project.repoPath || path.join('data', 'projects', project.id);
  const absolutePath = path.isAbsolute(repoPath)
    ? repoPath
    : path.resolve(process.cwd(), repoPath);
  return absolutePath;
}

function resolveSafePath(base: string, target: string): string {
  const normalizedBase = path.resolve(base);
  const resolvedTarget = path.resolve(normalizedBase, target);
  if (
    resolvedTarget !== normalizedBase &&
    !resolvedTarget.startsWith(normalizedBase + path.sep)
  ) {
    throw new FileBrowserError('Invalid path', 400);
  }
  return resolvedTarget;
}

function normalizeRelativePath(dir: string): string {
  const cleaned = dir
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/\/+$/, '');
  if (cleaned === '') {
    return '.';
  }
  return cleaned;
}

function joinRelativePath(parent: string, child: string): string {
  if (parent === '.' || parent === '') {
    return child;
  }
  return `${parent.replace(/\\/g, '/')}/${child}`;
}

async function directoryHasVisibleChildren(
  absolutePath: string
): Promise<boolean> {
  try {
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    return entries.some((entry) => {
      if (entry.isSymbolicLink()) return false;
      if (entry.isDirectory()) {
        return !EXCLUDED_DIRECTORIES.has(entry.name);
      }
      return !EXCLUDED_FILES.has(entry.name);
    });
  } catch {
    return false;
  }
}

export async function listProjectDirectory(
  projectId: string,
  dir = '.'
): Promise<ProjectFileEntry[]> {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new FileBrowserError('Project not found', 404);
  }

  const repoRoot = resolveRepoRoot(project);
  const targetDir = normalizeRelativePath(dir);
  const absoluteDir = resolveSafePath(repoRoot, targetDir === '.' ? '.' : targetDir);

  let stats;
  try {
    stats = await fs.stat(absoluteDir);
  } catch (error) {
    throw new FileBrowserError('Directory not found', 404);
  }

  if (!stats.isDirectory()) {
    throw new FileBrowserError('Not a directory', 400);
  }

  let dirEntries;
  try {
    dirEntries = await fs.readdir(absoluteDir, { withFileTypes: true });
  } catch (error) {
    throw new FileBrowserError('Failed to read directory', 500);
  }

  const entries: ProjectFileEntry[] = [];

  for (const entry of dirEntries) {
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) {
      continue;
    }
    if (!entry.isDirectory() && EXCLUDED_FILES.has(entry.name)) {
      continue;
    }

    const relativePath = joinRelativePath(targetDir, entry.name);
    const absolutePath = resolveSafePath(repoRoot, relativePath);

    if (entry.isDirectory()) {
      const hasChildren = await directoryHasVisibleChildren(absolutePath);
      entries.push({
        name: entry.name,
        path: relativePath.replace(/\\/g, '/'),
        type: 'directory',
        hasChildren,
      });
    } else {
      const fileStats = await fs.stat(absolutePath);
      entries.push({
        name: entry.name,
        path: relativePath.replace(/\\/g, '/'),
        type: 'file',
        size: fileStats.size,
        hasChildren: false,
      });
    }
  }

  entries.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return entries;
}

const MAX_FILE_BYTES = 500_000; // 500KB safeguard

export async function readProjectFileContent(
  projectId: string,
  filePath: string
): Promise<{ path: string; content: string }> {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new FileBrowserError('Project not found', 404);
  }

  const repoRoot = resolveRepoRoot(project);
  const normalizedPath = normalizeRelativePath(filePath);
  const absolutePath = resolveSafePath(
    repoRoot,
    normalizedPath === '.' ? '.' : normalizedPath
  );

  let stats;
  try {
    stats = await fs.stat(absolutePath);
  } catch (error) {
    throw new FileBrowserError('File not found', 404);
  }

  if (!stats.isFile()) {
    throw new FileBrowserError('Not a file', 400);
  }

  if (stats.size > MAX_FILE_BYTES) {
    throw new FileBrowserError('File too large to display', 400);
  }

  try {
    const content = await fs.readFile(absolutePath, 'utf-8');
    return {
      path: normalizedPath.replace(/\\/g, '/'),
      content,
    };
  } catch (error) {
    throw new FileBrowserError('Failed to read file', 500);
  }
}

const MAX_WRITE_BYTES = 1_000_000; // 1MB safeguard

export async function writeProjectFileContent(
  projectId: string,
  filePath: string,
  content: string
): Promise<void> {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new FileBrowserError('Project not found', 404);
  }

  if (typeof content !== 'string') {
    throw new FileBrowserError('Invalid file content', 400);
  }

  const repoRoot = resolveRepoRoot(project);
  const normalizedPath = normalizeRelativePath(filePath);
  const absolutePath = resolveSafePath(
    repoRoot,
    normalizedPath === '.' ? '.' : normalizedPath
  );

  let stats;
  try {
    stats = await fs.stat(absolutePath);
  } catch (error) {
    throw new FileBrowserError('File not found', 404);
  }

  if (!stats.isFile()) {
    throw new FileBrowserError('Not a file', 400);
  }

  if (content.length > MAX_WRITE_BYTES) {
    throw new FileBrowserError('File content too large', 400);
  }

  try {
    await fs.writeFile(absolutePath, content, 'utf-8');
  } catch (error) {
    throw new FileBrowserError('Failed to write file', 500);
  }
}
