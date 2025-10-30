import { randomUUID } from 'crypto';
import type { Message, MessageMetadata } from '@/types/backend';
import type { RealtimeMessage } from '@/types';

function parseMetadata(metadataJson?: string | null): MessageMetadata | null {
  if (!metadataJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(metadataJson) as MessageMetadata;
    return parsed;
  } catch (error) {
    console.warn('[chat-serializer] Failed to parse metadata JSON:', error);
    return null;
  }
}

export function serializeMessage(
  message: Message,
  overrides: Partial<RealtimeMessage> = {}
): RealtimeMessage {
  return {
    id: message.id,
    projectId: message.projectId,
    role: message.role,
    messageType: message.messageType,
    content: message.content,
    metadata: parseMetadata(message.metadataJson),
    parentMessageId: message.parentMessageId ?? null,
    conversationId: message.conversationId ?? null,
    sessionId: message.sessionId ?? null,
    cliSource: message.cliSource ?? null,
    requestId: message.requestId ?? undefined,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
    ...overrides,
  };
}

export function serializeMessages(messages: Message[]): RealtimeMessage[] {
  return messages.map((message) => serializeMessage(message));
}

export function createRealtimeMessage(
  payload: Partial<RealtimeMessage> & Pick<RealtimeMessage, 'projectId' | 'role' | 'messageType' | 'content'>
): RealtimeMessage {
  const createdAt = payload.createdAt ?? new Date().toISOString();
  const updatedAt =
    payload.updatedAt ??
    createdAt;

  return {
    id: payload.id ?? randomUUID(),
    projectId: payload.projectId,
    role: payload.role,
    messageType: payload.messageType,
    content: payload.content,
    metadata: payload.metadata ?? null,
    parentMessageId: payload.parentMessageId ?? null,
    conversationId: payload.conversationId ?? null,
    sessionId: payload.sessionId ?? null,
    cliSource: payload.cliSource ?? null,
    requestId: payload.requestId ?? undefined,
    createdAt,
    updatedAt,
    isStreaming: payload.isStreaming,
    isFinal: payload.isFinal,
    isOptimistic: payload.isOptimistic,
  };
}
