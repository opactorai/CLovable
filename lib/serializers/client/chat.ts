import type { ChatMessage } from '@/types/chat';
import type { MessageMetadata } from '@/types/backend';

const pickFirstString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
};

const stableHash = (input: string): string => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
};

const deriveMessageId = (raw: any): string => {
  const explicitIdCandidates = [
    raw?.id,
    raw?.messageId,
    raw?.message_id,
    raw?.uuid,
    raw?.messageUuid,
    raw?.message_uuid,
  ];

  for (const candidate of explicitIdCandidates) {
    const value = pickFirstString(candidate);
    if (value) {
      return value;
    }
  }

  const project = pickFirstString(raw?.projectId) ?? pickFirstString(raw?.project_id) ?? '';
  const role = pickFirstString(raw?.role) ?? 'assistant';
  const type = pickFirstString(raw?.messageType) ?? pickFirstString(raw?.message_type) ?? 'chat';
  const created =
    pickFirstString(raw?.createdAt) ??
    pickFirstString(raw?.created_at) ??
    pickFirstString(raw?.timestamp) ??
    '';

  let content = '';
  if (typeof raw?.content === 'string') {
    content = raw.content;
  } else if (raw?.content != null) {
    try {
      content = JSON.stringify(raw.content);
    } catch {
      content = String(raw.content);
    }
  }

  const base = [project, role, type, created, content].join('|');

  if (base.trim().length === 0) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `msg_${Math.random().toString(36).slice(2)}`;
  }

  return `msg_${stableHash(base)}`;
};

const normalizeMetadata = (raw: unknown): MessageMetadata | null => {
  if (raw == null) {
    return null;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return normalizeMetadata(parsed);
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    return raw as MessageMetadata;
  }
  return null;
};

export const toChatMessage = (raw: any): ChatMessage => {
  const createdAt = raw?.createdAt ?? raw?.created_at ?? new Date().toISOString();
  const updatedAt = raw?.updatedAt ?? raw?.updated_at ?? createdAt;
  const metadata = normalizeMetadata(
    raw?.metadata ?? raw?.metadata_json ?? raw?.metadataJson,
  );

  return {
    id: deriveMessageId(raw),
    projectId: raw?.projectId ?? raw?.project_id ?? '',
    role: raw?.role ?? 'assistant',
    messageType: raw?.messageType ?? raw?.message_type ?? 'chat',
    content: raw?.content ?? '',
    metadata,
    parentMessageId: raw?.parentMessageId ?? raw?.parent_message_id ?? null,
    conversationId: raw?.conversationId ?? raw?.conversation_id ?? null,
    sessionId: raw?.sessionId ?? raw?.session_id ?? null,
    cliSource: raw?.cliSource ?? raw?.cli_source ?? null,
    requestId: raw?.requestId ?? raw?.request_id ?? undefined,
    createdAt,
    updatedAt,
    isStreaming: raw?.isStreaming ?? raw?.is_streaming ?? false,
    isFinal: raw?.isFinal ?? raw?.is_final ?? false,
    isOptimistic: raw?.isOptimistic ?? raw?.is_optimistic ?? false,
  } satisfies ChatMessage;
};
