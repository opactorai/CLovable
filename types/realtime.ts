import type { MessageMetadata } from '@/types/backend';

export type MessageRole = 'assistant' | 'user' | 'system' | 'tool';

export type MessageKind = 'chat' | 'tool_use' | 'error' | 'info' | string;

export interface RealtimeMessage {
  id: string;
  projectId: string;
  role: MessageRole;
  messageType: MessageKind;
  content: string;
  metadata?: MessageMetadata | null;
  parentMessageId?: string | null;
  conversationId?: string | null;
  sessionId?: string | null;
  cliSource?: string | null;
  requestId?: string | null;
  createdAt: string;
  updatedAt?: string;
  isStreaming?: boolean;
  isFinal?: boolean;
  isOptimistic?: boolean; // Flag for optimistically added messages (not yet confirmed by server)
}

export interface RealtimeStatus {
  status: string;
  message?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export type StreamTransport = 'sse' | 'websocket';

export interface ConnectionInfo {
  projectId: string;
  timestamp: string;
  sessionId?: string;
  transport?: StreamTransport;
  connectionStage?: 'handshake' | 'assistant';
}

export interface HeartbeatInfo {
  timestamp: string;
}

export interface PreviewEventInfo {
  message: string;
  severity?: 'info' | 'warning' | 'error';
}

export type RealtimeEvent =
  | { type: 'message'; data: RealtimeMessage }
  | { type: 'status'; data: RealtimeStatus }
  | { type: 'error'; error: string; data?: unknown }
  | { type: 'connected'; data: ConnectionInfo }
  | { type: 'heartbeat'; data: HeartbeatInfo }
  | { type: 'preview_error'; data: PreviewEventInfo }
  | { type: 'preview_success'; data: PreviewEventInfo };
