import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

class GitError extends Error {
  constructor(message: string, readonly output?: string) {
    super(message);
    this.name = 'GitError';
  }
}

function runGit(args: string[], cwd: string): string {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw new GitError(`Git command failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new GitError(`Git command failed: git ${args.join(' ')}`, result.stderr);
  }

  return result.stdout.trim();
}

export function ensureGitConfig(repoPath: string, name: string, email: string) {
  runGit(['config', '--local', 'user.name', name], repoPath);
  runGit(['config', '--local', 'user.email', email], repoPath);
}

export function initializeMainBranch(repoPath: string) {
  try {
    runGit(['rev-parse', 'HEAD'], repoPath);
  } catch {
    try {
      runGit(['add', '.'], repoPath);
      runGit(['commit', '-m', 'Initial commit'], repoPath);
    } catch (error) {
      if (error instanceof GitError && error.output && error.output.includes('nothing to commit')) {
        runGit(['commit', '--allow-empty', '-m', 'Initial commit'], repoPath);
      } else {
        throw error;
      }
    }
  }

  try {
    const currentBranch = runGit(['branch', '--show-current'], repoPath);
    if (currentBranch !== 'main') {
      runGit(['branch', '-M', 'main'], repoPath);
    }
  } catch {
    try {
      runGit(['checkout', '-b', 'main'], repoPath);
    } catch {
      // ignore
    }
  }
}

export function addOrUpdateRemote(repoPath: string, remoteName: string, remoteUrl: string) {
  try {
    const existing = runGit(['remote', 'get-url', remoteName], repoPath);
    if (existing !== remoteUrl) {
      runGit(['remote', 'set-url', remoteName, remoteUrl], repoPath);
    }
  } catch {
    runGit(['remote', 'add', remoteName, remoteUrl], repoPath);
  }
}

export function commitAll(repoPath: string, message: string) {
  try {
    runGit(['add', '-A'], repoPath);
    runGit(['commit', '-m', message], repoPath);
    return true;
  } catch (error) {
    if (error instanceof GitError && error.output && error.output.includes('nothing to commit')) {
      return false;
    }
    throw error;
  }
}

export function pushToRemote(repoPath: string, remoteName = 'origin', branch = 'main') {
  try {
    runGit(['push', '-u', remoteName, branch], repoPath);
  } catch (error) {
    if (error instanceof GitError) {
      runGit(['push', '-u', '--force', remoteName, branch], repoPath);
    } else {
      throw error;
    }
  }
}

export function ensureGitRepository(repoPath: string) {
  if (!fs.existsSync(repoPath)) {
    fs.mkdirSync(repoPath, { recursive: true });
  }
  if (!fs.existsSync(path.join(repoPath, '.git'))) {
    runGit(['init'], repoPath);
  }
}
