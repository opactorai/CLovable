/**
 * Chat-related types
 */

export interface MessageMetadata {
  toolName?: string;
  summary?: string;
  description?: string;
  filePath?: string;
  [key: string]: unknown;
}

export interface Message {
  id: string;
  projectId: string;
  conversationId: string | null;
  sessionId: string | null;
  role: 'assistant' | 'user' | 'system';
  content: string;
  messageType: 'chat' | 'tool_use' | 'error' | 'info';
  metadataJson: string | null;
  parentMessageId: string | null;
  cliSource: string | null;
  createdAt: Date;
  updatedAt: Date;
  requestId?: string | null;
}

export interface ImageAttachment {
  name: string;
  url: string;
  base64Data?: string;
  mimeType?: string;
}

export interface ChatActRequest {
  instruction: string;
  allowGlobs?: string[];
  conversationId?: string;
  cliPreference?: string;
  fallbackEnabled?: boolean;
  images?: ImageAttachment[];
  isInitialPrompt?: boolean;
  selectedModel?: string;
  requestId?: string;
}

export interface CreateMessageInput {
  id?: string;
  projectId: string;
  role: 'assistant' | 'user' | 'system';
  messageType: 'chat' | 'tool_use' | 'error' | 'info';
  content: string;
  metadata?: MessageMetadata | null;
  sessionId?: string | null;
  conversationId?: string | null;
  cliSource?: string | null;
}
