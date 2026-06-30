/**
 * ClaudeRunner — drives headless Claude Code inside a workspace container and
 * streams its full agentic output to the project's event bus.
 *
 * Claude Code is invoked non-interactively with `--output-format stream-json`,
 * which emits one JSON object per line: a system/init line (carrying the
 * session_id we persist for resumption), assistant lines (text + tool_use
 * blocks), user lines (tool_result blocks), and a final result line.
 */
import { randomUUID } from 'node:crypto';
import { env, operatorCredentialEnv } from '../config/env';
import { getAnthropicKey } from '../services/user-settings';
import { projectLogger } from '../lib/logger';
import { eventBus } from '../realtime/event-bus';
import { makeEvent } from '../realtime/events';
import { appendMessage } from '../services/chat';
import { getProject, updateProject, setProjectStatus, touchProject } from '../services/projects';
import { sessionManager } from '../workspace/session-manager';
import { buildToolMetadata } from './normalize';

export interface RunOptions {
  projectId: string;
  prompt: string;
  model?: string;
  /** when true, do not resume a prior session (first prompt of a project) */
  isInitial?: boolean;
  requestId?: string;
}

interface ClaudeStreamLine {
  type: string;
  subtype?: string;
  session_id?: string;
  message?: {
    content?: Array<Record<string, unknown>>;
  };
  result?: string;
  duration_ms?: number;
  is_error?: boolean;
  total_cost_usd?: number;
}

/**
 * Execute one turn. Persists messages, publishes realtime events, captures the
 * Claude session id for resumption, and returns when the run completes.
 */
export async function runClaude(opts: RunOptions): Promise<{ ok: boolean; error?: string }> {
  const { projectId } = opts;
  const requestId = opts.requestId ?? randomUUID();
  const log = projectLogger(projectId);
  const startedAt = Date.now();

  const publish = (type: string, data: unknown) =>
    eventBus.publish(makeEvent(type, projectId, data, { requestId }));

  const project = await getProject(projectId);
  if (!project) {
    return { ok: false, error: 'Project not found' };
  }

  const model = opts.model ?? project.selected_model ?? env.CLAUDE_DEFAULT_MODEL;
  const resumeSessionId = opts.isInitial ? undefined : project.claude_session_id ?? undefined;

  // Resolve the Claude credential (BYOK): the project owner's key, else the
  // operator fallback. Bail early — before spinning up a workspace — if neither.
  const userKey = await getAnthropicKey(project.user_id);
  const credentialEnv = userKey ? { ANTHROPIC_API_KEY: userKey } : operatorCredentialEnv();
  if (!credentialEnv.ANTHROPIC_API_KEY && !credentialEnv.CLAUDE_CODE_OAUTH_TOKEN) {
    const message = 'No Anthropic API key configured. Add your key in Settings to run Claude Code.';
    publish('completion', { ok: false, error: message });
    await appendMessage({ projectId, role: 'system', message, requestId }).catch(() => {});
    await setProjectStatus(projectId, 'idle').catch(() => {});
    return { ok: false, error: message };
  }

  // Ensure a running workspace and mark it busy so the reaper leaves it alone.
  const workspace = await sessionManager.getOrStartWorkspace(projectId);
  sessionManager.markExecuting(projectId, true);
  await setProjectStatus(projectId, 'executing');
  publish('status', { status: 'executing', detail: 'Launching Claude Code' });

  // Build the headless Claude Code command. Runs inside the sandboxed container,
  // so we skip interactive permission prompts for autonomous operation.
  const cmd = [
    'claude',
    '-p',
    opts.prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
    '--model',
    model,
  ];
  if (resumeSessionId) {
    cmd.push('--resume', resumeSessionId);
  }

  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), env.EXECUTION_TIMEOUT_MS);

  let capturedSessionId: string | undefined;
  let buffer = '';

  const handleLine = async (raw: string) => {
    const line = raw.trim();
    if (!line) return;
    let evt: ClaudeStreamLine;
    try {
      evt = JSON.parse(line);
    } catch {
      // Non-JSON output (rare) — forward as a terminal line.
      publish('terminal', { stream: 'stdout', line });
      return;
    }
    await dispatchEvent(evt);
  };

  const dispatchEvent = async (evt: ClaudeStreamLine) => {
    switch (evt.type) {
      case 'system': {
        if (evt.subtype === 'init' && evt.session_id) {
          capturedSessionId = evt.session_id;
        }
        return;
      }
      case 'assistant': {
        for (const block of evt.message?.content ?? []) {
          const blockType = block.type as string;
          if (blockType === 'text' && typeof block.text === 'string' && block.text.trim()) {
            publish('message', { role: 'assistant', content: block.text });
            await appendMessage({
              projectId,
              role: 'assistant',
              message: block.text,
              requestId,
            });
          } else if (blockType === 'tool_use') {
            const toolName = String(block.name ?? 'tool');
            const metadata = buildToolMetadata(toolName, block.input);
            publish('tool', {
              toolName,
              action: metadata.action,
              filePath: metadata.filePath,
              command: metadata.command,
              phase: 'start',
            });
            await appendMessage({
              projectId,
              role: 'tool',
              message: metadata.filePath ?? metadata.command ?? toolName,
              metadata,
              requestId,
            });
          }
        }
        return;
      }
      case 'user': {
        // tool_result blocks — surface as terminal/result output.
        for (const block of evt.message?.content ?? []) {
          if (block.type === 'tool_result') {
            const content =
              typeof block.content === 'string'
                ? block.content
                : JSON.stringify(block.content ?? '');
            if (content) {
              publish('tool', { toolName: 'result', phase: 'result', output: content.slice(0, 8000) });
            }
          }
        }
        return;
      }
      case 'result': {
        if (typeof evt.result === 'string' && evt.result.trim()) {
          publish('message', { role: 'assistant', content: evt.result });
        }
        return;
      }
      default:
        return;
    }
  };

  try {
    const result = await sessionManager.getDriver().exec(workspace.containerId, {
      cmd,
      env: credentialEnv,
      signal: abort.signal,
      onStdout: (chunk) => {
        buffer += chunk.toString('utf8');
        let idx: number;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          void handleLine(line);
        }
      },
      onStderr: (chunk) => {
        publish('terminal', { stream: 'stderr', line: chunk.toString('utf8') });
      },
    });

    if (buffer.trim()) await handleLine(buffer);

    // Persist the captured session id for the next turn's --resume.
    if (capturedSessionId && capturedSessionId !== project.claude_session_id) {
      await updateProject(projectId, { claude_session_id: capturedSessionId });
    }

    const ok = result.exitCode === 0;
    const durationMs = Date.now() - startedAt;
    publish('completion', { ok, durationMs, ...(ok ? {} : { error: `exit ${result.exitCode}` }) });
    log.info({ ok, durationMs, exitCode: result.exitCode }, 'Claude run finished');
    return ok ? { ok } : { ok, error: `Claude Code exited with code ${result.exitCode}` };
  } catch (err) {
    const aborted = abort.signal.aborted;
    const message = aborted
      ? `Execution timed out after ${env.EXECUTION_TIMEOUT_MS}ms`
      : err instanceof Error
        ? err.message
        : String(err);
    log.error({ err, aborted }, 'Claude run failed');
    publish('completion', { ok: false, error: message });
    await appendMessage({ projectId, role: 'system', message: `Error: ${message}`, requestId }).catch(
      () => {},
    );
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
    sessionManager.markExecuting(projectId, false);
    await setProjectStatus(projectId, 'running').catch(() => {});
    await touchProject(projectId).catch(() => {});
  }
}
