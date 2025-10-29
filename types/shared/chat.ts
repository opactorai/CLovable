/**
 * Shared Chat Types
 */

export type MessageRole = 'user' | 'assistant';

export type MessageType = 'text' | 'tool_use' | 'tool_result';

export interface BaseMessage {
  role: MessageRole;
  content: string;
  timestamp?: string;
}
