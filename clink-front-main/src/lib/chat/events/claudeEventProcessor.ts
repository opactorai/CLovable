import {
  extractClaudeText,
  flattenClaudeContent,
} from '../formatters/claudeFormatter';
import {
  ChatEvent,
  EventProcessorOptions,
  MessageBufferHandlers,
  SessionState,
} from './types';
import { parse as parsePartialJson, Allow } from 'partial-json';
import { clientLogger } from '@/lib/client-logger';

// Clean file path by removing workspace path prefixes
const cleanFilePath = (path: string): string => {
  // Remove any /home/daytona/{workspace}/ prefix (template, workspace, project, etc.)
  const cleaned = path.replace(/^\/home\/daytona\/[^/]+\//, '');

  // If path is incomplete (starts with /home/da but not fully formed), hide it
  if (path.startsWith('/home/da') && path === cleaned) {
    // Path wasn't cleaned, meaning it's incomplete - return empty string to hide it
    return '';
  }

  return cleaned;
};

// Extract primary argument from tool input for display
const getPrimaryArg = (toolName: string, input: any): string | null => {
  if (!input || typeof input !== 'object') return null;

  const primaryArgMap: Record<string, string> = {
    Read: 'file_path',
    Write: 'file_path',
    Edit: 'file_path',
    MultiEdit: 'file_path',
    Glob: 'pattern',
    Grep: 'pattern',
    Bash: 'command',
    WebSearch: 'query',
    WebFetch: 'url',
  };

  const key = primaryArgMap[toolName];
  if (!key || !input[key]) return null;

  const value = String(input[key]);

  // Clean file paths
  if (key === 'file_path') {
    return cleanFilePath(value);
  }

  return value;
};

// Try to parse partial JSON and extract primary argument using partial-json library
const tryParsePrimaryArg = (toolName: string, partialJson: string): string | null => {
  if (!partialJson) return null;

  try {
    // Use partial-json library to parse incomplete JSON
    // Allow.ALL enables parsing of partial strings, objects, arrays
    const parsed = parsePartialJson(partialJson, Allow.ALL);

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return getPrimaryArg(toolName, parsed);
  } catch (error) {
    // If partial-json fails, return null
    clientLogger.debug('[tryParsePrimaryArg] Failed to parse partial JSON:', error);
    return null;
  }
};

export const processClaudeEvent = (
  event: ChatEvent,
  state: SessionState,
  handlers: MessageBufferHandlers,
  options?: EventProcessorOptions,
  triggerPreview?: () => void,
): void => {
  const { sessionId, event: eventName, payload, createdAt } = event;
  const claudeEvent = payload?.raw?.event;

  const getClaudeToolKey = (
    eventData: any,
    fallbackId?: string | null,
  ): string | null => {
    const idCandidates = [
      fallbackId,
      eventData?.content_block?.id,
      eventData?.delta?.id,
      eventData?.delta?.tool_use_id,
      eventData?.content_block_id,
      eventData?.id,
    ];
    for (const candidate of idCandidates) {
      if (!candidate) continue;
      const keyName = String(candidate);
      if (!state.claudeBlockKeys[keyName]) {
        state.claudeBlockKeys[keyName] = `claude-tool-${keyName}`;
      }
      return state.claudeBlockKeys[keyName];
    }

    const indexCandidates = [
      eventData?.index,
      eventData?.content_block_index,
      eventData?.delta?.index,
    ];
    for (const candidate of indexCandidates) {
      if (typeof candidate !== 'number') continue;
      const keyName = String(candidate);
      if (!state.claudeBlockKeys[keyName]) {
        state.claudeBlockKeys[keyName] = `claude-tool-index-${keyName}`;
      }
      return state.claudeBlockKeys[keyName];
    }

    return null;
  };

  const registerClaudeKey = (eventData: any, key: string) => {
    const idCandidates = [
      eventData?.content_block?.id,
      eventData?.delta?.id,
      eventData?.delta?.tool_use_id,
      eventData?.content_block_id,
      eventData?.id,
    ];
    idCandidates.forEach((candidate) => {
      if (candidate) {
        state.claudeBlockKeys[String(candidate)] = key;
      }
    });

    const indexCandidates = [
      eventData?.index,
      eventData?.content_block_index,
      eventData?.delta?.index,
    ];
    indexCandidates.forEach((candidate) => {
      if (typeof candidate === 'number') {
        state.claudeBlockKeys[String(candidate)] = key;
      }
    });
  };

  switch (eventName) {
    case 'claude.stream_event.content_block_start': {
      const contentBlock = claudeEvent?.content_block;
      if (!contentBlock) {
        break;
      }

      if (contentBlock.type === 'thinking') {
        handlers.ensureReasoningMessage(sessionId, createdAt);
      }

      if (contentBlock.type === 'tool_use') {
        const key =
          getClaudeToolKey(claudeEvent, contentBlock.id ?? null) ??
          `claude-tool-${contentBlock.id ?? 'tool'}`;
        registerClaudeKey(claudeEvent, key);

        const toolName = contentBlock.name ?? 'Claude Tool';

        // Try to extract primary arg from initial input
        const primaryArg = contentBlock.input
          ? getPrimaryArg(toolName, contentBlock.input)
          : null;

        const title = primaryArg ? `[${toolName}] ${primaryArg}` : undefined;

        // Ensure tool message exists first (creates messageId)
        handlers.ensureToolMessage(sessionId, key, createdAt, title, toolName, {
          createEntry: Boolean(title),
        });

        // Update buffer state
        if (!state.toolMessages[key]) {
          state.toolMessages[key] = {
            content: '',
            toolName,
            rawInput: contentBlock.input || '',
            title,
          };
        } else {
            state.toolMessages[key].toolName = toolName;
            state.toolMessages[key].title = title;
          if (
            contentBlock.input &&
            typeof state.toolMessages[key].rawInput === 'string' &&
            state.toolMessages[key].rawInput!.length === 0
          ) {
            state.toolMessages[key].rawInput = contentBlock.input;
          }
        }

        if (title) {
          handlers.applyToolPreview(sessionId, key, createdAt);
        }
      }
      break;
    }

    case 'claude.stream_event.content_block_delta': {
      const delta = claudeEvent?.delta;
      if (!delta) {
        break;
      }

      if (delta.type === 'thinking_delta') {
        const thinking = delta.thinking ?? flattenClaudeContent(delta);
        handlers.appendReasoningText(sessionId, thinking, createdAt);
      } else if (delta.type === 'text_delta') {
        const textChunk = delta.text ?? flattenClaudeContent(delta);
        handlers.appendAssistantText(sessionId, textChunk, createdAt);
        if (!options?.replay && triggerPreview) {
          triggerPreview();
        }
      } else if (delta.type === 'input_json_delta') {
        const key = getClaudeToolKey(claudeEvent, delta.tool_use_id ?? null);
        if (key && state.toolMessages[key]) {
          registerClaudeKey(claudeEvent, key);
          const chunk =
            typeof delta.partial_json === 'string'
              ? delta.partial_json
              : flattenClaudeContent(delta.delta ?? delta);

          const currentInput = state.toolMessages[key].rawInput;
          const newInput = typeof currentInput === 'string' ? currentInput + chunk : chunk;
          state.toolMessages[key].rawInput = newInput;

          // Try to parse primary arg from partial JSON
          const toolName = state.toolMessages[key].toolName ?? 'Tool';
          const primaryArg = tryParsePrimaryArg(toolName, newInput);

          // Only update title if we don't have one yet
          // Once set by the initial tool_use block, don't overwrite with streaming deltas
          // The final complete title will be set in content_block_stop
          if (primaryArg && !state.toolMessages[key].title) {
            const newTitle = `[${toolName}] ${primaryArg}`;
            state.toolMessages[key].title = newTitle;
            handlers.applyToolPreview(sessionId, key, createdAt);
          }
        }
      }
      break;
    }

    case 'claude.stream_event.content_block_stop': {
      const contentBlock = claudeEvent?.content_block;
      if (contentBlock?.type === 'thinking') {
        handlers.finalizeReasoningText(sessionId, '', createdAt);
        break;
      }

      const key = getClaudeToolKey(
        claudeEvent,
        contentBlock?.id ?? null,
      );
      if (key && state.toolMessages[key]) {
        registerClaudeKey(claudeEvent, key);
        const toolBuffer = state.toolMessages[key];
        const toolName = toolBuffer.toolName ?? 'Claude Tool';

        // Extract primary arg from final input
        let primaryArg: string | null = null;
        if (toolBuffer.rawInput) {
          try {
            const parsed = typeof toolBuffer.rawInput === 'string'
              ? JSON.parse(toolBuffer.rawInput)
              : toolBuffer.rawInput;
            primaryArg = getPrimaryArg(toolName, parsed);
          } catch {
            // Failed to parse, use existing title or default
          }
        }

        const title = primaryArg
          ? `[${toolName}] ${primaryArg}`
          : toolBuffer.title || `[${toolName}]`;

        // Update the buffer title with the final complete path
        toolBuffer.title = title;

        handlers.ensureToolMessage(sessionId, key, createdAt, title, toolName, {
          createEntry: true,
        });
        handlers.applyToolPreview(sessionId, key, createdAt);
        handlers.finalizeToolText(sessionId, key);
      }
      break;
    }

    case 'claude.stream_event.message_stop': {
      handlers.finalizeReasoningText(sessionId, '', createdAt);
      break;
    }

    case 'claude.assistant': {
      const text = extractClaudeText(payload?.raw);
      handlers.finalizeAssistantText(sessionId, text, createdAt);

      const content = payload?.raw?.message?.content ?? [];
      content
        .filter((block: any) => block?.type === 'tool_use')
        .forEach((block: any) => {
          const key =
            getClaudeToolKey({ content_block: block }, block.id ?? null) ??
            `claude-tool-${block.id ?? 'tool'}`;
          registerClaudeKey({ content_block: block }, key);
          const toolName = block.name ?? 'Claude Tool';

          // Extract primary arg from tool input
          const primaryArg = block.input
            ? getPrimaryArg(toolName, block.input)
            : null;

          const title = primaryArg
            ? `[${toolName}] ${primaryArg}`
            : `[${toolName}]`;

          const buffer = handlers.ensureToolMessage(
            sessionId,
            key,
            createdAt,
            title,
            toolName,
          );
          if (block.input && !buffer.rawInput) {
            buffer.rawInput = block.input;
          }
        });
      break;
    }

    case 'claude.user': {
      break;
    }

    default:
      break;
  }
};
