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
  console.log('[normalizeMetadata] Processing raw metadata:', {
    rawType: typeof raw,
    isNull: raw == null,
    rawLength: typeof raw === 'string' ? raw.length : undefined,
    rawPreview: typeof raw === 'string' ? raw.substring(0, 200) + (raw.length > 200 ? '...' : '') : undefined,
    rawKeys: typeof raw === 'object' && raw !== null ? Object.keys(raw) : undefined
  });

  if (raw == null) {
    console.log('[normalizeMetadata] Returning null for null/undefined metadata');
    return null;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      console.log('[normalizeMetadata] Successfully parsed JSON string, recursing:', {
        parsedKeys: typeof parsed === 'object' && parsed !== null ? Object.keys(parsed) : undefined,
        parsedType: typeof parsed
      });
      return normalizeMetadata(parsed);
    } catch (error) {
      console.error('[normalizeMetadata] Failed to parse JSON string:', error);
      return null;
    }
  }
  if (typeof raw === 'object') {
    console.log('[normalizeMetadata] Returning object as metadata:', {
      objectKeys: Object.keys(raw),
      hasAttachments: raw && typeof raw === 'object' && (raw as any).attachments ? true : false,
      attachmentsCount: raw && typeof raw === 'object' && (raw as any).attachments ? Array.isArray((raw as any).attachments) ? (raw as any).attachments.length : 'not array' : false
    });
    return raw as MessageMetadata;
  }
  console.log('[normalizeMetadata] Returning null for unsupported type:', typeof raw);
  return null;
};

export const normalizeChatContent = (value: unknown): string => {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }
        if (entry && typeof entry === 'object') {
          const candidate = entry as { text?: unknown; content?: unknown; value?: unknown };
          if (typeof candidate.text === 'string') {
            return candidate.text;
          }
          if (typeof candidate.content === 'string') {
            return candidate.content;
          }
          if (typeof candidate.value === 'string') {
            return candidate.value;
          }
        }
        return '';
      })
      .join('');
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidateKeys = ['text', 'content', 'value', 'message'];
    for (const key of candidateKeys) {
      const candidate = record[key];
      if (typeof candidate === 'string') {
        return candidate;
      }
    }

    if (Array.isArray(record.parts)) {
      return normalizeChatContent(record.parts);
    }
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
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
    content: normalizeChatContent(raw?.content),
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
