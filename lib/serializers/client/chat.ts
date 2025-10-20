import type { ChatMessage } from '@/types/chat';

const randomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

export const toChatMessage = (raw: any): ChatMessage => {
  const createdAt = raw?.createdAt ?? raw?.created_at ?? new Date().toISOString();

  return {
    id: raw?.id ?? randomId(),
    projectId: raw?.projectId ?? raw?.project_id ?? '',
    role: raw?.role ?? 'assistant',
    messageType: raw?.messageType ?? raw?.message_type ?? 'chat',
    content: raw?.content ?? '',
    metadata: raw?.metadata ?? raw?.metadata_json ?? null,
    parentMessageId: raw?.parentMessageId ?? raw?.parent_message_id ?? null,
    conversationId: raw?.conversationId ?? raw?.conversation_id ?? null,
    sessionId: raw?.sessionId ?? raw?.session_id ?? null,
    cliSource: raw?.cliSource ?? raw?.cli_source ?? null,
    requestId: raw?.requestId ?? raw?.request_id ?? undefined,
    createdAt,
    updatedAt: raw?.updatedAt ?? raw?.updated_at ?? undefined,
    isStreaming: raw?.isStreaming ?? raw?.is_streaming ?? false,
    isFinal: raw?.isFinal ?? raw?.is_final ?? false,
  } satisfies ChatMessage;
};
