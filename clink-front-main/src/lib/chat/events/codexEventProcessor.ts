import {
  ChatEvent,
  EventProcessorOptions,
  MessageBufferHandlers,
  EventProcessorDependencies,
} from './types';

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

/**
 * Detects integration requirement markers in messages
 * Marker format: [INTEGRATION_REQUIRED:supabase] or [INTEGRATION_REQUIRED:github]
 * Also detects heuristic patterns when explicit marker is missing
 */
const detectIntegrationMarker = (
  content: string,
  integrationsHint?: { supabaseConnected?: boolean; githubConnected?: boolean }
): {
  hasMarker: boolean;
  integration?: 'supabase' | 'github';
  cleanContent: string;
  isHeuristic?: boolean;
} => {
  // First, try to detect explicit marker
  const markerRegex = /\[INTEGRATION_REQUIRED:(supabase|github)\]\s*/i;
  const match = content.match(markerRegex);

  if (match) {
    const integration = match[1].toLowerCase() as 'supabase' | 'github';
    const cleanContent = content.replace(markerRegex, '').trim();
    return {
      hasMarker: true,
      integration,
      cleanContent,
      isHeuristic: false,
    };
  }

  // Fallback: Use heuristic detection for common patterns
  const contentLower = content.toLowerCase();

  // Supabase heuristics
  const supabasePatterns = [
    /\bsupabase\b.*\bnot\s+connected\b/i,
    /\bplease\s+connect\s+supabase\b/i,
    /\bconnect\s+supabase\b.*\bsettings\b.*\bintegrations\b/i,
    /\bi\s+(?:still\s+)?don't\s+see\s+(?:a\s+)?supabase\s+connection\b/i,
    /\bsupabase\b.*\bsettings\s*→\s*integrations\b/i,
  ];

  const supabaseDetected = supabasePatterns.some(pattern => pattern.test(content));

  // Only trigger if we know from hint that Supabase is NOT connected
  if (supabaseDetected && integrationsHint?.supabaseConnected === false) {
    return {
      hasMarker: true,
      integration: 'supabase',
      cleanContent: content,
      isHeuristic: true,
    };
  }

  // GitHub heuristics
  const githubPatterns = [
    /\bgithub\b.*\bnot\s+connected\b/i,
    /\bplease\s+connect\s+github\b/i,
    /\bconnect\s+github\b.*\bsettings\b.*\bintegrations\b/i,
    /\bgithub\b.*\bsettings\s*→\s*integrations\b/i,
  ];

  const githubDetected = githubPatterns.some(pattern => pattern.test(content));

  // Only trigger if we know from hint that GitHub is NOT connected
  if (githubDetected && integrationsHint?.githubConnected === false) {
    return {
      hasMarker: true,
      integration: 'github',
      cleanContent: content,
      isHeuristic: true,
    };
  }

  return {
    hasMarker: false,
    cleanContent: content,
    isHeuristic: false,
  };
};

const formatToolTitle = (label: string, primaryArg?: string | null): string => {
  const normalizedLabel = label && label.length > 0 ? label : 'Tool';
  const normalizedArg =
    primaryArg && primaryArg.length > 0 ? primaryArg.trim() : null;

  if (normalizedLabel === 'Run') {
    return normalizedArg && normalizedArg.length > 0
      ? `Run ${normalizedArg}`
      : 'Run';
  }

  return normalizedArg && normalizedArg.length > 0
    ? `[${normalizedLabel}] ${normalizedArg}`
    : `[${normalizedLabel}]`;
};

