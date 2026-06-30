/**
 * NullWorkspaceDriver — used when DISABLE_DOCKER=1 (local dev / CI without a
 * Docker daemon). Lets the server boot and exercise routes without containers.
 * exec() is a no-op that reports success.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import type { ExecOptions, ExecResult, WorkspaceDriver, WorkspaceHandle } from './driver';

export class NullWorkspaceDriver implements WorkspaceDriver {
  async ensureImage(): Promise<void> {
    logger.warn('DISABLE_DOCKER=1 — using NullWorkspaceDriver (no containers).');
  }
  async create(projectId: string): Promise<WorkspaceHandle> {
    const workspacePath = path.join(env.WORKSPACES_ROOT, projectId);
    await fs.mkdir(workspacePath, { recursive: true });
    return { containerId: `null-${projectId}`, workspacePath };
  }
  async isRunning(): Promise<boolean> {
    return true;
  }
  async start(): Promise<void> {}
  async exec(_id: string, opts: ExecOptions): Promise<ExecResult> {
    opts.onStdout?.(Buffer.from('[null-driver] docker disabled; no execution performed\n'));
    return { exitCode: 0 };
  }
  async stop(): Promise<void> {}
  async destroy(): Promise<void> {}
  async listManaged(): Promise<Array<{ containerId: string; projectId: string; running: boolean }>> {
    return [];
  }
}
