/**
 * OpenCode CLI Service - Node integration for OpenCode (opencode-ai)
 *
 * Streams JSON events from `opencode run --format json` and maps them to
 * Claudable's realtime/message system without hardcoding models or MCP presets.
 */

import { spawn } from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'crypto';

import type { RealtimeMessage } from '@/types';
import { streamManager } from '@/lib/services/stream';
import { createMessage } from '@/lib/services/message';
import { getProjectById } from '@/lib/services/project';
import { serializeMessage, createRealtimeMessage } from '@/lib/serializers/chat';
import {
  markUserRequestAsCompleted,
  markUserRequestAsFailed,
  markUserRequestAsRunning,
} from '@/lib/services/user-requests';

const STATUS_LABELS: Record<string, string> = {
  starting: 'Initializing OpenCode...',
  ready: 'OpenCode session ready',
  running: 'OpenCode is processing the request...',
  completed: 'OpenCode execution completed',
};

function publishStatus(projectId: string, status: keyof typeof STATUS_LABELS, requestId?: string, message?: string) {
  streamManager.publish(projectId, {
    type: 'status',
    data: {
      status,
      message: message ?? STATUS_LABELS[status] ?? '',
      ...(requestId ? { requestId } : {}),
    },
  });
}

async function ensureProjectPath(projectId: string, projectPath: string): Promise<string> {
  const project = await getProjectById(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const absolute = path.isAbsolute(projectPath)
    ? path.resolve(projectPath)
    : path.resolve(process.cwd(), projectPath);

  const allowedBasePath = path.resolve(process.cwd(), process.env.PROJECTS_DIR || './data/projects');
  const relativeToBase = path.relative(allowedBasePath, absolute);
  const isWithinBase = !relativeToBase.startsWith('..') && !path.isAbsolute(relativeToBase);
  if (!isWithinBase) {
    throw new Error(`Project path must be within ${allowedBasePath}. Got: ${absolute}`);
  }

  try {
    await fs.access(absolute);
  } catch {
    await fs.mkdir(absolute, { recursive: true });
  }

  return absolute;
}

async function persistMessage(
  projectId: string,
  payload: {
    id?: string;
    role: 'assistant' | 'tool';
    messageType: 'chat' | 'tool_use' | 'tool_result' | 'error' | 'system' | 'info';
    content: string;
    metadata?: Record<string, unknown> | null;
  },
  requestId?: string,
  overrides?: Partial<RealtimeMessage>,
) {
  try {
    const saved = await createMessage({
      ...(payload.id ? { id: payload.id } : {}),
      projectId,
      role: payload.role,
      messageType: payload.messageType,
      content: payload.content,
      metadata: payload.metadata ?? null,
      cliSource: 'opencode',
      requestId,
    });
    streamManager.publish(projectId, {
      type: 'message',
      data: serializeMessage(saved, { ...(requestId ? { requestId } : {}), ...(overrides ?? {}) }),
    });
  } catch (error) {
    const fallback = createRealtimeMessage({
      id: payload.id ?? randomUUID(),
      projectId,
      role: payload.role,
      messageType: payload.messageType,
      content: payload.content,
      metadata: payload.metadata ?? null,
      cliSource: 'opencode',
      requestId,
      ...(overrides ?? {}),
    });
    streamManager.publish(projectId, { type: 'message', data: fallback });
  }
}

async function dispatchToolMessage(
  projectId: string,
  content: string,
  metadata: Record<string, unknown>,
  requestId?: string,
  options: { messageType?: 'tool_use' | 'tool_result' } = {},
) {
  const trimmed = content.trim();
  if (!trimmed) return;
  const messageType = options.messageType ?? 'tool_use';
  const enriched: Record<string, unknown> = { cli_type: 'opencode', ...(metadata ?? {}) };

  // Normalize tool name fields
  const snake = typeof enriched['tool_name'] === 'string' ? (enriched['tool_name'] as string) : undefined;
  const camel = typeof enriched['toolName'] === 'string' ? (enriched['toolName'] as string) : undefined;
  if (!camel && snake) enriched['toolName'] = snake;
  if (!snake && camel) enriched['tool_name'] = camel;

  await persistMessage(
    projectId,
    { role: 'tool', messageType, content: trimmed, metadata: enriched },
    requestId,
  );
}

type OpenCodeJsonEvent =
  | { type: 'tool_use'; sessionID?: string; part?: any }
  | { type: 'text'; sessionID?: string; part?: any }
  | { type: 'step_start'; sessionID?: string; part?: any }
  | { type: 'step_finish'; sessionID?: string; part?: any }
  | { type: 'error'; sessionID?: string; error?: any };

function toToolSummary(part: any): { content: string; metadata: Record<string, unknown> } {
  const tool = String(part?.tool ?? part?.name ?? 'tool');
  const state = part?.state ?? {};
  const title = typeof state?.title === 'string' && state.title.trim().length > 0 ? state.title.trim() : undefined;
  const input = state?.input ?? {};
  const output = typeof state?.output === 'string' ? state.output : undefined;

  const summary = title
    ? `${tool}: ${title}`
    : `${tool}: ${Object.keys(input).length > 0 ? JSON.stringify(input) : 'completed'}`;

  const meta: Record<string, unknown> = {
    tool_name: tool,
    status: String(state?.status ?? 'completed'),
    ...(Object.keys(input).length > 0 ? { input } : {}),
    ...(output ? { output } : {}),
  };
  return { content: summary, metadata: meta };
}

async function executeOpenCode(
  projectId: string,
  projectPath: string,
  instruction: string,
  model?: string,
  requestId?: string,
) {
  publishStatus(projectId, 'starting', requestId);
  if (requestId) await markUserRequestAsRunning(requestId);

  const absoluteProjectPath = await ensureProjectPath(projectId, projectPath);
  const repoPath = await (async () => {
    const candidate = path.join(absoluteProjectPath, 'repo');
    try {
      const stats = await fs.stat(candidate);
      if (stats.isDirectory()) return candidate;
    } catch {}
    return absoluteProjectPath;
  })();

  publishStatus(projectId, 'ready', requestId, 'OpenCode detected. Starting execution...');

  const args = ['run', '--format', 'json'];
  const trimmedModel = typeof model === 'string' ? model.trim() : '';
  if (trimmedModel.length > 0) {
    args.push('--model', trimmedModel);
  }
  args.push(instruction);
  const child = spawn('opencode', args, { cwd: repoPath, stdio: ['ignore', 'pipe', 'pipe'] });

  const rl = readline.createInterface({ input: child.stdout });
  const stderrBuffer: string[] = [];
  let spawnError: Error | null = null;

  child.stderr?.on('data', (chunk) => {
    const text = String(chunk).trim();
    if (text) stderrBuffer.push(text);
  });

  child.on('error', (error) => {
    spawnError = error instanceof Error ? error : new Error(String(error));
    if (error && 'message' in error) {
      const msg = (error as Error).message;
      if (msg) stderrBuffer.push(msg);
    }
    rl.close();
  });

  publishStatus(projectId, 'running', requestId);

  try {
    for await (const line of rl) {
      const raw = line.trim();
      if (!raw) continue;

      let evt: OpenCodeJsonEvent | null = null;
      try {
        evt = JSON.parse(raw) as OpenCodeJsonEvent;
      } catch {
        // Non-JSON line — ignore
        continue;
      }

      switch (evt.type) {
        case 'tool_use': {
          const part = (evt as any).part;
          const { content, metadata } = toToolSummary(part);
          await dispatchToolMessage(projectId, content, metadata, requestId, { messageType: 'tool_result' });
          break;
        }
        case 'text': {
          const part = (evt as any).part;
          const text = String(part?.text ?? '').trim();
          if (text) {
            const isFinal = Boolean(part?.time?.end);
            await persistMessage(
              projectId,
              { role: 'assistant', messageType: 'chat', content: text, metadata: null },
              requestId,
              isFinal ? { isFinal: true } : { isStreaming: true }
            );
          }
          break;
        }
        case 'step_start':
        case 'step_finish': {
          // Optionally reflect step transitions as lightweight status messages
          break;
        }
        case 'error': {
          const err = (evt as any).error;
          const message = typeof err?.data?.message === 'string' ? err.data.message : (typeof err?.message === 'string' ? err.message : 'OpenCode error');
          await persistMessage(
            projectId,
            { role: 'assistant', messageType: 'error', content: message, metadata: err ?? null },
            requestId,
          );
          break;
        }
        default:
          break;
      }
    }

    if (spawnError) {
      throw spawnError;
    }

    publishStatus(projectId, 'completed', requestId);
    if (requestId) await markUserRequestAsCompleted(requestId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : stderrBuffer.slice(-5).join('\n') || 'OpenCode execution failed';
    publishStatus(projectId, 'completed', requestId, 'OpenCode execution terminated');
    if (requestId) await markUserRequestAsFailed(requestId, message);
    throw error;
  } finally {
    rl.close();
    if (!child.killed) child.kill();
  }
}

export async function initializeNextJsProject(
  projectId: string,
  projectPath: string,
  initialPrompt: string,
  model?: string,
  requestId?: string,
) {
  const fullPrompt = `\nCreate a new Next.js 15 application with the following requirements:\n${initialPrompt}\n\nUse App Router, TypeScript, and Tailwind CSS.\nSet up the basic project structure and implement the requested features.`.trim();
  await executeOpenCode(projectId, projectPath, fullPrompt, model, requestId);
}

export async function applyChanges(
  projectId: string,
  projectPath: string,
  instruction: string,
  model?: string,
  _sessionId?: string,
  requestId?: string,
) {
  await executeOpenCode(projectId, projectPath, instruction, model, requestId);
}