const extractToolCallId = (raw: Record<string, any>): string | null => {
  const candidates = [
    raw?.toolCallId,
    raw?.itemId,
    raw?.id,
    raw?.tool_call_id,
    raw?.call_id,
    raw?.item?.id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

  return null;
};

export const processCodexEvent = (
  event: ChatEvent,
  handlers: MessageBufferHandlers,
  deps: EventProcessorDependencies,
  options?: EventProcessorOptions,
): void => {
  const { sessionId, event: eventName, payload, createdAt } = event;
  const raw = payload?.raw ?? {};

  switch (eventName) {
    case 'codex.message_start': {
      handlers.ensureAssistantMessage(sessionId, createdAt);
      break;
    }

    case 'codex.message_end': {
      const text =
        typeof raw?.text === 'string'
          ? raw.text
          : typeof raw?.message === 'string'
            ? raw.message
            : '';

      // Detect integration requirement markers in the completed text
      if (text.length > 0) {
        const markerDetection = detectIntegrationMarker(text, deps.integrationsHint);

        // If integration marker detected, create integration_prompt message instead
        if (markerDetection.hasMarker && markerDetection.integration && !options?.replay) {
          const state = handlers.getSessionState(sessionId);
          const assistantMessageId = state.assistant.messageId;

          // Reset the assistant message buffer
          handlers.resetAssistantMessage(sessionId);

          const timestamp = createdAt ? new Date(createdAt) : new Date();
          const messageId = `${sessionId}-integration-marker-${event.sequence}`;

          const integrationName = markerDetection.integration.charAt(0).toUpperCase() + markerDetection.integration.slice(1);
          const buttonText = `Click here to add your ${integrationName} credentials`;

          deps.setMessages((prev) => {
            // Remove the assistant message that was created during delta streaming
            const withoutAssistant = assistantMessageId
              ? prev.filter(msg => msg.id !== assistantMessageId)
              : prev;

            const nextMessage = {
              id: messageId,
              role: 'assistant' as const,
              content: markerDetection.cleanContent,
              timestamp,
              variant: 'integration_prompt' as const,
              actionData: {
                type: 'open_integration' as const,
                integration: markerDetection.integration!,
                buttonText,
              },
            };

            return [...withoutAssistant, nextMessage];
          });

          deps.triggerPreview();
          break;
        }
      }

      handlers.finalizeAssistantText(sessionId, text, createdAt);
      break;
    }

    case 'codex.reasoning_start': {
      handlers.ensureReasoningMessage(sessionId, createdAt);
      break;
    }

    case 'codex.reasoning_end': {
      handlers.finalizeReasoningText(sessionId, '', createdAt);
      break;
    }

    case 'codex.tool_call_start': {
      const toolCallId = extractToolCallId(raw);
      if (!toolCallId) {
        break;
      }
      const label =
        typeof raw?.label === 'string' && raw.label.length > 0
          ? raw.label
          : typeof raw?.rawToolName === 'string' && raw.rawToolName.length > 0
            ? raw.rawToolName
            : typeof payload?.metadata?.toolName === 'string'
              ? payload.metadata.toolName
              : 'Tool';
      let primaryArg =
        typeof raw?.primaryArg === 'string' ? raw.primaryArg : null;
      
      // Clean file paths from primaryArg
      if (primaryArg && ['Read', 'Write', 'Edit', 'MultiEdit', 'Delete'].includes(label)) {
        primaryArg = cleanFilePath(primaryArg);
      }
      
      const title = formatToolTitle(label, primaryArg);
      const key = `codex-tool-${toolCallId}`;
      const buffer = handlers.ensureToolMessage(
        sessionId,
        key,
        createdAt,
        title,
        label,
      );

      const command =
        typeof raw?.command === 'string'
          ? raw.command
          : Array.isArray(raw?.command)
            ? raw.command.join(' ')
            : null;

      if (buffer) {
        if (label === 'Run' && command) {
          buffer.rawInput = command;
          handlers.applyToolPreview(sessionId, key, createdAt);
        } else if (
          (!buffer.rawInput || buffer.rawInput === '') &&
          typeof primaryArg === 'string' &&
          primaryArg.trim().length > 0
        ) {
          const normalized = primaryArg.trim();
          if (
            ['Read', 'Write', 'Edit', 'MultiEdit', 'Delete'].includes(label)
          ) {
            buffer.rawInput = { file_path: normalized };
            handlers.applyToolPreview(sessionId, key, createdAt);
          } else if (['Glob', 'Grep'].includes(label)) {
            buffer.rawInput = { pattern: normalized };
            handlers.applyToolPreview(sessionId, key, createdAt);
          }
        }
      }
      break;
    }

    case 'codex.tool_call_end': {
      const toolCallId = extractToolCallId(raw);
      if (!toolCallId) {
        break;
      }

      const label =
        typeof raw?.label === 'string' && raw.label.length > 0
          ? raw.label
          : typeof raw?.rawToolName === 'string' && raw.rawToolName.length > 0
            ? raw.rawToolName
            : typeof payload?.metadata?.toolName === 'string'
              ? payload.metadata.toolName
              : 'Tool';
      let primaryArg =
        typeof raw?.primaryArg === 'string' ? raw.primaryArg : null;
      
      // Clean file paths from primaryArg  
      if (primaryArg && ['Read', 'Write', 'Edit', 'MultiEdit', 'Delete'].includes(label)) {
        primaryArg = cleanFilePath(primaryArg);
      }
      
      const title = formatToolTitle(label, primaryArg);
      const key = `codex-tool-${toolCallId}`;

      const buffer = handlers.ensureToolMessage(
        sessionId,
        key,
        createdAt,
        title,
        label,
      );

      const command =
        typeof raw?.command === 'string'
          ? raw.command
          : Array.isArray(raw?.command)
            ? raw.command.join(' ')
            : null;

      if (buffer) {
        if (label === 'Run' && command) {
          buffer.rawInput = command;
        } else if (
          (!buffer.rawInput || buffer.rawInput === '') &&
          typeof primaryArg === 'string' &&
          primaryArg.trim().length > 0
        ) {
          const normalized = primaryArg.trim();
          if (
            ['Read', 'Write', 'Edit', 'MultiEdit', 'Delete'].includes(label)
          ) {
            buffer.rawInput = { file_path: normalized };
          } else if (['Glob', 'Grep'].includes(label)) {
            buffer.rawInput = { pattern: normalized };
          }
        }
      }

      handlers.finalizeToolText(sessionId, key, title, createdAt);
      break;
    }

    case 'codex.response.output_text.delta': {
      const delta = raw?.delta;
      if (typeof delta === 'string' && delta.length > 0) {
        handlers.finalizeReasoningText(sessionId, '', createdAt);

        // Strip markers from delta streaming to prevent them from being displayed
        const cleanDelta = delta.replace(/\[INTEGRATION_REQUIRED:(supabase|github)\]\s*/gi, '');

        handlers.appendAssistantText(sessionId, cleanDelta, createdAt);
        if (!options?.replay) {
          deps.triggerPreview();
        }
      }
      break;
    }

    case 'codex.response.output_text.done': {
      const text = typeof raw?.text === 'string' ? raw.text : '';

      // Detect integration requirement markers in the completed text
      if (text.length > 0) {
        const markerDetection = detectIntegrationMarker(text, deps.integrationsHint);

        // If integration marker detected, create integration_prompt message instead
        if (markerDetection.hasMarker && markerDetection.integration && !options?.replay) {
          const state = handlers.getSessionState(sessionId);
          const assistantMessageId = state.assistant.messageId;

          // Reset the assistant message buffer
          handlers.resetAssistantMessage(sessionId);

          const timestamp = createdAt ? new Date(createdAt) : new Date();
          const messageId = `${sessionId}-integration-marker-${event.sequence}`;

          const integrationName = markerDetection.integration.charAt(0).toUpperCase() + markerDetection.integration.slice(1);
          const buttonText = `Click here to add your ${integrationName} credentials`;

          deps.setMessages((prev) => {
            // Remove the assistant message that was created during delta streaming
            const withoutAssistant = assistantMessageId
              ? prev.filter(msg => msg.id !== assistantMessageId)
              : prev;

            const nextMessage = {
              id: messageId,
              role: 'assistant' as const,
              content: markerDetection.cleanContent,
              timestamp,
              variant: 'integration_prompt' as const,
              actionData: {
                type: 'open_integration' as const,
                integration: markerDetection.integration!,
                buttonText,
              },
            };

            return [...withoutAssistant, nextMessage];
          });

          deps.triggerPreview();
          break;
        }
      }

      handlers.finalizeAssistantText(sessionId, text, createdAt);
      break;
    }

    case 'codex.response.reasoning_summary_text.delta': {
      const delta = raw?.delta;
      if (typeof delta === 'string' && delta.length > 0) {
        handlers.appendReasoningText(sessionId, delta, createdAt);
      }
      break;
    }

    case 'codex.response.reasoning_summary_text.done': {
      handlers.finalizeReasoningText(sessionId, '', createdAt);
      break;
    }

    default:
      break;
  }
};
