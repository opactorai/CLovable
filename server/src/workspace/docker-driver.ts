/**
 * DockerWorkspaceDriver — single-host implementation of WorkspaceDriver.
 * Talks to the local Docker daemon via dockerode.
 *
 * Containers are labeled so the driver can find and reconcile them after a
 * backend restart. Each project gets a deterministic container name so
 * create() is idempotent.
 */
import Docker from 'dockerode';
import path from 'node:path';
import fs from 'node:fs/promises';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import type { ExecOptions, ExecResult, WorkspaceDriver, WorkspaceHandle } from './driver';

const LABEL_MANAGED = 'claudable.managed';
const LABEL_PROJECT = 'claudable.projectId';

function containerName(projectId: string): string {
  return `claudable-ws-${projectId}`;
}

export class DockerWorkspaceDriver implements WorkspaceDriver {
  private docker = new Docker();

  async ensureImage(): Promise<void> {
    try {
      await this.docker.getImage(env.WORKSPACE_IMAGE).inspect();
      return;
    } catch {
      logger.info({ image: env.WORKSPACE_IMAGE }, 'Workspace image not present locally; pulling');
    }
    await new Promise<void>((resolve, reject) => {
      this.docker.pull(env.WORKSPACE_IMAGE, (err: unknown, stream: NodeJS.ReadableStream) => {
        if (err) return reject(err);
        this.docker.modem.followProgress(stream, (e: unknown) => (e ? reject(e) : resolve()));
      });
    });
  }

  private async hostWorkspaceDir(projectId: string): Promise<string> {
    const dir = path.join(env.WORKSPACES_ROOT, projectId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async create(projectId: string): Promise<WorkspaceHandle> {
    const name = containerName(projectId);

    // Idempotent: reuse an existing container for this project if present.
    const existing = this.docker.getContainer(name);
    try {
      const info = await existing.inspect();
      if (!info.State.Running) {
        await existing.start();
      }
      return {
        containerId: info.Id,
        workspacePath: await this.hostWorkspaceDir(projectId),
      };
    } catch {
      // not found — fall through to create
    }

    const workspacePath = await this.hostWorkspaceDir(projectId);

    const container = await this.docker.createContainer({
      name,
      Image: env.WORKSPACE_IMAGE,
      Labels: { [LABEL_MANAGED]: 'true', [LABEL_PROJECT]: projectId },
      Tty: false,
      // No credential baked in — the per-user Anthropic key is injected per exec
      // (see runner.ts -> WorkspaceDriver.exec opts.env).
      Env: [],
      WorkingDir: '/workspace',
      HostConfig: {
        Binds: [`${workspacePath}:/workspace`],
        Memory: env.WORKSPACE_MEMORY_LIMIT_MB * 1024 * 1024,
        NanoCpus: Math.round(env.WORKSPACE_CPU_LIMIT * 1e9),
        // Security hardening: drop privileges, no new privileges.
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges'],
        PidsLimit: 512,
      },
    });

    await container.start();
    logger.info({ projectId, containerId: container.id }, 'Workspace container created');
    return { containerId: container.id, workspacePath };
  }

  async isRunning(containerId: string): Promise<boolean> {
    try {
      const info = await this.docker.getContainer(containerId).inspect();
      return info.State.Running === true;
    } catch {
      return false;
    }
  }

  async start(containerId: string): Promise<void> {
    await this.docker.getContainer(containerId).start();
  }

  async exec(containerId: string, opts: ExecOptions): Promise<ExecResult> {
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: opts.cmd,
      WorkingDir: '/workspace',
      Env: opts.env ? Object.entries(opts.env).map(([k, v]) => `${k}=${v}`) : undefined,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });

    const stream = await exec.start({ hijack: true, stdin: false });

    // Demux Docker's multiplexed stream into stdout/stderr.
    const stdoutSink = new WritableSink(opts.onStdout);
    const stderrSink = new WritableSink(opts.onStderr);
    this.docker.modem.demuxStream(stream, stdoutSink, stderrSink);

    const onAbort = () => {
      // Best-effort: killing the exec'd process isn't directly supported;
      // stopping the container is the lever the session manager pulls.
      stream.destroy();
    };
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    await new Promise<void>((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    }).finally(() => {
      opts.signal?.removeEventListener('abort', onAbort);
    });

    const info = await exec.inspect();
    return { exitCode: info.ExitCode ?? 0 };
  }

  async stop(containerId: string): Promise<void> {
    try {
      await this.docker.getContainer(containerId).stop({ t: 5 });
    } catch (err) {
      logger.warn({ err, containerId }, 'Container stop failed (may already be stopped)');
    }
  }

  async destroy(containerId: string): Promise<void> {
    try {
      await this.docker.getContainer(containerId).remove({ force: true });
    } catch (err) {
      logger.warn({ err, containerId }, 'Container remove failed');
    }
  }

  async listManaged(): Promise<Array<{ containerId: string; projectId: string; running: boolean }>> {
    const containers = await this.docker.listContainers({
      all: true,
      filters: { label: [`${LABEL_MANAGED}=true`] },
    });
    return containers.map((c) => ({
      containerId: c.Id,
      projectId: c.Labels?.[LABEL_PROJECT] ?? '',
      running: c.State === 'running',
    }));
  }
}

/** Minimal Writable that forwards chunks to a callback (used for stream demux). */
import { Writable } from 'node:stream';
class WritableSink extends Writable {
  constructor(private readonly onChunk?: (chunk: Buffer) => void) {
    super();
  }
  _write(chunk: Buffer, _enc: BufferEncoding, cb: (e?: Error | null) => void): void {
    try {
      this.onChunk?.(chunk);
      cb();
    } catch (e) {
      cb(e as Error);
    }
  }
}
