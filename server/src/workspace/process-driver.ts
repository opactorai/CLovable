/**
 * LocalProcessWorkspaceDriver — runs Claude Code as a child process inside THIS
 * container, with one directory per project under WORKSPACES_ROOT.
 *
 * Used on PaaS hosts (Railway, Render, Fly) that don't expose the host Docker
 * daemon, so the sibling-container model isn't available. Tradeoff: projects
 * share this process's container — no per-project kernel isolation. Acceptable
 * for single-tenant / gated-demo deployments.
 *
 * Claude Code refuses `--dangerously-skip-permissions` when running as root, so
 * when this server runs as root we drop each child to WORKSPACE_RUN_UID/GID.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import type { ExecOptions, ExecResult, WorkspaceDriver, WorkspaceHandle } from './driver';

const PREFIX = 'process-';

function projectIdFromContainer(containerId: string): string {
  return containerId.startsWith(PREFIX) ? containerId.slice(PREFIX.length) : containerId;
}

export class LocalProcessWorkspaceDriver implements WorkspaceDriver {
  // setuid on a child only works when the parent is root.
  private readonly canSetUid =
    typeof process.getuid === 'function' && process.getuid() === 0;

  async ensureImage(): Promise<void> {
    if (!this.canSetUid && env.WORKSPACE_RUN_UID !== process.getuid?.()) {
      logger.info('WORKSPACE_MODE=process: running children as current user (not root).');
    }
  }

  private workspaceDir(projectId: string): string {
    return path.join(env.WORKSPACES_ROOT, projectId);
  }

  /** Ensure the project dir exists and is owned by the run user (when root). */
  private async ensureDir(projectId: string): Promise<string> {
    const dir = this.workspaceDir(projectId);
    await fs.mkdir(dir, { recursive: true });
    if (this.canSetUid) {
      await fs
        .chown(dir, env.WORKSPACE_RUN_UID, env.WORKSPACE_RUN_GID)
        .catch((err) => logger.warn({ err, dir }, 'workspace chown failed'));
    }
    return dir;
  }

  async create(projectId: string): Promise<WorkspaceHandle> {
    const workspacePath = await this.ensureDir(projectId);
    return { containerId: `${PREFIX}${projectId}`, workspacePath };
  }

  async isRunning(): Promise<boolean> {
    // No container to keep alive; the directory is always "available".
    return true;
  }

  async start(): Promise<void> {
    /* no-op */
  }

  async exec(containerId: string, opts: ExecOptions): Promise<ExecResult> {
    const projectId = projectIdFromContainer(containerId);
    const cwd = await this.ensureDir(projectId);
    const [command, ...args] = opts.cmd;

    return new Promise<ExecResult>((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        env: {
          ...process.env,
          ...opts.env,
          // Only override HOME when we're switching users; locally keep the real HOME.
          ...(this.canSetUid ? { HOME: env.WORKSPACE_RUN_HOME } : {}),
        },
        ...(this.canSetUid ? { uid: env.WORKSPACE_RUN_UID, gid: env.WORKSPACE_RUN_GID } : {}),
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const onAbort = () => child.kill('SIGTERM');
      opts.signal?.addEventListener('abort', onAbort, { once: true });

      child.stdout?.on('data', (c: Buffer) => opts.onStdout?.(c));
      child.stderr?.on('data', (c: Buffer) => opts.onStderr?.(c));

      child.on('error', (err) => {
        opts.signal?.removeEventListener('abort', onAbort);
        reject(err);
      });
      child.on('close', (code) => {
        opts.signal?.removeEventListener('abort', onAbort);
        resolve({ exitCode: code ?? 0 });
      });
    });
  }

  async stop(): Promise<void> {
    /* no persistent process to stop */
  }

  async destroy(containerId: string): Promise<void> {
    const dir = this.workspaceDir(projectIdFromContainer(containerId));
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }

  async listManaged(): Promise<Array<{ containerId: string; projectId: string; running: boolean }>> {
    // Rebuild from on-disk workspace directories so restarts can adopt them.
    try {
      const entries = await fs.readdir(env.WORKSPACES_ROOT, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory())
        .map((e) => ({ containerId: `${PREFIX}${e.name}`, projectId: e.name, running: true }));
    } catch {
      return [];
    }
  }
}
