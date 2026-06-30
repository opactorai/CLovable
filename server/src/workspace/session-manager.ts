/**
 * SessionManager — owns the lifecycle of every workspace container.
 *
 * Responsibilities:
 *  - create / get-or-start / stop / destroy workspaces
 *  - enforce a max-concurrent-running cap, queueing extra work
 *  - track per-project state and last-activity for the idle reaper
 *  - reconcile in-memory state with the driver after a backend restart
 *
 * Docker is reached only through the injected WorkspaceDriver, so this module
 * is the single seam for swapping single-host Docker -> ECS/Fargate later.
 */
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { httpErrors } from '../lib/errors';
import { DockerWorkspaceDriver } from './docker-driver';
import { LocalProcessWorkspaceDriver } from './process-driver';
import { NullWorkspaceDriver } from './null-driver';
import type { WorkspaceDriver, WorkspaceHandle } from './driver';
import { getProject, updateProject, setProjectStatus } from '../services/projects';

type WorkspaceState = 'idle' | 'starting' | 'running' | 'executing' | 'stopping';

interface WorkspaceEntry {
  projectId: string;
  containerId: string;
  workspacePath: string;
  state: WorkspaceState;
  lastActivity: number;
}

export class SessionManager {
  private entries = new Map<string, WorkspaceEntry>();
  private queue: Array<{ projectId: string; resolve: () => void; reject: (e: unknown) => void }> = [];
  private reaper?: NodeJS.Timeout;

  constructor(private readonly driver: WorkspaceDriver) {}

  async init(): Promise<void> {
    await this.driver.ensureImage();
    await this.reconcile();
    this.startReaper();
  }

  /** Number of containers currently running (not idle/stopped). */
  private runningCount(): number {
    let n = 0;
    for (const e of this.entries.values()) {
      if (e.state === 'running' || e.state === 'executing' || e.state === 'starting') n += 1;
    }
    return n;
  }

  /** Provision a brand-new workspace for a project. */
  async createWorkspace(projectId: string): Promise<WorkspaceEntry> {
    await this.acquireSlot(projectId);
    try {
      await setProjectStatus(projectId, 'provisioning');
      const handle = await this.driver.create(projectId);
      const entry = this.track(projectId, handle, 'running');
      await updateProject(projectId, {
        container_id: handle.containerId,
        workspace_path: handle.workspacePath,
        status: 'running',
      });
      return entry;
    } catch (err) {
      this.releaseSlot();
      await setProjectStatus(projectId, 'error').catch(() => {});
      throw err;
    }
  }

  /** Get a running workspace for a project, starting/creating it as needed. */
  async getOrStartWorkspace(projectId: string): Promise<WorkspaceEntry> {
    const existing = this.entries.get(projectId);
    if (existing && (await this.driver.isRunning(existing.containerId))) {
      existing.lastActivity = Date.now();
      return existing;
    }

    // Try to adopt a container recorded on the project row.
    const project = await getProject(projectId);
    if (project?.container_id && (await this.driver.isRunning(project.container_id))) {
      const entry = this.track(
        projectId,
        { containerId: project.container_id, workspacePath: project.workspace_path ?? '' },
        'running',
      );
      return entry;
    }
    if (project?.container_id) {
      await this.acquireSlot(projectId);
      try {
        await this.driver.start(project.container_id);
        const entry = this.track(
          projectId,
          { containerId: project.container_id, workspacePath: project.workspace_path ?? '' },
          'running',
        );
        await setProjectStatus(projectId, 'running');
        return entry;
      } catch {
        this.releaseSlot();
        // container gone — fall through to recreate
      }
    }

    return this.createWorkspace(projectId);
  }

  /** Mark a project as actively executing (reaper will skip it). */
  markExecuting(projectId: string, executing: boolean): void {
    const entry = this.entries.get(projectId);
    if (!entry) return;
    entry.state = executing ? 'executing' : 'running';
    entry.lastActivity = Date.now();
  }

