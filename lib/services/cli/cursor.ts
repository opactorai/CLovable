/**
 * Cursor Agent CLI service (Node.js adaptation of the original Python adapter).
 *
 * The goal is to stay close to the behaviour implemented in
 * apps/api/app/services/cli/adapters/cursor_agent.py from the main Claudable
 * repository while keeping the implementation straightforward.
 */

import { spawn } from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'crypto';

import type { Message } from '@/types/backend';
import type { RealtimeMessage } from '@/types';

import { streamManager } from '@/lib/services/stream';
import { createMessage } from '@/lib/services/message';
import { getProjectById, updateProject } from '@/lib/services/project';
import { loadGlobalSettings } from '@/lib/services/settings';
import { getDefaultModelForCli } from '@/lib/constants/cliModels';
import {
  CURSOR_DEFAULT_MODEL,
  getCursorModelDisplayName,
  normalizeCursorModelId,
  resolveCursorCliModelId,
} from '@/lib/constants/cursorModels';
import {
  markUserRequestAsRunning,
  markUserRequestAsCompleted,
  markUserRequestAsFailed,
} from '@/lib/services/user-requests';
import { serializeMessage, createRealtimeMessage } from '@/lib/serializers/chat';

type CursorEvent = {
  type?: string;
  subtype?: string;
  message?: {
    content?: Array<{ type?: string; text?: string }>;
  };
  text?: string;
  result?: unknown;
  duration_ms?: number;
  tool_call?: Record<string, unknown>;
  sessionId?: string;
  session_id?: string;
  chatId?: string;
  chat_id?: string;
  threadId?: string;
  thread_id?: string;
  [key: string]: unknown;
};

const CURSOR_EXECUTABLE = process.platform === 'win32' ? 'cursor-agent.cmd' : 'cursor-agent';

const STATUS_LABELS: Record<string, string> = {
  starting: 'Initializing Cursor Agent...',
  ready: 'Cursor Agent detected. Preparing execution...',
  running: 'Cursor Agent is processing the request...',
  completed: 'Cursor Agent execution finished',
};

const AUTO_INSTRUCTIONS = `Act autonomously to complete the task without asking for confirmations.
Work directly inside the provided project directory. Do not create additional top-level folders unless explicitly requested.
Keep responses concise and focus on the code or command outputs that unblock the user.`;

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
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

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

async function appendProjectContext(baseInstruction: string, repoPath: string): Promise<string> {
  try {
    const entries = await fs.readdir(repoPath, { withFileTypes: true });
    const visible = entries
      .filter((entry) => !entry.name.startsWith('.git') && entry.name !== 'AGENTS.md')
      .map((entry) => entry.name);

    if (visible.length === 0) {
      return `${baseInstruction}

<current_project_context>
The repository is currently empty. Work directly in this directory.
</current_project_context>`;
    }

    return `${baseInstruction}

<current_project_context>
Current files in repository: ${visible.sort().join(', ')}
Modify files in-place. Only create new directories if the user instructs you to.
</current_project_context>`;
  } catch {
    return baseInstruction;
  }
}

async function persistMessage(
  projectId: string,
  payload: {
    id?: string;
    role: Message['role'];
    messageType: Message['messageType'];
    content: string;
    metadata?: Record<string, unknown> | null;
  },
  requestId?: string,
  realtimeOverrides?: Partial<RealtimeMessage>,
) {
  try {
    const saved = await createMessage({
      ...(payload.id ? { id: payload.id } : {}),
      projectId,
      role: payload.role,
      messageType: payload.messageType,
      content: payload.content,
      metadata: payload.metadata ?? null,
      cliSource: 'cursor',
      requestId,
    });

    const realtime = serializeMessage(saved, realtimeOverrides);
    streamManager.publish(projectId, {
      type: 'message',
      data: realtime,
    });
  } catch (error) {
    const fallback = createRealtimeMessage({
      id: payload.id ?? undefined,
      projectId,
      role: payload.role,
      messageType: payload.messageType,
      content: payload.content,
      metadata: payload.metadata ?? null,
      cliSource: 'cursor',
      requestId,
      ...realtimeOverrides,
    });

    streamManager.publish(projectId, { type: 'message', data: fallback });
  }
}

