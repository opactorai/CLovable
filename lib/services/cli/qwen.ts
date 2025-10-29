/**
 * Qwen CLI Service
 * Provides thin wrapper around the @qwen-code/qwen-code CLI for autonomous runs.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'crypto';
import type { Message } from '@/types/backend';
import type { RealtimeMessage } from '@/types';
import { getProjectById } from '@/lib/services/project';
import { streamManager } from '@/lib/services/stream';
import { createMessage } from '@/lib/services/message';
import { serializeMessage, createRealtimeMessage } from '@/lib/serializers/chat';
import { getDefaultModelForCli } from '@/lib/constants/cliModels';
import {
  QWEN_DEFAULT_MODEL,
  getQwenModelDisplayName,
  normalizeQwenModelId,
} from '@/lib/constants/qwenModels';
import {
  markUserRequestAsCompleted,
  markUserRequestAsFailed,
  markUserRequestAsRunning,
} from '@/lib/services/user-requests';

const AUTO_INSTRUCTIONS = `Act autonomously without waiting for confirmations.
Use the built-in tools (edit, write_file, read_file, run_shell_command, glob) to modify files directly in the current workspace.
Avoid creating new top-level directories unless the user explicitly asks for it.
Keep output concise and only include code blocks when relevant.
Explain your plan briefly before making changes when helpful.`;

const STATUS_LABELS: Record<string, string> = {
  starting: 'Initializing Qwen CLI...',
  ready: 'Qwen CLI ready',
  running: 'Qwen Coder is processing your request...',
  completed: 'Qwen execution finished',
};

const QWEN_EXECUTABLE = process.platform === 'win32' ? 'qwen.cmd' : 'qwen';

function publishStatus(projectId: string, status: string, requestId?: string, message?: string) {
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

function stripAnsi(input: string): string {
  return input.replace(
    // eslint-disable-next-line no-control-regex
    /\u001b\[[0-9;]*[A-Za-z]/g,
    '',
  );
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
This is an empty project directory. Work directly in the current folder without creating extra subdirectories.
</current_project_context>`;
    }

    return `${baseInstruction}

<current_project_context>
Current files in project directory: ${visible.sort().join(', ')}
Work directly in the current directory. Do not create subdirectories unless specifically requested.
</current_project_context>`;
  } catch (error) {
    console.warn('[QwenService] Failed to append project context:', error);
    return baseInstruction;
  }
}

async function persistAssistantMessage(
  projectId: string,
  payload: {
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
      projectId,
      role: payload.role,
      messageType: payload.messageType,
      content: payload.content,
      metadata: payload.metadata ?? null,
      cliSource: 'qwen',
      requestId,
    });

    streamManager.publish(projectId, {
      type: 'message',
      data: serializeMessage(saved, {
        ...(requestId ? { requestId } : {}),
        ...(realtimeOverrides ?? {}),
      }),
    });
  } catch (error) {
    console.error('[QwenService] Failed to persist message, falling back to realtime broadcast:', error);
    const fallback = createRealtimeMessage({
      projectId,
      role: payload.role,
      messageType: payload.messageType,
      content: payload.content,
      metadata: payload.metadata ?? null,
      cliSource: 'qwen',
      requestId,
      ...(realtimeOverrides ?? {}),
    });
    streamManager.publish(projectId, { type: 'message', data: fallback });
  }
}

function buildQwenEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const additionalPaths: string[] = [];
  const npmGlobal = process.env.NPM_GLOBAL_PATH;
  if (npmGlobal) {
    additionalPaths.push(npmGlobal);
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    const localApp = process.env.LOCALAPPDATA;
    if (appData) {
      additionalPaths.push(path.join(appData, 'npm'));
    }
    if (localApp) {
      additionalPaths.push(path.join(localApp, 'Programs', 'nodejs'));
    }
  }
  if (additionalPaths.length > 0) {
    const existingPath = env.PATH || env.Path || '';
    env.PATH = [...additionalPaths, existingPath].filter(Boolean).join(path.delimiter);
  }

  env.NO_COLOR = '1';
  env.CI = env.CI ?? '1';
  env.QWEN_CODE_AUTO_UPDATE_DISABLED = '1';
  env.QWEN_CODE_TELEMETRY_DISABLED = '1';
  env.GEMINI_CLI_NO_RELAUNCH = '1';
  return env;
}

async function executeQwen(
  projectId: string,
  projectPath: string,
  instruction: string,
  model: string,
  requestId?: string,
): Promise<void> {
  const normalizedModel = normalizeQwenModelId(model);
  const modelDisplayName = getQwenModelDisplayName(normalizedModel);

  publishStatus(projectId, 'starting', requestId);
  if (requestId) {
    await markUserRequestAsRunning(requestId);
  }

  const absoluteProjectPath = await ensureProjectPath(projectId, projectPath);
  const repoPath = await (async () => {
    const candidate = path.join(absoluteProjectPath, 'repo');
    try {
      const stats = await fs.stat(candidate);
      if (stats.isDirectory()) {
        return candidate;
      }
    } catch {
      // ignore missing repo folder
    }
    return absoluteProjectPath;
  })();

  publishStatus(projectId, 'ready', requestId, `Qwen CLI detected (${modelDisplayName}). Starting execution...`);

  const promptBase = `${AUTO_INSTRUCTIONS}\n\n${instruction}`.trim();
  const promptWithContext = await appendProjectContext(promptBase, repoPath);

  const args: string[] = ['--prompt', promptWithContext, '--approval-mode', 'yolo'];

  if (normalizedModel) {
    args.push('--model', normalizedModel);
  }

  publishStatus(projectId, 'running', requestId);

  const env = buildQwenEnv();
  const streamingMessageId = requestId ? `qwen-stream-${requestId}` : `qwen-stream-${randomUUID()}`;
  const streamingCreatedAt = new Date().toISOString();

  const child = spawn(QWEN_EXECUTABLE, args, {
    cwd: repoPath,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdoutBuffer = '';
  let stderrBuffer = '';
  let hasSentStreaming = false;

  const emitStreamingUpdate = (content: string, { isFinal }: { isFinal: boolean }) => {
    const realtime = createRealtimeMessage({
      id: streamingMessageId,
      projectId,
      role: 'assistant',
      messageType: 'chat',
      content,
      metadata: { cli_type: 'qwen' },
      cliSource: 'qwen',
      requestId,
      createdAt: streamingCreatedAt,
      isStreaming: !isFinal,
      isFinal,
      isOptimistic: true,
    });
    streamManager.publish(projectId, { type: 'message', data: realtime });
  };

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    const cleaned = stripAnsi(chunk.replace(/\r/g, ''));
    if (!cleaned) {
      return;
    }
    stdoutBuffer += cleaned;
    hasSentStreaming = true;
    emitStreamingUpdate(stdoutBuffer, { isFinal: false });
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    const cleaned = stripAnsi(chunk.replace(/\r/g, ''));
    stderrBuffer += cleaned;
  });

  const exitCode: number | null = await new Promise((resolve) => {
    child.on('error', (error) => {
      console.error('[QwenService] Failed to start Qwen CLI:', error);
      resolve(-1);
    });
    child.on('close', (code) => {
      resolve(code === null ? -1 : code);
    });
  });

  const trimmedContent = stdoutBuffer.trim();

  if (hasSentStreaming && trimmedContent.length > 0) {
    emitStreamingUpdate(trimmedContent, { isFinal: true });
  }

  if (exitCode === 0) {
    if (trimmedContent.length > 0) {
      await persistAssistantMessage(
        projectId,
        {
          role: 'assistant',
          messageType: 'chat',
          content: trimmedContent,
          metadata: { cli_type: 'qwen' },
        },
        requestId,
        { id: streamingMessageId, isStreaming: false, isFinal: true, isOptimistic: false },
      );
    }

    publishStatus(projectId, 'completed', requestId, 'Qwen execution completed successfully');
    if (requestId) {
      await markUserRequestAsCompleted(requestId);
    }
    return;
  }

  const errorMessage =
    stderrBuffer.trim().split('\n').slice(-5).join('\n') ||
    (exitCode === -1 ? 'Failed to launch Qwen CLI' : `Qwen CLI exited with status ${exitCode}`);

  publishStatus(projectId, 'completed', requestId, 'Qwen execution ended with errors');
  if (requestId) {
    await markUserRequestAsFailed(requestId, errorMessage);
  }

  await persistAssistantMessage(
    projectId,
    {
      role: 'assistant',
      messageType: 'chat',
      content: trimmedContent
        ? `${trimmedContent}\n\n⚠️ Qwen CLI reported an error:\n${errorMessage}`
        : `⚠️ Qwen CLI reported an error:\n${errorMessage}`,
      metadata: {
        cli_type: 'qwen',
        error: true,
      },
    },
    requestId,
    { id: streamingMessageId, isStreaming: false, isFinal: true, isOptimistic: false },
  );
}

export async function initializeNextJsProject(
  projectId: string,
  projectPath: string,
  initialPrompt: string,
  model: string = QWEN_DEFAULT_MODEL,
  requestId?: string,
): Promise<void> {
  const fullPrompt = `
Create a new Next.js 15 application with the following requirements:
${initialPrompt}

Use App Router, TypeScript, and Tailwind CSS.
Set up the basic project structure and implement the requested features.`.trim();

  await executeQwen(
    projectId,
    projectPath,
    fullPrompt,
    model ?? getDefaultModelForCli('qwen'),
    requestId,
  );
}

export async function applyChanges(
  projectId: string,
  projectPath: string,
  instruction: string,
  model: string = QWEN_DEFAULT_MODEL,
  _sessionId?: string,
  requestId?: string,
): Promise<void> {
  await executeQwen(
    projectId,
    projectPath,
    instruction,
    model ?? getDefaultModelForCli('qwen'),
    requestId,
  );
}
