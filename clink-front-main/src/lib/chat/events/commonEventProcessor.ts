import { formatJson, decodeBase64 } from '../formatters/commonFormatter';
import {
  ChatEvent,
  EventProcessorOptions,
  EventProcessorDependencies,
  MessageBufferHandlers,
} from './types';

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

/**
 * Detects if an error is likely due to plan limitations and returns a user-friendly message
 */
export const getUserFriendlyErrorMessage = (
  errorText: string,
  provider?: string,
): { isFriendly: boolean; message?: string; title?: string } => {
  const errorLower = errorText.toLowerCase();

  // Common patterns that indicate plan limitation errors
  const limitationPatterns = [
    'usage limit',
    'rate limit',
    'quota exceeded',
    'insufficient quota',
    'billing hard limit',
    'tier limit',
    'free tier',
    'upgrade your plan',
    'subscription required',
    'insufficient_quota',
    'rate_limit_exceeded',
    'billing_not_active',
    'insufficient credits',
    'credit limit',
    'resource exhausted',
    'quota_exceeded',
  ];

  const isPlanLimitationError = limitationPatterns.some((pattern) =>
    errorLower.includes(pattern)
  );

  if (!isPlanLimitationError) {
    return { isFriendly: false };
  }

  const providerLower = (provider ?? '').toLowerCase();
  let message: string;
  let title: string;

  switch (providerLower) {
    case 'codex':
    case 'openai':
      message = `Usage limit reached or free plan detected.

If you already connected a paid plan:
  → Wait a few hours and try again

If you're on a free plan:
  → Upgrade to OpenAI Plus ($20/month) required`;
      title = 'Codex • Usage Limit';
      break;

    case 'claude':
      message = `Usage limit reached.

Options:
  → Wait a few hours and try again
  → Upgrade to Claude Pro (Max plan) for higher limits`;
      title = 'Claude • Usage Limit';
      break;

    case 'gemini':
      message = `Daily usage limit reached.

Options:
  → Connect a different account
  → Upgrade to Gemini Pro or Ultra plan`;
      title = 'Gemini • Usage Limit';
      break;

    default:
      message = `Usage limit reached or free plan detected.

Please upgrade your ${provider || 'AI'} subscription to continue.`;
      title = `${provider || 'AI'} • Usage Limit`;
      break;
  }

  return { isFriendly: true, message, title };
};

