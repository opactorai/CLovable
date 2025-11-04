import { processClaudeEvent } from './claudeEventProcessor';
import {
  ChatEvent,
  EventProcessorOptions,
  MessageBufferHandlers,
  SessionState,
} from './types';

// Minimal mapper to reuse Claude processor for GLM events
export const processGlmEvent = (
  event: ChatEvent,
  state: SessionState,
  handlers: MessageBufferHandlers,
  options?: EventProcessorOptions,
  triggerPreview?: () => void,
): void => {
  const mappedEvent: ChatEvent = {
    ...event,
    event: event.event.startsWith('glm.')
      ? event.event.replace(/^glm\./, 'claude.')
      : event.event,
    payload: {
      ...event.payload,
      // Ensure provider metadata stays as glm for downstream consumers
      metadata: {
        ...(event.payload?.metadata ?? {}),
        provider: 'glm',
      },
    },
  };

  processClaudeEvent(mappedEvent, state, handlers, options, triggerPreview);
};

