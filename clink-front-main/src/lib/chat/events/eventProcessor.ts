import { processClaudeEvent } from './claudeEventProcessor';
import { processCodexEvent } from './codexEventProcessor';
import { processGeminiEvent } from './geminiEventProcessor';
import { processCommonEvents } from './commonEventProcessor';
import { processGlmEvent } from './glmEventProcessor';
import {
  ChatEvent,
  EventProcessorOptions,
  EventProcessorDependencies,
  MessageBufferHandlers,
} from './types';

export const processEvent = (
  event: ChatEvent,
  handlers: MessageBufferHandlers,
  deps: EventProcessorDependencies,
  options?: EventProcessorOptions,
): void => {
  const { sessionId, sequence, event: eventName, payload } = event;
  const state = handlers.getSessionState(sessionId);

  // Skip duplicate events
  if (sequence <= state.lastSequence) {
    return;
  }
  state.lastSequence = sequence;

  if (options?.replay) {
    return;
  }

  deps.setIsLoading(true);

  const metadata = payload?.metadata ?? {};
  const provider = metadata.provider;

  // Process common events first (turn_end, complete, error, system)
  const handledByCommon = processCommonEvents(event, handlers, deps, options);
  if (handledByCommon) {
    return;
  }

  // Route to provider-specific processors
  if (provider === 'claude' || eventName.startsWith('claude.')) {
    processClaudeEvent(event, state, handlers, options, deps.triggerPreview);
    return;
  }

  if (provider === 'openai' || eventName.startsWith('codex.')) {
    processCodexEvent(event, handlers, deps, options);
    return;
  }

  if (provider === 'gemini' || eventName.startsWith('gemini.')) {
    processGeminiEvent(event, handlers, options, deps.triggerPreview);
    return;
  }

  // GLM (Z.ai)
  if (provider === 'glm' || eventName.startsWith('glm.')) {
    processGlmEvent(event, state, handlers, options, deps.triggerPreview);
    return;
  }
};