export const processCommonEvents = (
  event: ChatEvent,
  handlers: MessageBufferHandlers,
  deps: EventProcessorDependencies,
  options?: EventProcessorOptions,
): boolean => {
  const { sessionId, event: eventName, payload, createdAt } = event;
  const metadata = payload?.metadata ?? {};
  const provider = metadata.provider;
  const providerLower = typeof provider === 'string' ? provider.toLowerCase() : '';

  // Handle finalization events
  // In addition to explicit turn_end/completed/cancelled, treat provider-specific
  // result events (e.g. claude.result.success / .error_*) as completion for providers
  // that rely on them. GLM is handled strictly via turn_end.
  const isResultLikeEvent =
    eventName.includes('.result.') ||
    metadata?.type === 'result' ||
    payload?.type === 'result';

  const shouldTreatResultAsTurnEnd =
    isResultLikeEvent && providerLower !== 'glm' && !eventName.startsWith('glm.');

  const isTurnEnd =
    eventName.endsWith('turn_end') ||
    metadata?.type === 'turn_end' ||
    payload?.type === 'turn_end' ||
    eventName.endsWith('.completed') ||
    eventName.endsWith('.cancelled') ||
    shouldTreatResultAsTurnEnd;

  if (!options?.replay && isTurnEnd) {
    // Stop loading indicator
    deps.setIsLoading(false);

    void deps.onTurnEnd?.();

    // Finalize any pending reasoning/assistant text to prevent stuck indicators
    handlers.finalizeReasoningText(sessionId, '', createdAt);
    handlers.finalizeAssistantText(sessionId, '', createdAt);

    const statusCandidates = [
      payload?.raw?.status,
      payload?.status,
      metadata?.status,
      payload?.raw?.result,
      payload?.result,
      metadata?.result,
    ];

    const statusValue = statusCandidates.find(
      (value) => typeof value === 'string' && value.trim().length > 0,
    ) as string | undefined;

    const normalizedStatus = statusValue?.toLowerCase();
    const isFailureStatus =
      normalizedStatus !== undefined &&
      !['completed', 'success', 'cancelled'].includes(normalizedStatus);

    if (isFailureStatus) {
      const reason =
        payload?.raw?.reason ?? payload?.reason ?? metadata?.reason ?? null;

      const errorDetail =
        payload?.raw?.error ??
        payload?.error ??
        metadata?.error ??
        payload?.raw?.error_msg ??
        metadata?.error_msg ??
        null;

      const providerLabel =
        typeof provider === 'string' && provider.trim().length > 0
          ? provider.charAt(0).toUpperCase() + provider.slice(1)
          : 'Assistant';

      // Build default error message
      const infoParts = [`Status: ${normalizedStatus}`];
      if (reason) {
        infoParts.push(`Reason: ${reason}`);
      }
      if (errorDetail) {
        infoParts.push(`Error: ${errorDetail}`);
      }
      const defaultContent = infoParts.join(' — ');

      // Check if this looks like a plan limitation error and transform message
      const friendlyError = getUserFriendlyErrorMessage(defaultContent, provider);

      const content = friendlyError.isFriendly
        ? friendlyError.message!
        : defaultContent;

      const title = friendlyError.isFriendly
        ? friendlyError.title!
        : `${providerLabel} • turn_end`;

      const timestamp = createdAt ? new Date(createdAt) : new Date();
      const messageId = `${sessionId}-turnend-${event.sequence}`;

      deps.setMessages((prev) => [
        ...prev,
        {
          id: messageId,
          role: 'assistant',
          content: content || formatJson(payload),
          timestamp,
          variant: 'system',
          title,
        },
      ]);
    }
    // Success path: server will emit turn_diff separately; no-op here to avoid duplicate cards
    return true;
  }

  // Handle complete event
  if (eventName === 'complete') {
    return true;
  }

  // Handle error events
  if (eventName === 'error' || eventName.endsWith('.error')) {
    // Finalize any pending reasoning/assistant text to prevent stuck indicators
    handlers.finalizeReasoningText(sessionId, '', createdAt);
    handlers.finalizeAssistantText(sessionId, '', createdAt);

    const defaultErrorText =
      payload?.message ||
      payload?.raw?.message ||
      metadata?.message ||
      'An error occurred. Please try again.';

    // Check if this looks like a plan limitation error and transform message
    const friendlyError = getUserFriendlyErrorMessage(defaultErrorText, provider);

    const errorText = friendlyError.isFriendly
      ? friendlyError.message!
      : defaultErrorText;

    const title = friendlyError.isFriendly ? friendlyError.title! : 'Error';

    const timestamp = createdAt ? new Date(createdAt) : new Date();
    const messageId = `${sessionId}-error-${event.sequence}`;

    deps.setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        role: 'assistant',
        content: errorText,
        timestamp,
        variant: 'system',
        title,
      },
    ]);
    return true;
  }

  // Handle system events
  if (eventName === 'system' || eventName.endsWith('.system')) {
    return true;
  }

  // Handle ask_secrets event
  if (eventName === 'ask_secrets' || eventName.endsWith('.ask_secrets')) {
    // Add ask_secrets as a message in the chat
    const timestamp = createdAt ? new Date(createdAt) : new Date();
    const messageId =
      (typeof payload?.messageId === 'string' && payload.messageId.length > 0
        ? payload.messageId
        : `${sessionId}-secrets-${event.sequence}`) ??
      `${sessionId}-secrets-${event.sequence}`;

    deps.setMessages((prev) => {
      const nextMessage = {
        id: messageId,
        role: 'assistant' as const,
        content:
          payload?.message ||
          'Please provide the following environment secrets',
        timestamp,
        variant: 'secrets_request' as const,
        secretsData: {
          secrets: payload?.secrets || [],
          requestId: payload?.requestId,
          sessionId,
        },
      };

      const existingIndex = prev.findIndex((msg) => msg.id === messageId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...nextMessage,
        };
        return updated;
      }
      return [...prev, nextMessage];
    });

    return true;
  }

  // Handle prompt_integration event
  if (eventName === 'prompt_integration' || eventName.endsWith('.prompt_integration')) {
    const timestamp = createdAt ? new Date(createdAt) : new Date();
    const messageId =
      (typeof payload?.messageId === 'string' && payload.messageId.length > 0
        ? payload.messageId
        : `${sessionId}-integration-${event.sequence}`) ??
      `${sessionId}-integration-${event.sequence}`;

    deps.setMessages((prev) => {
      const nextMessage = {
        id: messageId,
        role: 'assistant' as const,
        content: payload?.message || 'Please connect the required integration to continue.',
        timestamp,
        variant: 'integration_prompt' as const,
        actionData: {
          type: 'open_integration' as const,
          integration: payload?.integration || 'supabase',
          buttonText: payload?.buttonText || 'Connect Integration',
        },
      };

      const existingIndex = prev.findIndex((msg) => msg.id === messageId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...nextMessage,
        };
        return updated;
      }
      return [...prev, nextMessage];
    });

    return true;
  }

  // Handle codex.stderr specifically - SKIP (only show exec_command_begin)
  if (eventName === 'codex.stderr') {
    return true; // Skip stderr output
  }

  // Handle codex.stream_error and codex.error
  if (
    eventName === 'codex.stream_error' ||
    eventName === 'codex.error' ||
    eventName === 'codex.response.error'
  ) {
    // Finalize any pending reasoning/assistant text to prevent stuck indicators
    handlers.finalizeReasoningText(sessionId, '', createdAt);
    handlers.finalizeAssistantText(sessionId, '', createdAt);

    const text =
      payload?.message || payload?.raw?.msg?.text || formatJson(payload);

    handlers.appendToolText(
      sessionId,
      `${sessionId}-codex-error`,
      text ? `${text}\n` : '',
      createdAt,
      'Codex • Error',
    );
    return true;
  }

  // Handle tool-related events for file tree loading
  if (!options?.replay) {
    const inferredType = metadata?.type as string | undefined;
    if (
      eventName.includes('tool') ||
      (inferredType && inferredType.includes('tool'))
    ) {
      void deps.loadFileTree();
    }
  }

  // Handle generic content
  if (typeof payload?.content === 'string') {
    // Detect integration requirement markers
    const markerDetection = detectIntegrationMarker(payload.content, deps.integrationsHint);

    // If integration marker detected, show clickable message instead of auto-opening
    if (markerDetection.hasMarker && markerDetection.integration && !options?.replay) {
      const timestamp = createdAt ? new Date(createdAt) : new Date();
      const messageId = `${sessionId}-integration-marker-${event.sequence}`;

      const integrationName = markerDetection.integration.charAt(0).toUpperCase() + markerDetection.integration.slice(1);
      const buttonText = `Click here to add your ${integrationName} credentials`;

      deps.setMessages((prev) => {
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

        const existingIndex = prev.findIndex((msg) => msg.id === messageId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...nextMessage,
          };
          return updated;
        }
        return [...prev, nextMessage];
      });

      if (!options?.replay) {
        deps.triggerPreview();
      }
      return true;
    }

    // Use clean content (with marker stripped) for display
    const contentToDisplay = markerDetection.cleanContent;

    handlers.appendAssistantText(sessionId, contentToDisplay, createdAt);
    if (!options?.replay) {
      deps.triggerPreview();
    }
    return true;
  }

  return false;
};
