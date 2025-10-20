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
  /**
   * Publicly accessible URL for rendering (e.g. /api/assets/.. or /uploads/..)
   */
  url?: string;
  publicUrl?: string;
  public_url?: string;
  /**
   * Absolute filesystem path for agent consumption.
   */
  path?: string;
  /**
   * Legacy camelCase fields
   */
  base64Data?: string;
  mimeType?: string;
  /**
   * Legacy snake_case fields (retained for backward compatibility with older clients)
   */
  base64_data?: string;
  mime_type?: string;
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