function toDisplayString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function dispatchToolMessage(
  projectId: string,
  content: string,
  metadata: Record<string, unknown>,
  requestId?: string,
  messageType: 'tool_use' | 'tool_result' = 'tool_use',
) {
  const normalized = content.trim();
  if (!normalized) {
    return;
  }

  await persistMessage(
    projectId,
    {
      role: 'tool',
      messageType,
      content: normalized,
      metadata: {
        cli_type: 'cursor',
        ...metadata,
      },
    },
    requestId,
  );
}

function extractSessionId(event: CursorEvent): string | undefined {
  const direct =
    event.sessionId ||
    event.session_id ||
    event.chatId ||
    event.chat_id ||
    event.threadId ||
    event.thread_id;

  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }

  const nestedMessage = event.message as Record<string, unknown> | undefined;
  if (nestedMessage) {
    const candidate =
      typeof nestedMessage['sessionId'] === 'string'
        ? nestedMessage['sessionId']
        : typeof nestedMessage['session_id'] === 'string'
        ? nestedMessage['session_id']
        : typeof nestedMessage['chatId'] === 'string'
        ? nestedMessage['chatId']
        : typeof nestedMessage['chat_id'] === 'string'
        ? nestedMessage['chat_id']
        : undefined;
    if (candidate && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}

function extractAssistantText(event: CursorEvent): string {
  const blocks = event.message?.content;
  if (!Array.isArray(blocks)) {
    return '';
  }

  return blocks
    .map((block) => (block?.type === 'text' && typeof block.text === 'string' ? block.text : ''))
    .filter(Boolean)
    .join('');
}

function createAssistantStreamer(projectId: string, requestId?: string) {
  let buffer = '';
  let assistantMessageId: string | null = null;
  let lastStreamedPayload: string | null = null;

  const buildPayload = () => buffer.trim();

  const streamDraft = () => {
    const content = buildPayload();
    if (!content || content === lastStreamedPayload) {
      return;
    }
    const id = assistantMessageId ?? (assistantMessageId = randomUUID());
    const realtime = createRealtimeMessage({
      id,
      projectId,
      role: 'assistant',
      messageType: 'chat',
      content,
      metadata: { cli_type: 'cursor' },
      requestId,
      isStreaming: true,
      isFinal: false,
    });
    streamManager.publish(projectId, { type: 'message', data: realtime });
    lastStreamedPayload = content;
  };

  const append = (text: string) => {
    if (!text) return;
    buffer += text;
    streamDraft();
  };

  const flush = async (force = false) => {
    const content = buildPayload();

    if (!content) {
      if (force) {
        buffer = '';
        assistantMessageId = null;
        lastStreamedPayload = null;
      }
      return;
    }

    const id = assistantMessageId ?? (assistantMessageId = randomUUID());
    lastStreamedPayload = null;

    await persistMessage(
      projectId,
      {
        id,
        role: 'assistant',
        messageType: 'chat',
        content,
        metadata: { cli_type: 'cursor' },
      },
      requestId,
      { isStreaming: false, isFinal: true },
    );

    buffer = '';
    assistantMessageId = null;
  };

  return { append, flush };
}

async function handleToolEvent(
  projectId: string,
  event: CursorEvent,
  requestId: string | undefined,
): Promise<void> {
  const toolCall = event.tool_call;
  if (!toolCall || typeof toolCall !== 'object') {
    return;
  }

  const entries = Object.entries(toolCall);
  if (entries.length === 0) {
    return;
  }

  const [rawName, payload] = entries[0];
  const friendlyName = rawName.replace(/ToolCall$/i, '').replace(/_/g, ' ').trim() || 'tool';
  const args =
    (payload && typeof payload === 'object' && 'args' in payload ? (payload as Record<string, unknown>).args : undefined) ??
    (payload && typeof payload === 'object' && 'value' in payload
      ? ((payload as Record<string, unknown>).value as Record<string, unknown>)?.args
      : undefined);

  if (event.subtype === 'started') {
    const summaryParts = [`Using tool: ${friendlyName}`];
    if (args !== undefined) {
      const prettyArgs = toDisplayString(args).trim();
      if (prettyArgs) {
        summaryParts.push(`Args: ${prettyArgs}`);
      }
    }
    await dispatchToolMessage(
      projectId,
      summaryParts.join('\n'),
      { tool_name: friendlyName, status: 'in_progress' },
      requestId,
      'tool_use',
    );
    return;
  }

  if (event.subtype === 'completed') {
    const result =
      (payload && typeof payload === 'object' && 'result' in payload && (payload as Record<string, unknown>).result) ??
      undefined;

    const success =
      result && typeof result === 'object' && 'success' in (result as Record<string, unknown>)
        ? (result as Record<string, unknown>).success
        : result;
    const failure =
      result && typeof result === 'object' && 'error' in (result as Record<string, unknown>)
        ? (result as Record<string, unknown>).error
        : undefined;

    const body = failure ?? success ?? result ?? 'Tool completed';
    const message = toDisplayString(body).trim() || `Tool ${friendlyName} completed`;

    await dispatchToolMessage(
      projectId,
      message,
      {
        tool_name: friendlyName,
        status: failure ? 'failed' : 'completed',
        ...(failure ? { error: failure } : {}),
        ...(success ? { result: success } : {}),
      },
      requestId,
      'tool_result',
    );
  }
}

async function handleCursorFailure(
  projectId: string,
  requestId: string | undefined,
  stderrLines: string[],
  extraMessage?: string,
) {
  const detailLines = stderrLines.filter((line) => line.trim().length > 0);

  const combined = [
    'Cursor Agent execution failed.',
    ...(extraMessage ? [extraMessage] : []),
    ...(detailLines.length > 0 ? ['', 'Details:', ...detailLines] : []),
  ].join('\n');

  publishStatus(projectId, 'completed', requestId, 'Cursor Agent finished with errors');

  if (requestId) {
    await markUserRequestAsFailed(requestId, combined);
  }

  await persistMessage(
    projectId,
    {
      role: 'assistant',
      messageType: 'chat',
      content: combined,
      metadata: { cli_type: 'cursor', is_error: true },
    },
    requestId,
  );
}

export async function initializeNextJsProject(
  projectId: string,
  projectPath: string,
  initialPrompt: string,
  model: string = CURSOR_DEFAULT_MODEL,
  requestId?: string,
): Promise<void> {
  const fullPrompt = `
Create a new Next.js application with the following requirements:
${initialPrompt}

Use the App Router, TypeScript, and Tailwind CSS.
Set up the project structure and implement the requested features.`.trim();

  await executeCursor(
    projectId,
    projectPath,
    fullPrompt,
    model ?? getDefaultModelForCli('cursor'),
    undefined,
    requestId,
  );
}

export async function applyChanges(
  projectId: string,
  projectPath: string,
  instruction: string,
  model: string = CURSOR_DEFAULT_MODEL,
  sessionId?: string | null,
  requestId?: string,
): Promise<void> {
  await executeCursor(
    projectId,
    projectPath,
    instruction,
    model ?? getDefaultModelForCli('cursor'),
    sessionId ?? undefined,
    requestId,
  );
}

async function executeCursor(
  projectId: string,
  projectPath: string,
  instruction: string,
  model: string,
  sessionId?: string,
  requestId?: string,
): Promise<void> {
  publishStatus(projectId, 'starting', requestId);
  if (requestId) {
    await markUserRequestAsRunning(requestId);
  }

  const absoluteProjectPath = await ensureProjectPath(projectId, projectPath);

  const repoCandidate = path.join(absoluteProjectPath, 'repo');
  const repoPath = await fs
    .access(repoCandidate)
    .then(() => repoCandidate)
    .catch(() => absoluteProjectPath);

  const globalSettings = await loadGlobalSettings();
  const cursorSettings = globalSettings.cli_settings?.cursor ?? {};
  const configuredModel =
    typeof cursorSettings.model === 'string' && cursorSettings.model.trim()
      ? cursorSettings.model
      : undefined;
  const normalizedModel = normalizeCursorModelId(model ?? configuredModel ?? CURSOR_DEFAULT_MODEL);
  const cursorCliModel = resolveCursorCliModelId(normalizedModel);

  const basePrompt = `${AUTO_INSTRUCTIONS.trim()}

User request:
${instruction.trim()}`;
  const finalPrompt = await appendProjectContext(basePrompt, repoPath);

  const args = ['--force', '-p', finalPrompt, '--output-format', 'stream-json'];
  if (cursorCliModel) {
    args.push('-m', cursorCliModel);
  }

  const project = await getProjectById(projectId);
  const storedSessionId =
    sessionId ||
    (project?.activeCursorSessionId && typeof project.activeCursorSessionId === 'string'
      ? project.activeCursorSessionId
      : undefined);

  if (storedSessionId) {
    args.push('--resume', storedSessionId);
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
  };

  if (cursorSettings?.apiKey && typeof cursorSettings.apiKey === 'string' && cursorSettings.apiKey.trim()) {
    env.CURSOR_API_KEY = cursorSettings.apiKey.trim();
  }

  publishStatus(projectId, 'ready', requestId, `Running Cursor Agent (${getCursorModelDisplayName(normalizedModel)})`);

  await persistMessage(
    projectId,
    {
      role: 'system',
      messageType: 'system',
      content: `Running Cursor Agent with model ${getCursorModelDisplayName(normalizedModel)}`,
      metadata: { cli_type: 'cursor', hidden_from_ui: true },
    },
    requestId,
  );

  const child = spawn(CURSOR_EXECUTABLE, args, {
    cwd: repoPath,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stderrLines: string[] = [];
  const assistantStreamer = createAssistantStreamer(projectId, requestId);
  let updatedSessionId = storedSessionId;
  let processError: Error | null = null;

  if (child.stderr) {
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      chunk
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => stderrLines.push(line));
    });
  }

  child.on('error', (error) => {
    processError = error;
    stderrLines.push(error.message);
  });

  publishStatus(projectId, 'running', requestId);

  const rl = child.stdout ? readline.createInterface({ input: child.stdout }) : null;

  if (rl) {
    try {
      for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        let event: CursorEvent | null = null;
        try {
          event = JSON.parse(trimmed) as CursorEvent;
        } catch (error) {
          stderrLines.push(`Failed to parse Cursor output: ${trimmed}`);
        }

        if (!event) {
          continue;
        }

        const candidateSessionId = extractSessionId(event);
        if (candidateSessionId && candidateSessionId !== updatedSessionId) {
          updatedSessionId = candidateSessionId;
          await updateProject(projectId, { activeCursorSessionId: updatedSessionId });
        }

        switch (event.type) {
          case 'assistant': {
            const text = extractAssistantText(event);
            assistantStreamer.append(text);
            break;
          }
          case 'tool_call': {
            await handleToolEvent(projectId, event, requestId);
            break;
          }
          default:
            break;
        }
      }
    } finally {
      rl.close();
    }
  }

  const exitCode: number | null = await new Promise((resolve) => {
    child.on('close', (code) => resolve(code));
  });

  await assistantStreamer.flush(true);

  if (processError || exitCode === null || exitCode !== 0) {
    const extra =
      processError?.message ??
      (exitCode !== null ? `cursor-agent exited with code ${exitCode}` : 'cursor-agent terminated unexpectedly');
    await handleCursorFailure(projectId, requestId, stderrLines, extra);
    return;
  }

  publishStatus(projectId, 'completed', requestId);

  if (requestId) {
    await markUserRequestAsCompleted(requestId);
  }
}