  async stopWorkspace(projectId: string): Promise<void> {
    const entry = this.entries.get(projectId);
    if (!entry) return;
    entry.state = 'stopping';
    await this.driver.stop(entry.containerId);
    this.entries.delete(projectId);
    this.releaseSlot();
    await setProjectStatus(projectId, 'stopped').catch(() => {});
  }

  async destroyWorkspace(projectId: string): Promise<void> {
    const project = await getProject(projectId);
    const containerId = this.entries.get(projectId)?.containerId ?? project?.container_id ?? undefined;
    if (containerId) {
      await this.driver.destroy(containerId);
    }
    if (this.entries.delete(projectId)) {
      this.releaseSlot();
    }
    await updateProject(projectId, { container_id: null, status: 'idle' }).catch(() => {});
  }

  getDriver(): WorkspaceDriver {
    return this.driver;
  }

  getState(projectId: string): WorkspaceState | undefined {
    return this.entries.get(projectId)?.state;
  }

  // --- internals ---

  private track(projectId: string, handle: WorkspaceHandle, state: WorkspaceState): WorkspaceEntry {
    const entry: WorkspaceEntry = {
      projectId,
      containerId: handle.containerId,
      workspacePath: handle.workspacePath,
      state,
      lastActivity: Date.now(),
    };
    this.entries.set(projectId, entry);
    return entry;
  }

  /** Wait for a concurrency slot; resolves immediately if under the cap. */
  private acquireSlot(projectId: string): Promise<void> {
    if (this.runningCount() < env.MAX_CONCURRENT_WORKSPACES) {
      return Promise.resolve();
    }
    logger.info({ projectId, queued: this.queue.length + 1 }, 'Concurrency cap reached — queuing');
    return new Promise<void>((resolve, reject) => {
      this.queue.push({ projectId, resolve, reject });
    });
  }

  private releaseSlot(): void {
    const next = this.queue.shift();
    if (next) next.resolve();
  }

  private startReaper(): void {
    this.reaper = setInterval(() => {
      const now = Date.now();
      for (const entry of [...this.entries.values()]) {
        if (entry.state === 'executing' || entry.state === 'stopping') continue;
        if (now - entry.lastActivity > env.WORKSPACE_IDLE_TTL_MS) {
          logger.info({ projectId: entry.projectId }, 'Reaping idle workspace');
          // archive-then-stop is handled by the storage layer hook in stopWorkspace's caller;
          // here we stop directly. (See storage.ts archiveWorkspace for persistence.)
          this.stopWorkspace(entry.projectId).catch((err) =>
            logger.warn({ err, projectId: entry.projectId }, 'Reaper stop failed'),
          );
        }
      }
    }, env.WORKSPACE_REAPER_INTERVAL_MS);
    this.reaper.unref?.();
  }

  /** After a restart, rebuild in-memory entries from containers the driver still has. */
  private async reconcile(): Promise<void> {
    try {
      const managed = await this.driver.listManaged();
      for (const m of managed) {
        if (!m.projectId) continue;
        if (m.running) {
          this.track(m.projectId, { containerId: m.containerId, workspacePath: '' }, 'running');
        }
      }
      logger.info({ adopted: this.entries.size }, 'Reconciled workspace state after start');
    } catch (err) {
      logger.warn({ err }, 'Workspace reconciliation failed (continuing)');
    }
  }

  async shutdown(): Promise<void> {
    if (this.reaper) clearInterval(this.reaper);
  }
}

function selectDriver(): WorkspaceDriver {
  if (env.DISABLE_DOCKER) return new NullWorkspaceDriver();
  if (env.WORKSPACE_MODE === 'process') return new LocalProcessWorkspaceDriver();
  return new DockerWorkspaceDriver();
}

// Singleton across imports / hot-reload.
const g = globalThis as unknown as { __claudable_session_mgr__?: SessionManager };
export const sessionManager: SessionManager =
  g.__claudable_session_mgr__ ?? (g.__claudable_session_mgr__ = new SessionManager(selectDriver()));
