/**
 * GLM CLI Service
 * Minimal Claude Agent SDK integration configured for Zhipu GLM models.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { Message } from '@/types/backend';
import type { RealtimeMessage } from '@/types';
import { streamManager } from '@/lib/services/stream';
import { createMessage } from '@/lib/services/message';
import { getProjectById } from '@/lib/services/project';
import { serializeMessage, createRealtimeMessage } from '@/lib/serializers/chat';
import { loadGlobalSettings } from '@/lib/services/settings';
import {
  markUserRequestAsRunning,
  markUserRequestAsCompleted,
  markUserRequestAsFailed,
} from '@/lib/services/user-requests';
import {
  GLM_DEFAULT_MODEL,
  getGLMModelDisplayName,
  normalizeGLMModelId,
} from '@/lib/constants/glmModels';

const GLM_ANTHROPIC_BASE_URL =
  process.env.GLM_ANTHROPIC_BASE_URL?.trim() || 'https://api.z.ai/api/anthropic';
const GLM_API_TIMEOUT_MS = process.env.GLM_API_TIMEOUT_MS?.trim() || '3000000';

const STATUS_LABELS: Record<string, string> = {
  starting: 'Initializing GLM agent...',
  ready: 'GLM runtime ready',
  running: 'GLM is processing your request...',
  completed: 'GLM execution completed',
};

const AUTO_INSTRUCTIONS = `Act autonomously without waiting for confirmations.
You are the GLM CLI assistant. Refer to yourself as GLM, not Claude.
Work directly inside the current workspace (Next.js App Router with TypeScript and Tailwind CSS).
Use Claude Code compatible tools to read, modify, and create files. Prefer apply_patch style edits when changing existing files.
Do not create new top-level directories unless explicitly requested.
Avoid running package managers or starting development servers; the platform handles previews.
Explain your intent briefly when helpful, then take concrete actions until the task is complete.`;

type StreamAccumulator = {
  id: string;
  content: string;
  createdAt: string;
  isStreaming: boolean;
};

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
This is an empty project directory. Work directly in the current folder without creating extra subdirectories.
</current_project_context>`;
    }

    return `${baseInstruction}

<current_project_context>
Current files in project directory: ${visible.sort().join(', ')}
Work directly in the current directory. Do not create subdirectories unless specifically requested.
</current_project_context>`;
  } catch (error) {
    console.warn('[GLMService] Failed to append project context:', error);
    return baseInstruction;
  }
}

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

async function persistAssistantMessage(
  projectId: string,
  payload: {
    role: Message['role'];
    messageType: Message['messageType'];
    content: string;
    metadata?: Record<string, unknown> | null;
  },
  requestId?: string,
  overrides?: Partial<RealtimeMessage>,
) {
  let lastError: Error | null = null;

  // Retry logic with exponential backoff
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const saved = await createMessage({
        projectId,
        role: payload.role,
        messageType: payload.messageType,
        content: payload.content,
        metadata: payload.metadata ?? null,
        cliSource: 'glm',
        requestId,
      });

      streamManager.publish(projectId, {
        type: 'message',
        data: serializeMessage(saved, {
          ...(requestId ? { requestId } : {}),
          ...(overrides ?? {}),
        }),
      });

      console.log(`[GLMService] Successfully persisted message on attempt ${attempt}`);
      return; // Success, exit the function
    } catch (error) {
      lastError = error as Error;
      console.error(`[GLMService] Attempt ${attempt} failed to persist assistant message:`, error);

      if (attempt < 3) {
        // Exponential backoff: 1s, 2s
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        console.log(`[GLMService] Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries failed, fallback to realtime emit
  console.error('[GLMService] All retry attempts failed. Falling back to realtime emit:', lastError);
  const fallback = createRealtimeMessage({
    projectId,
    role: payload.role,
    messageType: payload.messageType,
    content: payload.content,
    metadata: payload.metadata ?? null,
    cliSource: 'glm',
    requestId,
    ...(overrides ?? {}),
  });
  streamManager.publish(projectId, {
    type: 'message',
    data: fallback,
  });
}

async function persistToolMessage(
  projectId: string,
  content: string,
  metadata: Record<string, unknown>,
  requestId?: string,
  options: { persist?: boolean; isStreaming?: boolean; messageType?: 'tool_use' | 'tool_result' } = {},
) {
  const trimmed = content.trim();
  if (!trimmed) return;

  const { persist = true, isStreaming = false, messageType = 'tool_use' } = options;
  const enrichedMetadata: Record<string, unknown> = {
    cli_type: 'glm',
    ...metadata,
  };

  if (!persist) {
    const realtime = createRealtimeMessage({
      projectId,
      role: 'tool',
      messageType,
      content: trimmed,
      metadata: enrichedMetadata,
      cliSource: 'glm',
      requestId,
      isStreaming,
      isFinal: !isStreaming,
    });
    streamManager.publish(projectId, { type: 'message', data: realtime });
    return;
  }

  await persistAssistantMessage(
    projectId,
    {
      role: 'tool',
      messageType,
      content: trimmed,
      metadata: enrichedMetadata,
    },
    requestId,
    { isStreaming, isFinal: !isStreaming },
  );
}

function createStreamAccumulator(requestId?: string): StreamAccumulator {
  return {
    id: requestId ? `glm-stream-${requestId}` : `glm-stream-${randomUUID()}`,
    content: '',
    createdAt: new Date().toISOString(),
    isStreaming: false,
  };
}

function emitStreamingUpdate(projectId: string, accumulator: StreamAccumulator, requestId?: string, isFinal: boolean = false) {
  const realtime = createRealtimeMessage({
    id: accumulator.id,
    projectId,
    role: 'assistant',
    messageType: 'chat',
    content: accumulator.content,
    metadata: { cli_type: 'glm' },
    cliSource: 'glm',
    requestId,
    createdAt: accumulator.createdAt,
    isStreaming: !isFinal,
    isFinal,
    isOptimistic: true,
  });
  streamManager.publish(projectId, { type: 'message', data: realtime });
  accumulator.isStreaming = !isFinal;
}

function extractTextDelta(delta: unknown): string {
  if (typeof delta === 'string') {
    return delta;
  }
  if (!delta || typeof delta !== 'object') {
    return '';
  }
  const record = delta as Record<string, unknown>;
  if (typeof record.text === 'string') {
    return record.text;
  }
  if (typeof record.delta === 'string') {
    return record.delta;
  }
  if (typeof record.partial === 'string') {
    return record.partial;
  }
  return '';
}

async function executeGLM(
  projectId: string,
  projectPath: string,
  instruction: string,
  model: string,
  sessionId?: string,
  requestId?: string,
): Promise<void> {
  const normalizedModel = normalizeGLMModelId(model);
  const modelDisplayName = getGLMModelDisplayName(normalizedModel);

  let configuredApiKey: string | undefined;
  try {
    const globalSettings = await loadGlobalSettings();
    const glmSettings = globalSettings.cli_settings?.glm;
    if (glmSettings && typeof glmSettings === 'object') {
      const candidate = (glmSettings as Record<string, unknown>).apiKey;
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        configuredApiKey = candidate.trim();
      }
    }
  } catch (error) {
    console.warn('[GLMService] Failed to load GLM settings:', error);
  }

  const applyApiKey = (apiKey?: string) => {
    const envUpdates: Record<string, string | undefined> = {};

    if (apiKey) {
      const apiKeyTargets = [
        'ZHIPU_API_KEY',
        'ZHIPUAI_API_KEY',
        'GLM_API_KEY',
        'ZAI_API_KEY',
        'ANTHROPIC_AUTH_TOKEN',
        'ANTHROPIC_API_KEY',
      ];
      for (const key of apiKeyTargets) {
        envUpdates[key] = apiKey;
      }
    }

    if (!process.env.ANTHROPIC_BASE_URL) {
      envUpdates.ANTHROPIC_BASE_URL = GLM_ANTHROPIC_BASE_URL;
    }

    if (!process.env.API_TIMEOUT_MS) {
      envUpdates.API_TIMEOUT_MS = GLM_API_TIMEOUT_MS;
    }

    if (!process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC) {
      envUpdates.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';
    }

    const previousValues: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(envUpdates)) {
      previousValues[key] = process.env[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    return () => {
      for (const [key, previous] of Object.entries(previousValues)) {
        if (previous === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = previous;
        }
      }
    };
  };

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
      // ignore
    }
    return absoluteProjectPath;
  })();

  publishStatus(projectId, 'ready', requestId, `GLM detected (${modelDisplayName}). Starting execution...`);

  const promptBase = `${AUTO_INSTRUCTIONS}\n\n${instruction}`.trim();
  const promptWithContext = await appendProjectContext(promptBase, repoPath);

  const accumulator = createStreamAccumulator(requestId);
  const stderrBuffer: string[] = [];
  const toolNameById = new Map<string, string>();
  const emittedToolMessages = new Set<string>();

  const emitToolMessage = async (
    content: string,
    metadata: Record<string, unknown>,
    options: { persist?: boolean; isStreaming?: boolean; messageType?: 'tool_use' | 'tool_result' } = {},
  ) => {
    const baseMetadata = {
      ...metadata,
    };

    const toolIdentifier =
      (typeof baseMetadata.toolUseId === 'string' && baseMetadata.toolUseId) ||
      (typeof baseMetadata.tool_name === 'string' && baseMetadata.tool_name) ||
      (typeof baseMetadata.toolName === 'string' && baseMetadata.toolName) ||
      '';
    const messageType = options.messageType ?? 'tool_use';
    const trimmedContent = content.trim();
    const dedupeKey = `${messageType}|${toolIdentifier}|${trimmedContent}`;

    if (dedupeKey.trim().length > 0) {
      if (emittedToolMessages.has(dedupeKey)) {
        return;
      }
      emittedToolMessages.add(dedupeKey);
    }

    await persistToolMessage(projectId, content, baseMetadata, requestId, options);
  };

  const maxOutputTokens = Number(process.env.GLM_MAX_OUTPUT_TOKENS ?? '3200');

  const restoreApiKey = applyApiKey(configuredApiKey);

  try {
    publishStatus(projectId, 'running', requestId);

    const response = query({
      prompt: promptWithContext,
      options: {
        cwd: repoPath,
        additionalDirectories: [repoPath],
        model: normalizedModel,
        resume: sessionId,
        maxOutputTokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : 3200,
        settingSources: ['user'],
        permissionMode: 'bypassPermissions',
        stderr: (data: string) => {
          const line = String(data).trimEnd();
          if (line) {
            if (stderrBuffer.length > 200) stderrBuffer.shift();
            stderrBuffer.push(line);
            console.error(`[GLMService][stderr] ${line}`);
          }
        },
      } as any,
    });

    for await (const message of response) {
      if (message.type === 'stream_event') {
        const event: Record<string, unknown> = (message as any).event ?? {};
        const eventType = typeof event.type === 'string' ? event.type : '';

        switch (eventType) {
          case 'message_start': {
            accumulator.content = '';
            accumulator.isStreaming = false;
            break;
          }
          case 'content_block_start': {
            const block = event.content_block as Record<string, unknown> | undefined;
            if (block && block.type === 'tool_use') {
              const toolName = typeof block.name === 'string' ? block.name : 'tool';
              const toolUseIdValue = block.id ?? block.tool_use_id ?? block.toolUseId;
              const toolUseId = typeof toolUseIdValue === 'string' ? toolUseIdValue : undefined;
              if (toolUseId) {
                toolNameById.set(toolUseId, toolName);
              }
              const metadata: Record<string, unknown> = {
                toolName,
                tool_name: toolName,
                ...(toolUseId ? { toolUseId } : {}),
              };
              if (block.input !== undefined) {
                metadata.toolInput = block.input;
              }
              await emitToolMessage(
                `Using tool: ${toolName}`,
                metadata,
                { persist: false, isStreaming: true, messageType: 'tool_use' },
              );
            }
            break;
          }
          case 'content_block_delta': {
            const textChunk = extractTextDelta(event.delta);
            if (textChunk) {
              accumulator.content += textChunk;
              emitStreamingUpdate(projectId, accumulator, requestId, false);
            }
            break;
          }
          case 'content_block_stop': {
            const block = event.content_block as Record<string, unknown> | undefined;
            if (block && block.type === 'tool_use') {
              const toolName = typeof block.name === 'string' ? block.name : 'tool';
              const toolUseIdValue = block.id ?? block.tool_use_id ?? block.toolUseId;
              const toolUseId = typeof toolUseIdValue === 'string' ? toolUseIdValue : undefined;
              if (toolUseId) {
                toolNameById.set(toolUseId, toolName);
              }
              const metadata: Record<string, unknown> = {
                toolName,
                tool_name: toolName,
                ...(toolUseId ? { toolUseId } : {}),
              };
              await emitToolMessage(
                `Finished using tool: ${toolName}`,
                metadata,
                { persist: true, isStreaming: false, messageType: 'tool_result' },
              );
            }
            break;
          }
          case 'message_stop': {
            if (accumulator.content.trim().length > 0) {
              emitStreamingUpdate(projectId, accumulator, requestId, true);
              await persistAssistantMessage(
                projectId,
                {
                  role: 'assistant',
                  messageType: 'chat',
                  content: accumulator.content.trim(),
                  metadata: { cli_type: 'glm' },
                },
                requestId,
                { isStreaming: false, isFinal: true, isOptimistic: false },
              );
              accumulator.content = '';
            }
            break;
          }
          case 'tool_result': {
            const payload = event.output ?? event.result ?? event;
            const rawToolName = event.tool_name ?? event.toolName;
            let resultText: string;
            if (typeof payload === 'string') {
              resultText = payload;
            } else if (Array.isArray(payload)) {
              resultText = payload
                .filter((entry): entry is string => typeof entry === 'string')
                .join('\n');
            } else if (payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>).text === 'string') {
              resultText = (payload as Record<string, unknown>).text as string;
            } else {
              try {
                resultText = JSON.stringify(payload ?? {});
              } catch {
                resultText = String(payload ?? '');
              }
            }
            const toolName = typeof rawToolName === 'string' ? rawToolName : 'tool';
            const toolUseIdValue = event.tool_use_id ?? event.toolUseId ?? event.id;
            const toolUseId = typeof toolUseIdValue === 'string' ? toolUseIdValue : undefined;
            if (toolUseId && !toolNameById.has(toolUseId)) {
              toolNameById.set(toolUseId, toolName);
            }
            const metadata: Record<string, unknown> = {
              toolName,
              tool_name: toolName,
              ...(toolUseId ? { toolUseId } : {}),
            };
            await emitToolMessage(
              resultText,
              metadata,
              { persist: true, isStreaming: false, messageType: 'tool_result' },
            );
            break;
          }
          default:
            // noop for other event types
            break;
        }
      } else if (message.type === 'assistant') {
        const assistantRecord = (message as any).message as Record<string, unknown> | undefined;
        const contentBlocks = Array.isArray(assistantRecord?.content) ? (assistantRecord!.content as unknown[]) : [];
        let appendedText = false;

        for (const block of contentBlocks) {
          if (!block || typeof block !== 'object') continue;
          const blockRecord = block as Record<string, unknown>;
          const blockType = typeof blockRecord.type === 'string' ? blockRecord.type : '';

          if (blockType === 'text') {
            const text = typeof blockRecord.text === 'string' ? blockRecord.text : '';
            if (text) {
              accumulator.content += text;
              appendedText = true;
            }
          } else if (blockType === 'tool_use') {
            const toolName = typeof blockRecord.name === 'string' ? blockRecord.name : 'tool';
            const toolUseIdValue = blockRecord.id ?? blockRecord.tool_use_id ?? blockRecord.toolUseId;
            const toolUseId = typeof toolUseIdValue === 'string' ? toolUseIdValue : undefined;
            if (toolUseId) {
              toolNameById.set(toolUseId, toolName);
            }
            const metadata: Record<string, unknown> = {
              toolName,
              tool_name: toolName,
              ...(toolUseId ? { toolUseId } : {}),
            };
            if (blockRecord.input !== undefined) {
              metadata.toolInput = blockRecord.input;
            }
            await emitToolMessage(
              `Using tool: ${toolName}`,
              metadata,
              { persist: false, isStreaming: true, messageType: 'tool_use' },
            );
          }
        }

        if (appendedText) {
          emitStreamingUpdate(projectId, accumulator, requestId, false);
        }
      } else if (message.type === 'user') {
        const userRecord = (message as any).message as Record<string, unknown> | undefined;
        const contentBlocks = Array.isArray(userRecord?.content) ? (userRecord!.content as unknown[]) : [];

        for (const block of contentBlocks) {
          if (!block || typeof block !== 'object') continue;
          const blockRecord = block as Record<string, unknown>;
          const blockType = typeof blockRecord.type === 'string' ? blockRecord.type : '';

          if (blockType === 'tool_result') {
            const toolUseIdValue = blockRecord.tool_use_id ?? blockRecord.toolUseId ?? blockRecord.id;
            const toolUseId = typeof toolUseIdValue === 'string' ? toolUseIdValue : undefined;
            const toolName = toolUseId ? toolNameById.get(toolUseId) : undefined;
            const metadata: Record<string, unknown> = {
              ...(toolName ? { toolName, tool_name: toolName } : {}),
              ...(toolUseId ? { toolUseId } : {}),
            };

            const rawContent = blockRecord.content ?? blockRecord.result ?? blockRecord.output;
            let resultText: string;
            if (typeof rawContent === 'string') {
              resultText = rawContent;
            } else if (Array.isArray(rawContent)) {
              resultText = rawContent
                .map((entry) => (typeof entry === 'string' ? entry : ''))
                .filter((entry) => entry.length > 0)
                .join('\n');
            } else if (rawContent && typeof rawContent === 'object') {
              try {
                resultText = JSON.stringify(rawContent, null, 2);
              } catch {
                resultText = String(rawContent);
              }
            } else {
              resultText = '';
            }

            await emitToolMessage(
              resultText,
              metadata,
              { persist: true, isStreaming: false, messageType: 'tool_result' },
            );
          }
        }
      } else if (message.type === 'result') {
        const resultRecord = message as Record<string, unknown>;
        const output = resultRecord.output ?? resultRecord.content;
        if (!accumulator.content.trim() && typeof output === 'string' && output.trim().length > 0) {
          accumulator.content = output.trim();
          emitStreamingUpdate(projectId, accumulator, requestId, true);
          await persistAssistantMessage(
            projectId,
            {
              role: 'assistant',
              messageType: 'chat',
              content: accumulator.content,
              metadata: { cli_type: 'glm' },
            },
            requestId,
            { isStreaming: false, isFinal: true, isOptimistic: false },
          );
        }
        publishStatus(projectId, 'completed', requestId);
        if (requestId) {
          await markUserRequestAsCompleted(requestId);
        }
      }
    }

    // If stream finished without emitting final message
    if (accumulator.content.trim().length > 0) {
      emitStreamingUpdate(projectId, accumulator, requestId, true);
      await persistAssistantMessage(
        projectId,
        {
          role: 'assistant',
          messageType: 'chat',
          content: accumulator.content.trim(),
          metadata: { cli_type: 'glm' },
        },
        requestId,
        { isStreaming: false, isFinal: true, isOptimistic: false },
      );
      accumulator.content = '';
    }

    publishStatus(projectId, 'completed', requestId);
    if (requestId) {
      await markUserRequestAsCompleted(requestId);
    }
  } catch (error) {
    const stderrTail = stderrBuffer.slice(-15).join('\n');
    let errorMessage =
      error instanceof Error
        ? error.message
        : stderrTail || 'GLM execution failed';

    const hasTail = Boolean(stderrTail);

    if (/process exited with code\s+\d+/i.test(errorMessage)) {
      const exitCodeMatch = errorMessage.match(/process exited with code\s+(\d+)/i);
      const exitCode = exitCodeMatch?.[1] ?? '1';
      errorMessage = [
        `Claude Code runtime exited with code ${exitCode}.`,
        'Verify the Z.AI DevPack Claude runtime is installed and authenticated:',
        '1. Install: `zai devpack install claude` (if not already).',
        '2. Login: `zai auth login` (makes sure your GLM account is active).',
        '3. Confirm the binary: `claude --version` and run `claude update` if prompted.',
        '4. Ensure a valid GLM API key is configured (Settings → AI Agents → GLM CLI or set `ZHIPU_API_KEY`).',
      ].join('\n');
    } else if (/ENOENT|command not found|no such file or directory/i.test(errorMessage)) {
      errorMessage = [
        'Unable to launch Claude Code runtime for GLM.',
        'Ensure the DevPack CLI is installed and available on your PATH:',
        '- Install: `zai devpack install claude`',
        '- Verify: `claude --version`',
        '- Restart Claudable after installation',
      ].join('\n');
    }

    if (hasTail && !errorMessage.includes('Detailed log:')) {
      errorMessage = `${errorMessage}\n\nDetailed log:\n${stderrTail}`;
    }

    publishStatus(projectId, 'completed', requestId, 'GLM execution ended with errors');
    if (requestId) {
      await markUserRequestAsFailed(requestId, errorMessage);
    }

    await persistAssistantMessage(
      projectId,
      {
        role: 'assistant',
        messageType: 'chat',
        content: `⚠️ GLM reported an error:\n${errorMessage}`,
        metadata: { cli_type: 'glm', error: true },
      },
      requestId,
      { isStreaming: false, isFinal: true, isOptimistic: false },
    );

    throw error instanceof Error ? error : new Error(errorMessage);
  } finally {
    try {
      restoreApiKey();
    } catch (cleanupError) {
      console.warn('[GLMService] Failed to restore GLM API key env:', cleanupError);
    }
  }
}

export async function initializeNextJsProject(
  projectId: string,
  projectPath: string,
  initialPrompt: string,
  model: string = GLM_DEFAULT_MODEL,
  requestId?: string,
): Promise<void> {
  const fullPrompt = `
Create a new Next.js 15 application with the following requirements:
${initialPrompt}

Use App Router, TypeScript, and Tailwind CSS.
Set up the basic project structure and implement the requested features.`.trim();

  await executeGLM(projectId, projectPath, fullPrompt, model, undefined, requestId);
}

export async function applyChanges(
  projectId: string,
  projectPath: string,
  instruction: string,
  model: string = GLM_DEFAULT_MODEL,
  sessionId?: string,
  requestId?: string,
): Promise<void> {
  await executeGLM(projectId, projectPath, instruction, model, sessionId, requestId);
}
