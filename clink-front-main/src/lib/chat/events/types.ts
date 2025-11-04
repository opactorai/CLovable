import { Dispatch, SetStateAction } from 'react';
import { Message } from '@/lib/chat';

export interface ChatEvent {
  sessionId: string;
  sequence: number;
  event: string;
  payload: any;
  createdAt: string;
  chatRoomId?: number;
}

export interface EventProcessorOptions {
  replay?: boolean;
}

export interface EventProcessorDependencies {
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  triggerPreview: () => void;
  loadFileTree: () => Promise<unknown>;
  onTurnEnd?: () => void | Promise<void>;
  safeProjectId: string;
  openIntegrationModal?: (integration: 'supabase' | 'github' | 'other-apps') => void;
  integrationsHint?: {
    supabaseConnected?: boolean;
    githubConnected?: boolean;
  };
}

export interface SessionState {
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
}

export interface StreamBuffer {
  messageId?: string;
  content: string;
  title?: string;
  startTime?: number;
}

export interface ToolBuffer extends StreamBuffer {
  toolName?: string;
  rawInput?: string | Record<string, any>;
  preview?: string;
}

export interface MessageBufferHandlers {
  ensureAssistantMessage: (
    sessionId: string,
    createdAt?: string,
  ) => StreamBuffer;
  resetAssistantMessage: (sessionId: string) => void;
  ensureReasoningMessage: (
    sessionId: string,
    createdAt?: string,
  ) => StreamBuffer;
  resetReasoningMessage: (sessionId: string) => void;
  ensureToolMessage: (
    sessionId: string,
    key: string,
    createdAt?: string,
    title?: string,
    toolName?: string,
    options?: { createEntry?: boolean },
  ) => ToolBuffer;
  appendAssistantText: (
    sessionId: string,
    text: string,
    createdAt?: string,
  ) => void;
  finalizeAssistantText: (
    sessionId: string,
    text: string,
    createdAt?: string,
  ) => void;
  appendReasoningText: (
    sessionId: string,
    text: string,
    createdAt?: string,
  ) => void;
  finalizeReasoningText: (
    sessionId: string,
    text?: string,
    createdAt?: string,
    options?: { keepStreaming?: boolean },
  ) => void;
  appendToolText: (
    sessionId: string,
    key: string,
    text: string,
    createdAt?: string,
    title?: string,
  ) => void;
  applyToolPreview: (
    sessionId: string,
    key: string,
    createdAt?: string,
  ) => void;
  finalizeToolText: (
    sessionId: string,
    key: string,
    text?: string,
    createdAt?: string,
  ) => void;
  getSessionState: (sessionId: string, reset?: boolean) => SessionState;
}
