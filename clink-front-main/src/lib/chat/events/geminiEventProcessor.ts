import {
  extractGeminiText,
  formatGeminiPlan,
} from '../formatters/geminiFormatter';
import {
  ChatEvent,
  EventProcessorOptions,
  MessageBufferHandlers,
} from './types';
import { clientLogger } from '@/lib/client-logger';

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

const extractToolKindFromId = (toolCallId: string): string => {
  // Extract kind from "tool_name-timestamp"
  const match = toolCallId.match(/^([^-]+)/);
  return match ? match[1] : '';
};

const formatGeminiToolCall = (
  update: any,
  toolCallId?: string,
): { toolName: string; primaryArg: string } => {
  const kind = extractToolKindFromId(toolCallId || update?.toolCallId || '');
  const title = update?.title || '';
  const locations = update?.locations || [];
  const contentArray = update?.content || [];

  let toolName = '';
  let primaryArg = '';

  // Extract from locations[0].path
  const getLocationPath = (): string => {
    if (locations.length > 0 && locations[0]?.path) {
      return cleanFilePath(locations[0].path);
    }
    return '';
  };

  // Extract from content[0].path (for write_file)
  const getContentPath = (): string => {
    if (contentArray.length > 0 && contentArray[0]?.path) {
      return cleanFilePath(contentArray[0].path);
    }
    return '';
  };

  // Extract pattern from title like "'pattern' within path"
  const extractPatternFromTitle = (): string => {
    const match = title.match(/['"]([^'"]+)['"]/);
    return match ? match[1] : '';
  };

  switch (kind) {
    case 'write_file':
      toolName = 'Write';
      primaryArg = getContentPath();
      break;

    case 'list_directory':
      toolName = 'Search';
      primaryArg = title;
      break;

    case 'read_file':
      toolName = 'Read';
      primaryArg = title;
      break;

    case 'search_file_content':
      toolName = 'SearchText';
      primaryArg = title;
      break;

    case 'glob':
      toolName = 'Search';
      primaryArg = title;
      break;

    case 'replace':
      toolName = 'Edit';
      primaryArg = getLocationPath();
      break;

    case 'web_fetch':
      toolName = 'Read';
      primaryArg = title;
      break;

    case 'read_many_files':
      toolName = 'ReadManyFiles';
      // Extract pattern from title: "Will attempt to read ... patterns: \n**/*.md\n ..."
      const firstLine = title.split('\n')[0];
      primaryArg = firstLine.replace(':', '').trim();
      break;

    case 'run_shell_command':
      toolName = 'Run Shell';
      // For run_shell_command, we get command from params/arguments
      const commandParams = update.params || update.arguments || {};
      primaryArg = commandParams.command || '';
      break;

    case 'save_memory':
      toolName = 'Save';
      // Extract from content[0].content.text
      if (Array.isArray(contentArray) && contentArray.length > 0 && contentArray[0]?.content?.text) {
        primaryArg = contentArray[0].content.text;
      } else {
        primaryArg = '';
      }
      break;

    case 'google_web_search':
      toolName = 'WebSearch';
      // Remove "Searching the web for: " and quotes
      primaryArg = title
        .replace(/^Searching the web for:\s*/, '')
        .replace(/^["']|["']$/g, '');
      break;

    default:
      toolName = kind
        .split('_')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      primaryArg = getLocationPath() || title || '';
      break;
  }

  return { toolName, primaryArg };
};

export const processGeminiEvent = (
  event: ChatEvent,
  handlers: MessageBufferHandlers,
  options?: EventProcessorOptions,
  triggerPreview?: () => void,
): void => {
  const { sessionId, event: eventName, payload, createdAt } = event;
  const update = payload?.raw?.update ?? payload?.raw;
  const metadata = payload?.metadata ?? {};
  const toolCallId = update?.toolCallId ?? metadata?.toolCallId;

  clientLogger.debug(`[GeminiEventProcessor] Processing event: ${eventName}`, { sessionId, payload });

  const getGeminiToolKey = () => {
    if (toolCallId) {
      return `gemini-tool-${toolCallId}`;
    }
    return 'gemini-tool';
  };

  switch (eventName) {
    case 'gemini.agent_thought_chunk': {
      const state = handlers.getSessionState(sessionId);
      if (state.assistant?.messageId) {
        handlers.finalizeAssistantText(sessionId, '', createdAt);
      }
      const chunk = extractGeminiText(payload?.raw);
      handlers.appendReasoningText(sessionId, chunk, createdAt);
      break;
    }

    case 'gemini.agent_message_chunk': {
      // Finalize any pending reasoning before assistant message
      handlers.finalizeReasoningText(sessionId, '', createdAt);

      const chunk = extractGeminiText(payload?.raw);
      clientLogger.debug(`[GeminiEventProcessor] agent_message_chunk: chunk="${chunk}", sessionId=${sessionId}`);
      handlers.appendAssistantText(sessionId, chunk, createdAt);
      if (!options?.replay && triggerPreview) {
        triggerPreview();
      }
      break;
    }

    case 'gemini.plan': {
      const planText = formatGeminiPlan(update?.entries);
      if (planText) {
        handlers.ensureToolMessage(
          sessionId,
          'gemini-plan',
          createdAt,
          'Gemini Plan',
        );
        handlers.finalizeToolText(
          sessionId,
          'gemini-plan',
          planText,
          createdAt,
        );
      }
      break;
    }

    case 'gemini.tool_call': {
      // Finalize any pending reasoning before tool
      handlers.finalizeReasoningText(sessionId, '', createdAt);

      const key = getGeminiToolKey();
      const kind = extractToolKindFromId(toolCallId || '');

      // Skip write_file, run_shell_command, save_memory (they only send tool_call_update)
      if (kind !== 'write_file' && kind !== 'run_shell_command' && kind !== 'save_memory') {
        const { toolName, primaryArg } = formatGeminiToolCall(update, toolCallId);
        const header = primaryArg ? `[${toolName}] ${primaryArg}` : `[${toolName}]`;

        handlers.appendToolText(sessionId, key, header, createdAt, toolName);
        handlers.finalizeToolText(sessionId, key);
      }
      break;
    }

    case 'gemini.tool_call_update': {
      // write_file, run_shell_command, save_memory only send tool_call_update
      const status = update?.status ?? metadata?.status;
      const kind = extractToolKindFromId(toolCallId || '');

      if (status === 'completed' &&
          (kind === 'write_file' || kind === 'run_shell_command' || kind === 'save_memory')) {
        // Finalize reasoning before tool execution
        handlers.finalizeReasoningText(sessionId, '', createdAt);

        const key = getGeminiToolKey();
        const { toolName, primaryArg } = formatGeminiToolCall(update, toolCallId);
        const header = primaryArg ? `[${toolName}] ${primaryArg}` : `[${toolName}]`;

        handlers.appendToolText(sessionId, key, header, createdAt, toolName);
        handlers.finalizeToolText(sessionId, key);
      }
      break;
    }

    case 'gemini.error': {
      // Finalize any pending reasoning to prevent stuck indicators
      handlers.finalizeReasoningText(sessionId, '', createdAt);
      handlers.finalizeAssistantText(sessionId, '', createdAt);
      break;
    }

    case 'gemini.turn_end': {
      // Finalize any pending messages at turn end
      handlers.finalizeReasoningText(sessionId, '', createdAt);
      handlers.finalizeAssistantText(sessionId, '', createdAt);
      break;
    }

    default:
      break;
  }
};
