import { useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { Message } from '@/lib/chat';
import { formatToolDisplay, extractToolPreviewValue } from '@/lib/chat/toolFormatter';

type StreamBuffer = {
  messageId?: string;
  content: string;
  title?: string;
  startTime?: number;
  timestamp?: Date;
  renderTimer?: number;
  isVisible?: boolean;
};

type ToolBuffer = StreamBuffer & {
  toolName?: string;
  rawInput?: string;
  preview?: string;
};

type SessionAccumulator = {
  assistant: StreamBuffer;
  reasoning: StreamBuffer;
  toolMessages: Record<string, ToolBuffer>;
  claudeBlockKeys: Record<string, string>;
  lastSequence: number;
  codexItems: Record<
    string,
    {
      kind: 'output_text' | 'reasoning' | 'function_call' | 'custom_tool' | 'unknown';
      name?: string;
      applyPatchMessages?: Record<string, { finalized: boolean }>;
    }
  >;
  codexArgumentBuffers: Record<string, string>;
  codexCustomBuffers: Record<string, string>;
};

export const useChatMessageBuffers = (
  setMessages: Dispatch<SetStateAction<Message[]>>,
  resolveChatRoomId?: (sessionId: string) => number | undefined,
) => {
  const sessionStateRef = useRef<Record<string, SessionAccumulator>>({});

  const getSessionState = useCallback(
    (sessionId: string, reset = false): SessionAccumulator => {
      if (!sessionStateRef.current[sessionId] || reset) {
        sessionStateRef.current[sessionId] = {
          assistant: { content: '' },
          reasoning: { content: '', isVisible: false },
          toolMessages: {},
          claudeBlockKeys: {},
          lastSequence: 0,
          codexItems: {},
          codexArgumentBuffers: {},
          codexCustomBuffers: {},
        };
      }
      return sessionStateRef.current[sessionId];
    },
    [],
  );

  const ensureAssistantMessage = useCallback(
    (sessionId: string, createdAt?: string) => {
      const state = getSessionState(sessionId);
      if (!state.assistant.messageId) {
        const messageId = `${sessionId}-assistant-${Date.now()}`;
        state.assistant.messageId = messageId;
        state.assistant.content = '';
        const timestamp = createdAt ? new Date(createdAt) : new Date();
        setMessages((prev) => [
          ...prev,
          {
            id: messageId,
            role: 'assistant',
            content: '',
            timestamp,
            variant: 'message',
            sessionId,
            chatRoomId: resolveChatRoomId?.(sessionId),
          },
        ]);
      }
      return state.assistant;
    },
    [getSessionState, resolveChatRoomId, setMessages],
  );

  const resetAssistantMessage = useCallback(
    (sessionId: string) => {
      const state = getSessionState(sessionId);
      state.assistant.messageId = undefined;
      state.assistant.content = '';
      state.assistant.title = undefined;
    },
    [getSessionState],
  );

  const ensureReasoningMessage = useCallback(
    (sessionId: string, createdAt?: string) => {
      const state = getSessionState(sessionId);
      const buffer = state.reasoning;

      const commitVisibleMessage = (messageId: string, timestamp: Date) => {
        // Double-check buffer state before committing
        if (buffer.messageId !== messageId) {
          return;
        }

        buffer.isVisible = true;
        buffer.renderTimer = undefined;
        setMessages((prev) => {
          const baseIdPrefix = `${sessionId}-reasoning-`;
          const withoutPrevious = prev.filter(
            (msg) => !msg.id.startsWith(baseIdPrefix),
          );

          return [
            ...withoutPrevious,
            {
              id: messageId,
              role: 'assistant',
              content: '',
              timestamp,
              variant: 'reasoning',
              isStreaming: true,
              sessionId,
              chatRoomId: resolveChatRoomId?.(sessionId),
            },
          ];
        });
      };

      if (!buffer.messageId) {
        const messageId = `${sessionId}-reasoning-${Date.now()}`;
        const timestamp = createdAt ? new Date(createdAt) : new Date();

        buffer.messageId = messageId;
        buffer.startTime = Date.now();
        buffer.content = '';
        buffer.timestamp = timestamp;
        buffer.isVisible = false;

        if (buffer.renderTimer) {
          clearTimeout(buffer.renderTimer);
        }

        if (typeof window !== 'undefined') {
          buffer.renderTimer = window.setTimeout(() => {
            // Re-check: buffer may have been reset before timer fired
            if (buffer.messageId !== messageId) {
              return;
            }
            commitVisibleMessage(messageId, timestamp);
          }, 1000);
        } else {
          commitVisibleMessage(messageId, timestamp);
        }
      } else {
        const existingMessageId = buffer.messageId;
        if (buffer.isVisible && existingMessageId) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === existingMessageId
                ? { ...msg, isStreaming: true }
                : msg,
            ),
          );
        }
      }

      return buffer;
    },
    [getSessionState, resolveChatRoomId, setMessages],
  );

  const resetReasoningMessage = useCallback(
    (sessionId: string) => {
      const state = getSessionState(sessionId);
      state.reasoning.messageId = undefined;
      state.reasoning.content = '';
      state.reasoning.title = undefined;
      state.reasoning.startTime = undefined;
      if (state.reasoning.renderTimer) {
        clearTimeout(state.reasoning.renderTimer);
      }
      state.reasoning.renderTimer = undefined;
      state.reasoning.isVisible = false;
      state.reasoning.timestamp = undefined;
    },
    [getSessionState],
  );

  const ensureToolMessage = useCallback(
    (
      sessionId: string,
      key: string,
      createdAt?: string,
      title?: string,
      toolName?: string,
      options?: { createEntry?: boolean },
    ) => {
      const state = getSessionState(sessionId);
      if (!state.toolMessages[key]) {
        state.toolMessages[key] = { content: '', title, toolName, rawInput: '' };
      }
      const buffer = state.toolMessages[key];
      if (title) {
        buffer.title = title;
      }
      if (toolName) {
        buffer.toolName = toolName;
      }
      const shouldCreate = options?.createEntry !== false;
      if (shouldCreate && !buffer.messageId) {
        const messageId = `${sessionId}-tool-${key}-${Date.now()}`;
        buffer.messageId = messageId;
        const timestamp = createdAt ? new Date(createdAt) : new Date();
        setMessages((prev) => [
          ...prev,
          {
            id: messageId,
            role: 'assistant',
            content: title ?? '',
            timestamp,
            variant: 'tool',
            title: title ?? 'Tool Call',
            toolName,
            status: 'running',
            sessionId,
            chatRoomId: resolveChatRoomId?.(sessionId),
          },
        ]);
      }
      return buffer;
    },
    [getSessionState, resolveChatRoomId, setMessages],
  );

  const appendAssistantText = useCallback(
    (sessionId: string, text: string, createdAt?: string) => {
      if (!text) {
        return;
      }
      const buffer = ensureAssistantMessage(sessionId, createdAt);
      buffer.content = (buffer.content || '') + text;
      const content = buffer.content;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === buffer.messageId ? { ...msg, content } : msg,
        ),
      );
    },
    [ensureAssistantMessage, setMessages],
  );

  const finalizeAssistantText = useCallback(
    (sessionId: string, text: string, createdAt?: string) => {
      const buffer = ensureAssistantMessage(sessionId, createdAt);
      const finalText = text || buffer.content;
      buffer.content = finalText;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === buffer.messageId ? { ...msg, content: finalText } : msg,
        ),
      );
      resetAssistantMessage(sessionId);
    },
    [ensureAssistantMessage, resetAssistantMessage, setMessages],
  );

  const appendReasoningText = useCallback(
    (sessionId: string, text: string, createdAt?: string) => {
      const buffer = ensureReasoningMessage(sessionId, createdAt);
      if (!text) {
        return;
      }
      buffer.content = (buffer.content || '') + text;
      const content = buffer.content;

      // Only update UI if the message is visible
      if (buffer.isVisible && buffer.messageId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === buffer.messageId ? { ...msg, content } : msg,
          ),
        );
      }
    },
    [ensureReasoningMessage, setMessages],
  );

  const finalizeReasoningText = useCallback(
    (
      sessionId: string,
      _text?: string,
      _createdAt?: string,
      options?: { keepStreaming?: boolean },
    ) => {
      if (options?.keepStreaming) {
        return;
      }

      const state = getSessionState(sessionId);
      const buffer = state.reasoning;

      // Cancel pending timer first to prevent race condition
      if (buffer.renderTimer) {
        clearTimeout(buffer.renderTimer);
        buffer.renderTimer = undefined;
      }

      // Capture messageId before reset
      const messageIdToRemove = buffer.messageId;

      // Reset buffer state immediately to prevent timer from firing
      resetReasoningMessage(sessionId);

      // Remove reasoning message from UI
      if (messageIdToRemove) {
        setMessages((prev) => prev.filter((msg) => msg.id !== messageIdToRemove));
      }
    },
    [getSessionState, resetReasoningMessage, setMessages],
  );

  const appendToolText = useCallback(
    (sessionId: string, key: string, text: string, createdAt?: string, title?: string) => {
      if (!text) return;
      const state = getSessionState(sessionId);

      // Ensure tool message exists
      if (!state.toolMessages[key]) {
        ensureToolMessage(sessionId, key, createdAt, title);
      }

      const buffer = state.toolMessages[key];
      if (buffer && buffer.messageId) {
        buffer.content = (buffer.content || '') + text;
        const content = buffer.content;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === buffer.messageId ? { ...msg, content } : msg,
          ),
        );
      }
    },
    [getSessionState, ensureToolMessage, setMessages],
  );

  const applyToolPreview = useCallback(
    (sessionId: string, key: string, createdAt?: string) => {
      const state = getSessionState(sessionId);
      const buffer = state.toolMessages[key];
      if (!buffer) {
        return;
      }

      if (!buffer.messageId) {
        const previewValue = buffer.title || extractToolPreviewValue(buffer.toolName, buffer.rawInput);
        if (!previewValue) {
          return;
        }
        buffer.preview = previewValue;
        ensureToolMessage(sessionId, key, createdAt, previewValue, buffer.toolName, {
          createEntry: true,
        });
        return;
      }

      const previewValue = buffer.title || extractToolPreviewValue(buffer.toolName, buffer.rawInput);
      if (previewValue && previewValue !== buffer.preview) {
        buffer.preview = previewValue;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === buffer.messageId ? { ...msg, content: previewValue } : msg,
          ),
        );
      }
    },
    [ensureToolMessage, getSessionState, setMessages],
  );

  const finalizeToolText = useCallback(
    (sessionId: string, key: string, text?: string, createdAt?: string) => {
      const state = getSessionState(sessionId);
      const buffer = state.toolMessages[key];
      if (buffer && buffer.messageId) {
        const finalText = text ?? buffer.content ?? buffer.title ?? '';

        // Check if already formatted (Codex/Gemini style: [ToolName] arg)
        const isPreFormatted =
          !buffer.rawInput && /^\[.+\]/.test(finalText);

        let title, content, todos, toolDetails;

        if (isPreFormatted) {
          // Already formatted - use as is and keep title
          content = finalText;
          title = finalText;
          todos = undefined;
          toolDetails = undefined;
        } else {
          // Need formatting (Claude style or fallback)
          const result = formatToolDisplay(
            buffer.toolName ?? '',
            buffer.rawInput ?? finalText,
          );
          title = result.title;
          content = result.content;
          todos = result.todos;
          toolDetails = result.toolDetails;
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === buffer.messageId
              ? {
                  ...msg,
                  content,
                  title: title || msg.title,
                  todos,
                  toolDetails,
                  status: 'success',
                }
              : msg,
          ),
        );

        delete state.toolMessages[key];
      }
    },
    [getSessionState, setMessages],
  );

  return {
    sessionStateRef,
    getSessionState,
    ensureAssistantMessage,
    resetAssistantMessage,
    ensureReasoningMessage,
    resetReasoningMessage,
    ensureToolMessage,
    appendAssistantText,
    finalizeAssistantText,
    appendReasoningText,
    finalizeReasoningText,
    appendToolText,
    applyToolPreview,
    finalizeToolText,
  };
};
