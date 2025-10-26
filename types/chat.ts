import type { MessageMetadata } from '@/types/backend';
import type { RealtimeMessage } from './realtime';

export type ChatMessage = RealtimeMessage;

export interface ChatSession {
  id: string;
  projectId: string;
  status: 'pending' | 'active' | 'running' | 'completed' | 'failed';
  instruction?: string;
  cliType?: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface ImageAttachment {
  name: string;
  url: string;
  base64Data?: string;
  mimeType?: string;
}

export interface ActRequest {
  instruction: string;
  allowGlobs?: string[];
  conversationId?: string;
  cliPreference?: string;
  fallbackEnabled?: boolean;
  selectedModel?: string;
  images?: ImageAttachment[];
  requestId?: string;
  metadata?: MessageMetadata | null;
}

export interface UserRequest {
  id: string;
  projectId: string;
  userMessageId: string;
  instruction: string;
  requestType: 'act' | 'chat';
  isCompleted: boolean;
  isSuccessful?: boolean;
  startedAt?: string;
  completedAt?: string;
  cliTypeUsed?: string;
  modelUsed?: string;
  errorMessage?: string;
  resultMetadata?: Record<string, unknown>;
  createdAt: string;
}

export interface WebSocketEventData {
  type: string;
  data: {
    requestId?: string;
    [key: string]: unknown;
  };
  timestamp?: string;
}

export type ChatMode = 'chat' | 'act';
