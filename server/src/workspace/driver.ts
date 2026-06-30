/**
 * WorkspaceDriver — the ONLY abstraction the rest of the app uses to run
 * workspace containers. The single-host Docker implementation lives in
 * docker-driver.ts; swapping to ECS/Fargate/Fly later means writing a new
 * driver and changing one line in session-manager.ts.
 */

export interface WorkspaceHandle {
  /** opaque container/task id */
  containerId: string;
  /** host path bind-mounted to /workspace inside the container */
  workspacePath: string;
}

export interface ExecResult {
  exitCode: number;
}

export interface ExecOptions {
  /** command + args, run inside /workspace */
  cmd: string[];
  /** extra env for this exec only (e.g. ANTHROPIC_API_KEY) */
  env?: Record<string, string>;
  /** called for each stdout chunk */
  onStdout?: (chunk: Buffer) => void;
  /** called for each stderr chunk */
  onStderr?: (chunk: Buffer) => void;
  /** abort signal to kill the exec (timeouts, cancellation) */
  signal?: AbortSignal;
}

export interface WorkspaceDriver {
  /** Pull/ensure the workspace image is available. */
  ensureImage(): Promise<void>;

  /** Create + start a container for a project. Idempotent per projectId. */
  create(projectId: string): Promise<WorkspaceHandle>;

  /** Whether a container is currently running. */
  isRunning(containerId: string): Promise<boolean>;

  /** Start an existing (stopped) container. */
  start(containerId: string): Promise<void>;

  /** Run a command inside the container, streaming output. */
  exec(containerId: string, opts: ExecOptions): Promise<ExecResult>;

  /** Gracefully stop a container (keeps it for restart). */
  stop(containerId: string): Promise<void>;

  /** Remove a container entirely. */
  destroy(containerId: string): Promise<void>;

  /** List container ids managed by this driver (for restart reconciliation). */
  listManaged(): Promise<Array<{ containerId: string; projectId: string; running: boolean }>>;
}
