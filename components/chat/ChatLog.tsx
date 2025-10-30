"use client";
import React, { useEffect, useState, useRef, ReactElement, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Brain } from 'lucide-react';
import ToolResultItem from './ToolResultItem';
import ThinkingSection from './ThinkingSection';
import type { ChatMessage, RealtimeEvent, RealtimeStatus } from '@/types';
import { toChatMessage, normalizeChatContent } from '@/lib/serializers/client/chat';
import { toRelativePath } from '@/lib/utils/path';

type ToolAction = 'Edited' | 'Created' | 'Read' | 'Deleted' | 'Generated' | 'Searched' | 'Executed';

type ToolExpansionState = {
  expanded: boolean;
  requestId?: string | null;
  toolCallId?: string | null;
};

const TOOL_NAME_ACTION_MAP: Record<string, ToolAction> = {
  read: 'Read',
  read_file: 'Read',
  'read-file': 'Read',
  write: 'Created',
  write_file: 'Created',
  'write-file': 'Created',
  create_file: 'Created',
  edit: 'Edited',
  edit_file: 'Edited',
  'edit-file': 'Edited',
  update_file: 'Edited',
  apply_patch: 'Edited',
  patch_file: 'Edited',
  remove_file: 'Deleted',
  delete_file: 'Deleted',
  delete: 'Deleted',
  remove: 'Deleted',
  list_files: 'Searched',
  list: 'Searched',
  ls: 'Searched',
  glob: 'Searched',
  glob_files: 'Searched',
  search_files: 'Searched',
  grep: 'Searched',
  bash: 'Executed',
  run: 'Executed',
  run_bash: 'Executed',
  shell: 'Executed',
  todo_write: 'Generated',
  todo: 'Generated',
  plan_write: 'Generated',
};

const normalizeAction = (value: unknown): ToolAction | undefined => {
  if (typeof value !== 'string') return undefined;
  const candidate = value.trim().toLowerCase();
  if (!candidate) return undefined;
  if (candidate.includes('edit') || candidate.includes('modify') || candidate.includes('update') || candidate.includes('patch')) {
    return 'Edited';
  }
  if (candidate.includes('write') || candidate.includes('create') || candidate.includes('add') || candidate.includes('append')) {
    return 'Created';
  }
  if (candidate.includes('read') || candidate.includes('open') || candidate.includes('view')) {
    return 'Read';
  }
  if (candidate.includes('delete') || candidate.includes('remove')) {
    return 'Deleted';
  }
  if (
    candidate.includes('search') ||
    candidate.includes('find') ||
    candidate.includes('list') ||
    candidate.includes('glob') ||
    candidate.includes('ls') ||
    candidate.includes('grep')
  ) {
    return 'Searched';
  }
  if (candidate.includes('generate') || candidate.includes('todo') || candidate.includes('plan')) {
    return 'Generated';
  }
  if (
    candidate.includes('execute') ||
    candidate.includes('exec') ||
    candidate.includes('run') ||
    candidate.includes('bash') ||
    candidate.includes('shell') ||
    candidate.includes('command')
  ) {
    return 'Executed';
  }
  return undefined;
};

const inferActionFromToolName = (toolName: unknown): ToolAction | undefined => {
  if (typeof toolName !== 'string') return undefined;
  const normalized = toolName.trim().toLowerCase();
  if (!normalized) return undefined;
  if (TOOL_NAME_ACTION_MAP[normalized]) {
    return TOOL_NAME_ACTION_MAP[normalized];
  }
  const suffix = normalized.split(':').pop() ?? normalized;
  if (suffix && TOOL_NAME_ACTION_MAP[suffix]) {
    return TOOL_NAME_ACTION_MAP[suffix];
  }
  return normalizeAction(normalized);
};

const pickFirstString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = pickFirstString(entry);
      if (candidate) return candidate;
    }
    return undefined;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const nestedKeys = ['path', 'filepath', 'filePath', 'file_path', 'target', 'value'];
    for (const key of nestedKeys) {
      if (key in obj) {
        const candidate = pickFirstString(obj[key]);
        if (candidate) return candidate;
      }
    }
  }
  return undefined;
};

const extractPathFromInput = (input: unknown, action?: ToolAction): string | undefined => {
  if (!input || typeof input !== 'object') return undefined;
  const record = input as Record<string, unknown>;
  const candidateKeys = [
    'filePath',
    'file_path',
    'filepath',
    'path',
    'targetPath',
    'target_path',
    'target',
    'targets',
    'fullPath',
    'full_path',
    'destination',
    'destinationPath',
    'outputPath',
    'output_path',
    'glob',
    'pattern',
    'directory',
    'dir',
    'filename',
    'name',
  ];

  for (const key of candidateKeys) {
    if (key in record) {
      const candidate = record[key];
      const result = pickFirstString(candidate);
      if (result) {
        return result;
      }
    }
  }

  if (Array.isArray(record.targets)) {
    for (const target of record.targets as unknown[]) {
      const candidate = pickFirstString(target);
      if (candidate) {
        return candidate;
      }
    }
  }

  if (!action || action === 'Executed') {
    const commandKeys = ['command', 'cmd', 'shellCommand', 'shell_command'];
    for (const key of commandKeys) {
      if (key in record) {
        const candidate = pickFirstString(record[key]);
        if (candidate) {
          return candidate;
        }
      }
    }
  }

  return undefined;
};

const extractToolCallId = (
  metadata?: Record<string, unknown> | null
): string | null => {
  if (!metadata) return null;

  const directCandidates = [
    metadata.toolCallId,
    metadata.tool_call_id,
    metadata.toolCallID,
    metadata.tool_callID,
  ];

  for (const candidate of directCandidates) {
    const value = pickFirstString(candidate);
    if (value) {
      return value;
    }
  }

  const nested =
    (metadata.tool_call ?? metadata.toolCall ?? metadata.tool ?? null) as
      | Record<string, unknown>
      | undefined;
  if (nested && typeof nested === 'object') {
    const nestedCandidates = [
      nested.id,
      nested.toolCallId,
      nested.tool_call_id,
      nested.tool_callID,
    ];
    for (const candidate of nestedCandidates) {
      const value = pickFirstString(candidate);
      if (value) {
        return value;
      }
    }
  }

  return null;
};

const deriveToolInfoFromMetadata = (
  metadata?: Record<string, unknown> | null
): { action?: ToolAction; filePath?: string; cleanContent?: string; toolName?: string; command?: string } => {
  if (!metadata) {
    return {};
  }

  const meta = metadata as Record<string, unknown>;
  const toolName = pickFirstString(meta.toolName) ?? pickFirstString(meta.tool_name);
  const action =
    normalizeAction(meta.action) ??
    normalizeAction(meta.operation) ??
    inferActionFromToolName(toolName);

  const directPath =
    pickFirstString(meta.filePath) ??
    pickFirstString(meta.file_path) ??
    pickFirstString(meta.targetPath) ??
    pickFirstString(meta.target_path) ??
    pickFirstString(meta.path) ??
    pickFirstString(meta.target);

  const toolInput = meta.toolInput ?? meta.tool_input ?? meta.input;
  let filePath = directPath ?? extractPathFromInput(toolInput, action);

  if (!filePath) {
    const command =
      pickFirstString(meta.command) ??
      (toolInput && typeof toolInput === 'object' ? pickFirstString((toolInput as Record<string, unknown>).command) : undefined);
    if (command) {
      filePath = command;
    }
  }

  const cleanContent =
    pickFirstString(meta.summary) ??
    pickFirstString(meta.description) ??
    pickFirstString(meta.resultSummary) ??
    pickFirstString(meta.result_summary) ??
    pickFirstString(meta.diff) ??
    pickFirstString(meta.diffInfo) ??
    pickFirstString(meta.diff_info) ??
    pickFirstString(meta.message) ??
    pickFirstString(meta.content);

  return {
    action: action ?? inferActionFromToolName(toolName),
    filePath,
    cleanContent,
    toolName,
    command: pickFirstString(meta.command) ?? (toolInput && typeof toolInput === 'object' ? pickFirstString((toolInput as Record<string, unknown>).command) : undefined),
  };
};

const parseToolPlaceholder = (content?: string | null) => {
  if (!content) return null;
  const trimmed = content.trim();
  if (!trimmed) return null;

  let toolName: string | undefined;
  let target: string | undefined;
  let summary: string | undefined;

  const bracketMatch = trimmed.match(/^\[Tool:\s*([^\]\n]+)\s*\](.*)$/i);
  if (bracketMatch) {
    toolName = bracketMatch[1]?.trim();
    const trailing = bracketMatch[2]?.trim();
    if (trailing) {
      target = trailing;
    }
  }

  const usingToolMatch = trimmed.match(/^Using tool:\s*([^\n]+?)(?:\s+on\s+(.+))?$/i);
  if (usingToolMatch) {
    toolName = toolName ?? usingToolMatch[1]?.trim();
    const maybeTarget = usingToolMatch[2]?.trim();
    if (maybeTarget) {
      target = maybeTarget;
    }
  }

  const toolResultMatch = trimmed.match(/^Tool result:\s*(.+)$/i);
  if (toolResultMatch) {
    summary = toolResultMatch[1]?.trim() || undefined;
  }

  if (!toolName && !target && !summary) {
    return null;
  }

  return {
    toolName,
    target,
    summary,
    action: inferActionFromToolName(toolName) ?? (target ? normalizeAction('run') ?? 'Executed' : 'Executed'),
  };
};

const stripToolPlaceholderLines = (input: string): string => {
  if (!input) return input;

  return input
    .replace(/^\s*\[Tool:[^\n]*\n?/gim, '')
    .replace(/^\s*Using tool:[^\n]*\n?/gim, '')
    .replace(/^\s*Tool result:[^\n]*\n?/gim, '')
    .trim();
};

const randomMessageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `msg_${Math.random().toString(36).slice(2, 11)}`;
};

const createToolMessageFromPlaceholder = (
  message: ChatMessage
): { toolMessage: ChatMessage; skipOriginal: boolean; sanitizedContent?: string } | null => {
  const contentText = normalizeChatContent(message.content);
  const details = parseToolPlaceholder(contentText);
  if (!details) return null;
  const { toolName, target, summary, action } = details;

  const baseMetadata =
    message.metadata && typeof message.metadata === 'object' ? { ...(message.metadata as Record<string, unknown>) } : {};

  const metadata: Record<string, unknown> = {
    ...baseMetadata,
    toolName,
    tool_name: toolName,
    filePath: target,
    file_path: target,
    summary,
    action,
  };

  const fallbackPath = target ?? summary ?? (toolName ? `Tool: ${toolName}` : undefined) ?? 'Tool action';

  const toolMessage: ChatMessage = {
    ...message,
    id: `${message.id || randomMessageId()}::tool`,
    role: 'tool',
    messageType: 'tool_use',
    content: summary ?? target ?? (toolName ? `[Tool: ${toolName}]` : contentText),
    metadata,
  };

  const sanitizedContent = stripToolPlaceholderLines(contentText);
  const skipOriginal = sanitizedContent.length === 0;

  if (!metadata.filePath) {
    metadata.filePath = fallbackPath;
    metadata.file_path = fallbackPath;
  }

  if (!metadata.summary && summary) {
    metadata.summary = summary;
  }

  return {
    toolMessage,
    skipOriginal,
    sanitizedContent: !skipOriginal && sanitizedContent !== contentText ? sanitizedContent : undefined,
  };
};

const expandMessageWithToolPlaceholder = (message: ChatMessage): ChatMessage[] => {
  const conversion = message.messageType === 'tool_use' ? null : createToolMessageFromPlaceholder(message);
  if (!conversion) {
    return [message];
  }

  const { toolMessage, skipOriginal, sanitizedContent } = conversion;
  if (skipOriginal) {
    return [toolMessage];
  }

  const sanitizedMessage =
    sanitizedContent !== undefined ? { ...message, content: sanitizedContent } : message;

  return [toolMessage, sanitizedMessage];
};

const hashString = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
};

const buildToolMessageKey = (
  message: ChatMessage,
  metadata?: Record<string, unknown> | null
): string => {
  const parts: string[] = [];
  const addPart = (label: string, value: unknown) => {
    const candidate = pickFirstString(value);
    if (candidate) {
      parts.push(`${label}:${candidate}`);
    }
  };

  addPart('request', message.requestId);
  addPart('parent', message.parentMessageId);
  addPart('session', message.sessionId);
  addPart('type', message.messageType);
  addPart('role', message.role);

  const record = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
  const metadataKeys = [
    'toolCallId',
    'tool_call_id',
    'toolName',
    'tool_name',
    'filePath',
    'file_path',
    'path',
    'target',
    'targetPath',
    'target_path',
    'action',
    'operation',
  ];

  metadataKeys.forEach((key) => {
    addPart(key, record[key]);
  });

  const nestedToolCall = (record.tool_call ?? record.toolCall) as Record<string, unknown> | undefined;
  if (nestedToolCall && typeof nestedToolCall === 'object') {
    addPart('tool_call.id', nestedToolCall.id);
    addPart('tool_call.name', nestedToolCall.name ?? nestedToolCall.tool_name ?? nestedToolCall.toolName);
  }

  if (parts.length === 0) {
    addPart('created', message.createdAt);
    addPart('cli', message.cliSource);
  }

  if (parts.length === 0 && message.id) {
    addPart('id', message.id);
  }

  return parts.join('|');
};

const expandMessagesList = (
  messages: ChatMessage[],
  ensureMessageId: (message: ChatMessage) => string
): ChatMessage[] => {
  const result: ChatMessage[] = [];
  const seen = new Set<string>();
  const seenByContent = new Map<string, string>(); // Track by content to detect near-duplicates

  messages.forEach((message) => {
    const expanded = expandMessageWithToolPlaceholder(message);
    expanded.forEach((entry) => {
      if (!entry.id) {
        entry.id = ensureMessageId(entry);
      }

      // Enhanced duplicate detection
      if (seen.has(entry.id)) {
        return; // Skip exact ID duplicates
      }

      // Check for content-based duplicates (for tool messages that might have different IDs)
      if (entry.role === 'tool' && entry.content) {
        const contentHash = hashString(entry.content).substring(0, 16);
        if (seenByContent.has(contentHash)) {
          const existingId = seenByContent.get(contentHash);
          if (existingId !== entry.id) {
            return; // Skip content duplicates
          }
        }
        seenByContent.set(contentHash, entry.id);
      }

      result.push(entry);
      seen.add(entry.id);
    });
  });

  return result;
};

const metadataEquals = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

const areMessagesEqual = (prev: ChatMessage[], next: ChatMessage[]) => {
  if (prev === next) {
    return true;
  }
  if (prev.length !== next.length) {
    return false;
  }
  for (let i = 0; i < prev.length; i += 1) {
    const a = prev[i];
    const b = next[i];
    if (a.id !== b.id) return false;
    if (a.role !== b.role) return false;
    if (a.messageType !== b.messageType) return false;
    if (a.content !== b.content) return false;
    if (a.updatedAt !== b.updatedAt) return false;
    if (a.requestId !== b.requestId) return false;
    if (a.isStreaming !== b.isStreaming) return false;
    if (a.isFinal !== b.isFinal) return false;
    if (a.isOptimistic !== b.isOptimistic) return false;
    if (!metadataEquals(a.metadata, b.metadata)) return false;
  }
  return true;
};

const mergeMetadataObjects = (
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown> | null | undefined
): Record<string, unknown> | null => {
  if (!existing && !incoming) {
    return null;
  }
  if (!existing) {
    return incoming ? { ...incoming } : null;
  }
  if (!incoming) {
    return { ...existing };
  }

  const existingAttachments = Array.isArray((existing as any)?.attachments)
    ? (existing as any).attachments
    : undefined;
  const incomingAttachments = Array.isArray((incoming as any)?.attachments)
    ? (incoming as any).attachments
    : undefined;

  const merged: Record<string, unknown> = { ...existing };

  Object.entries(incoming).forEach(([key, value]) => {
    const existingValue = merged[key];

    if (value === undefined) {
      return;
    }

    if (value === null) {
      if (existingValue !== undefined) {
        return;
      }
      merged[key] = value;
      return;
    }

    if (typeof value === 'string') {
      if (value.trim().length === 0 && typeof existingValue === 'string' && existingValue.trim().length > 0) {
        return;
      }
      merged[key] = value;
      return;
    }

    if (Array.isArray(value) && value.length === 0 && Array.isArray(existingValue) && existingValue.length > 0) {
      return;
    }

    merged[key] = value;
  });

  if (incomingAttachments && incomingAttachments.length > 0) {
    (merged as any).attachments = incomingAttachments;
  } else if (existingAttachments && existingAttachments.length > 0) {
    (merged as any).attachments = existingAttachments;
  }

  return merged;
};

const mergeMessageRecord = (existing: ChatMessage, incoming: ChatMessage): ChatMessage => {
  const incomingContent = normalizeChatContent(incoming.content);
  const existingContent = normalizeChatContent(existing.content);
  const shouldKeepExistingContent =
    incomingContent.trim().length === 0 && existingContent.trim().length > 0;

  const resolvedCreatedAt = (() => {
    if (!existing.createdAt) return incoming.createdAt ?? existing.createdAt;
    if (!incoming.createdAt) return existing.createdAt;
    return new Date(incoming.createdAt).getTime() < new Date(existing.createdAt).getTime()
      ? incoming.createdAt
      : existing.createdAt;
  })();

  const resolvedUpdatedAt = (() => {
    const existingTime = existing.updatedAt ?? existing.createdAt;
    const incomingTime = incoming.updatedAt ?? incoming.createdAt;
    if (!existingTime) return incomingTime ?? existingTime;
    if (!incomingTime) return existingTime;
    return new Date(incomingTime).getTime() >= new Date(existingTime).getTime()
      ? incomingTime
      : existingTime;
  })();

  const mergedMetadata = mergeMetadataObjects(
    existing.metadata as Record<string, unknown> | null | undefined,
    incoming.metadata as Record<string, unknown> | null | undefined
  );

  const merged: ChatMessage = {
    ...existing,
    ...incoming,
    content: shouldKeepExistingContent ? existing.content : incoming.content,
    metadata: mergedMetadata,
    createdAt: resolvedCreatedAt ?? existing.createdAt,
    updatedAt: resolvedUpdatedAt,
    requestId: incoming.requestId ?? existing.requestId,
    isOptimistic: incoming.isOptimistic ?? existing.isOptimistic,
    isStreaming: incoming.isStreaming ?? existing.isStreaming,
    isFinal: incoming.isFinal ?? existing.isFinal,
  };

  const unchanged =
    merged.content === existing.content &&
    merged.updatedAt === existing.updatedAt &&
    merged.isStreaming === existing.isStreaming &&
    merged.isFinal === existing.isFinal &&
    merged.isOptimistic === existing.isOptimistic &&
    merged.requestId === existing.requestId &&
    metadataEquals(merged.metadata, existing.metadata);

  return unchanged ? existing : merged;
};

const ensureMessageIdentity = (message: ChatMessage): ChatMessage => {
  if (message.id) {
    return message;
  }
  return { ...message, id: randomMessageId() };
};

const integrateMessages = (
  previous: ChatMessage[],
  incoming: ChatMessage[]
): ChatMessage[] => {
  if (incoming.length === 0) {
    return previous;
  }

  const map = new Map<string, ChatMessage>();

  previous.forEach((original) => {
    const message = ensureMessageIdentity(original);
    map.set(message.id, message);
  });

  incoming.forEach((rawMessage) => {
    let message = ensureMessageIdentity(rawMessage);

    if (!message.isOptimistic && message.requestId) {
      let preservedAttachments: any[] | undefined;

      Array.from(map.entries()).forEach(([key, existing]) => {
        if (existing.requestId === message.requestId && existing.isOptimistic) {
          const existingAttachments = Array.isArray((existing.metadata as any)?.attachments)
            ? (existing.metadata as any).attachments
            : undefined;
          if (
            existingAttachments &&
            existingAttachments.length > 0 &&
            (!preservedAttachments || preservedAttachments.length === 0)
          ) {
            preservedAttachments = [...existingAttachments];
            console.log('🖼️ Preserving optimistic attachments for request:', {
              requestId: message.requestId,
              attachments: preservedAttachments,
            });
          }
          map.delete(key);
        }
      });

      if (
        preservedAttachments &&
        preservedAttachments.length > 0 &&
        (!Array.isArray((message.metadata as any)?.attachments) ||
          ((message.metadata as any)?.attachments?.length ?? 0) === 0)
      ) {
        message = {
          ...message,
          metadata: {
            ...(message.metadata ?? {}),
            attachments: preservedAttachments,
          },
        };
      }
    }

    const existing = map.get(message.id);
    if (existing) {
      const merged = mergeMessageRecord(existing, message);
      map.set(merged.id ?? message.id, merged);
    } else {
      map.set(message.id, message);
    }
  });

  const sorted = Array.from(map.values()).sort((a, b) => {
    const timeDiff =
      new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return (a.id ?? '').localeCompare(b.id ?? '');
  });

  return areMessagesEqual(previous, sorted) ? previous : sorted;
};

// Tool Message Component - Enhanced with new design
const ToolMessage = ({
  content,
  metadata,
  isExpanded,
  onToggle,
}: {
  content: unknown;
  metadata?: Record<string, unknown> | null;
  isExpanded?: boolean;
  onToggle?: (nextExpanded: boolean) => void;
}) => {
  const metadataInfo = deriveToolInfoFromMetadata(metadata);
  const lastStableValuesRef = useRef<{ action?: ToolAction; label?: string; content?: string }>({});

  const processToolContent = (rawContent: unknown) => {
    let action: ToolAction = metadataInfo.action ?? 'Executed';
    let filePath = metadataInfo.filePath ?? '';
    let cleanContent: string | undefined = metadataInfo.cleanContent;
    let inferredToolName = metadataInfo.toolName;
    let processedContent = '';

    if (!cleanContent && metadata && typeof metadata === 'object') {
      const meta = metadata as Record<string, unknown>;
      cleanContent =
        pickFirstString(meta.result) ??
        pickFirstString(meta.output) ??
        pickFirstString(meta.diffSummary) ??
        pickFirstString(meta.diff_summary) ??
        pickFirstString(meta.diffInfo) ??
        pickFirstString(meta.diff_info) ??
        cleanContent;
    }
    
    processedContent = cleanContent ?? '';

    if (!processedContent) {
      processedContent = normalizeChatContent(rawContent);
    }

    if (!processedContent && rawContent && typeof rawContent === 'object') {
      const obj = rawContent as Record<string, unknown>;
      processedContent =
        pickFirstString(obj.summary) ??
        pickFirstString(obj.description) ??
        processedContent;
    }
    
    processedContent = processedContent
      .replace(/\[object Object\]/g, '')
      .replace(/[🔧⚡🔍📖✏️📁🌐🔎🤖📝🎯✅📓⚙️🧠]/g, '')
      .trim();

    const bracketMatch = processedContent.match(/^\[Tool:\s*([^\]\n]+)\s*\](.*)$/i);
    if (bracketMatch) {
      const toolLabel = bracketMatch[1]?.trim();
      const trailing = bracketMatch[2]?.trim();
      if (toolLabel) {
        inferredToolName = inferredToolName ?? toolLabel;
        const inferred = inferActionFromToolName(toolLabel);
        if (inferred) {
          action = inferred;
        }
      }
      if (!filePath && trailing) {
        filePath = trailing;
      }
    }

    const usingToolMatch = processedContent.match(/^Using tool:\s*([^\n]+?)(?:\s+on\s+(.+))?$/i);
    if (usingToolMatch) {
      const toolLabel = usingToolMatch[1]?.trim();
      const target = usingToolMatch[2]?.trim();
      if (toolLabel) {
        inferredToolName = inferredToolName ?? toolLabel;
        const inferred = inferActionFromToolName(toolLabel);
        if (inferred) {
          action = inferred;
        }
      }
      if (!filePath && target) {
        filePath = target;
      }
    }

    const toolResultMatch = processedContent.match(/^Tool result:\s*(.+)$/i);
    if (toolResultMatch && !cleanContent) {
      cleanContent = toolResultMatch[1]?.trim() || undefined;
    }
    
    if (!filePath) {
      const toolMatch = processedContent.match(/\*\*(Read|LS|Glob|Grep|Edit|Write|Bash|MultiEdit|TodoWrite)\*\*\s*`?([^`\n]+)`?/);
      if (toolMatch) {
        const toolName = toolMatch[1];
        const toolArg = toolMatch[2].trim();
        
        switch (toolName) {
          case 'Read': 
            action = 'Read';
            filePath = toolArg;
            cleanContent = undefined;
            break;
          case 'Edit':
          case 'MultiEdit':
            action = 'Edited';
            filePath = toolArg;
            cleanContent = undefined;
            break;
          case 'Write': 
            action = 'Created';
            filePath = toolArg;
            cleanContent = undefined;
            break;
          case 'LS': 
            action = 'Searched';
            filePath = toolArg;
            cleanContent = undefined;
            break;
          case 'Glob':
          case 'Grep':
            action = 'Searched';
            filePath = toolArg;
            cleanContent = undefined;
            break;
          case 'Bash': 
            action = 'Executed';
            filePath = toolArg.split('\n')[0];
            cleanContent = undefined;
            break;
          case 'TodoWrite':
            action = 'Generated';
            filePath = 'Todo List';
            cleanContent = undefined;
            break;
        }
      }
    }
    
    return {
      action,
      filePath,
      cleanContent: cleanContent ?? (processedContent && processedContent !== filePath ? processedContent : undefined),
      toolName: inferredToolName,
    };
  };
  
  const { action, filePath, cleanContent, toolName } = processToolContent(content);

  const fallbackLabel =
    filePath ||
    metadataInfo.filePath ||
    (metadataInfo.toolName ? `Tool: ${metadataInfo.toolName}` : undefined) ||
    metadataInfo.command ||
    'Tool action';

  const cleanedContent =
    cleanContent && cleanContent !== fallbackLabel && !/^Using tool:/i.test(cleanContent)
      ? cleanContent
      : metadataInfo.cleanContent && metadataInfo.cleanContent !== fallbackLabel
      ? metadataInfo.cleanContent
      : undefined;

  const finalAction = action ?? metadataInfo.action ?? 'Executed';
  const finalLabel =
    fallbackLabel === 'Tool action' && (toolName ?? metadataInfo.toolName)
      ? `Tool: ${toolName ?? metadataInfo.toolName}`
      : fallbackLabel;
  const metadataContentCandidate =
    metadataInfo.cleanContent &&
    metadataInfo.cleanContent !== finalLabel &&
    metadataInfo.cleanContent.trim().length > 0
      ? metadataInfo.cleanContent
      : undefined;

  if (finalAction) {
    lastStableValuesRef.current.action = finalAction;
  }
  if (finalLabel && finalLabel !== 'Tool action' && finalLabel.trim().length > 0) {
    lastStableValuesRef.current.label = finalLabel;
  }
  if (cleanedContent && cleanedContent.trim().length > 0) {
    lastStableValuesRef.current.content = cleanedContent;
  } else if (metadataContentCandidate) {
    lastStableValuesRef.current.content = metadataContentCandidate;
  }

  const persistedAction = lastStableValuesRef.current.action ?? finalAction ?? 'Executed';
  const persistedLabel =
    finalLabel && finalLabel !== 'Tool action'
      ? finalLabel
      : lastStableValuesRef.current.label ?? finalLabel ?? 'Tool action';
  const persistedContent =
    (cleanedContent && cleanedContent.trim().length > 0
      ? cleanedContent
      : metadataContentCandidate) ?? lastStableValuesRef.current.content;
  
  return (
    <ToolResultItem
      action={persistedAction}
      filePath={persistedLabel}
      content={persistedContent}
      isExpanded={isExpanded}
      onToggle={onToggle}
    />
  );
};


const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

interface LogEntry {
  id: string;
  type: string;
  data: any;
  timestamp: string;
}

interface ActiveSession {
  status: string;
  sessionId?: string;
  instruction?: string;
  startedAt?: string;
  durationSeconds?: number;
}

interface ChatLogProps {
  projectId: string;
  onSessionStatusChange?: (isRunning: boolean) => void;
  onProjectStatusUpdate?: (status: string, message?: string) => void;
  onSseFallbackActive?: (active: boolean) => void;
  startRequest?: (requestId: string) => void;
  completeRequest?: (requestId: string, isSuccessful: boolean, errorMessage?: string) => void;
  onAddUserMessage?: (handlers: {
    add: (message: ChatMessage) => void;
    remove: (messageId: string) => void;
  }) => void;
}

export default function ChatLog({ projectId, onSessionStatusChange, onProjectStatusUpdate, onSseFallbackActive, startRequest, completeRequest, onAddUserMessage }: ChatLogProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [needsHistoryRefresh, setNeedsHistoryRefresh] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedInitialDataRef = useRef(false);
  const sseFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoggedSseFallbackRef = useRef(false);
  const [enableSseFallback, setEnableSseFallback] = useState(false);
  const [isSseConnected, setIsSseConnected] = useState(false);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
  const [expandedToolMessages, setExpandedToolMessages] = useState<Record<string, ToolExpansionState>>({});
  const fallbackMessageIdRef = useRef<Map<string, string>>(new Map());
  const visibleToolMessageIdsRef = useRef<Set<string>>(new Set());

  const ensureStableMessageId = useCallback((message: ChatMessage): string => {
    if (message.id) {
      return message.id;
    }

    const parts: string[] = [];
    const addPart = (label: string, value: unknown) => {
      const candidate = pickFirstString(value);
      if (candidate) {
        parts.push(`${label}:${candidate}`);
      }
    };

    addPart('request', message.requestId);
    addPart('parent', message.parentMessageId);
    addPart('session', message.sessionId);
    addPart('type', message.messageType);
    addPart('role', message.role);
    addPart('cli', message.cliSource);
    addPart('created', message.createdAt);

    const metadata =
      message.metadata && typeof message.metadata === 'object'
        ? (message.metadata as Record<string, unknown>)
        : null;
    if (metadata) {
      const toolCallId = extractToolCallId(metadata);
      if (toolCallId) {
        addPart('tool_call', toolCallId);
      }
    }

    const fingerprint =
      parts.length > 0
        ? parts.join('|')
        : `fallback:${message.role}:${message.messageType}:${message.createdAt}`;

    const existing = fallbackMessageIdRef.current.get(fingerprint);
    if (existing) {
      return existing;
    }

    const newId = randomMessageId();
    fallbackMessageIdRef.current.set(fingerprint, newId);
    return newId;
  }, []);

  const handleToolMessageToggle = useCallback(
    (message: ChatMessage, key: string, nextExpanded?: boolean) => {
      if (!key) return;

      const metadata =
        message.metadata && typeof message.metadata === 'object'
          ? (message.metadata as Record<string, unknown>)
          : null;
      const requestId = message.requestId ?? null;
      const toolCallId = extractToolCallId(metadata);

      setExpandedToolMessages((prev) => {
        const currentState = prev[key];
        const current = currentState?.expanded ?? false;
        const desired = typeof nextExpanded === 'boolean' ? nextExpanded : !current;

        if (
          desired === current &&
          currentState?.requestId === requestId &&
          currentState?.toolCallId === toolCallId
        ) {
          return prev;
        }

        return {
          ...prev,
          [key]: {
            expanded: desired,
            requestId,
            toolCallId,
          },
        };
      });
    },
    []
  );

  // Error handling helper
  const handleError = useCallback((error: Error | string, context?: string) => {
    const message = typeof error === 'string' ? error : error.message;
    console.error(`[ChatLog] Error${context ? ` in ${context}` : ''}:`, error);
    setErrorMessage(message);
    setHasError(true);
    setIsLoading(false);

    // Automatically clear the error state after 5 seconds
    setTimeout(() => {
      setHasError(false);
      setErrorMessage(null);
    }, 5000);
  }, []);

  // Reset the error state
  const clearError = useCallback(() => {
    setHasError(false);
    setErrorMessage(null);
  }, []);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [totalMessageCount, setTotalMessageCount] = useState(0);

  // Enhanced deduplication system to prevent duplicate messages
  const processedMessageIds = useRef(new Set<string>());
  const processedRequestIds = useRef(new Map<string, string>());
  const pendingMessageIds = useRef(new Set<string>());

  // Transport layer coordination - track message sources
  const messageSources = useRef<Map<string, 'websocket' | 'sse' | 'optimistic' | 'unknown'>>(new Map());
  const activeTransport = useRef<'websocket' | 'sse' | null>(null);

  // Comprehensive debugging system
  const messageLifecycleRef = useRef<Map<string, {
    createdAt: number;
    source: string;
    events: Array<{timestamp: number; event: string; details?: any}>;
  }>>(new Map());

  // Debug function to track message lifecycle
  const trackMessageLifecycle = useCallback((messageId: string, event: string, details?: any) => {
    if (!messageLifecycleRef.current.has(messageId)) {
      messageLifecycleRef.current.set(messageId, {
        createdAt: Date.now(),
        source: details?.source || 'unknown',
        events: []
      });
    }

    const lifecycle = messageLifecycleRef.current.get(messageId)!;
    lifecycle.events.push({
      timestamp: Date.now(),
      event,
      details
    });

    // Log significant events
    if (event === 'received' || event === 'processed' || event === 'replaced_optimistic') {
      console.log(`🔍 [Lifecycle] Message ${event}:`, {
        messageId,
        source: lifecycle.source,
        details,
        totalEvents: lifecycle.events.length
      });
    }
  }, []);

  const isMessageProcessed = useCallback((message: ChatMessage): boolean => {
    // Check by message ID first
    if (message.id && processedMessageIds.current.has(message.id)) {
      console.debug(`[ChatLog] Message already processed by ID: ${message.id}`);
      return true;
    }

    // Check by request ID for optimistic message replacement
    if (message.requestId && processedRequestIds.current.has(message.requestId)) {
      const existingMessageId = processedRequestIds.current.get(message.requestId);
      if (existingMessageId === message.id) {
        console.debug(`[ChatLog] Message already processed by RequestId: ${message.requestId} -> ${message.id}`);
        return true;
      }
    }

    return false;
  }, []);

  const markMessageAsProcessed = useCallback((message: ChatMessage, transport?: 'websocket' | 'sse' | 'optimistic' | 'unknown') => {
    const source = transport || activeTransport.current || 'unknown';
    const shouldFinalize = !message.isStreaming || message.isFinal;

    if (message.id) {
      if (shouldFinalize) {
        processedMessageIds.current.add(message.id);
      }
      messageSources.current.set(message.id, source);

      // Track message lifecycle
      trackMessageLifecycle(message.id, 'processed', {
        role: message.role,
        requestId: message.requestId,
        transport: source,
        isOptimistic: message.isOptimistic,
        isStreaming: message.isStreaming,
        isFinal: message.isFinal
      });

      console.debug(
        `[ChatLog] Marked message as processed by ID: ${message.id} (role: ${message.role}, type: ${message.messageType}, transport: ${source}, streaming: ${message.isStreaming}, final: ${message.isFinal})`
      );
    }
    if (shouldFinalize && message.requestId) {
      processedRequestIds.current.set(message.requestId, message.id || '');
      console.debug(`[ChatLog] Marked message as processed by RequestId: ${message.requestId} -> ${message.id}`);
    }
  }, [activeTransport, trackMessageLifecycle]);

  // Cleanup processed IDs when project changes to prevent memory leaks
  useEffect(() => {
    const processedIds = processedMessageIds.current;
    const processedRequests = processedRequestIds.current;
    const sources = messageSources.current;
    const lifecycleMap = messageLifecycleRef.current;
    const pendingIds = pendingMessageIds.current;

    return () => {
      console.log('🧹 [Cleanup] Cleaning up ChatLog state for project change');
      processedIds.clear();
      processedRequests.clear();
      sources.clear();
      lifecycleMap.clear();
      pendingIds.clear();
      activeTransport.current = null;
    };
  }, [projectId]);

  // Message recovery mechanism for network interruptions
  const recoverMissingMessages = useCallback(async () => {
    if (!projectId) return;

    try {
      console.log('[ChatLog] Checking for missing messages due to network interruption...');

      // Get current message count from UI state
      const currentMessageCount = messages.length;

      // Get actual message count from database
      const response = await fetch(`/api/chat/${projectId}/messages?limit=1&offset=0`);
      if (!response.ok) return;

      const data = await response.json();
      const totalMessages = data.totalCount || 0;

      // If database has more messages than UI state, trigger a reload flag
      if (totalMessages > currentMessageCount) {
        console.log(`[ChatLog] Detected ${totalMessages - currentMessageCount} missing messages. Setting reload flag...`);
        // Set a flag to trigger reload in the polling effect
        setHasLoadedOnce(false);
      }
    } catch (error) {
      console.error('[ChatLog] Error checking for missing messages:', error);
    }
  }, [projectId, messages.length]);

  const handleRealtimeMessage = useCallback((message: unknown) => {
    const chatMessage = toChatMessage(message);
    const transportSource = activeTransport.current || 'unknown';
    const messageId = chatMessage.id ?? null;

    console.debug(`[ChatLog] Received realtime message: ID=${chatMessage.id}, Role=${chatMessage.role}, Type=${chatMessage.messageType}, RequestId=${chatMessage.requestId}, Streaming=${chatMessage.isStreaming}, Transport=${transportSource}`);

    // Track message lifecycle
    trackMessageLifecycle(chatMessage.id || 'unknown', 'received', {
      role: chatMessage.role,
      requestId: chatMessage.requestId,
      transport: transportSource,
      content: chatMessage.content?.substring(0, 50) + '...'
    });

    const isFinalUpdate = !chatMessage.isStreaming || chatMessage.isFinal;

    if (messageId && pendingMessageIds.current.has(messageId) && !isFinalUpdate) {
      console.debug(`[ChatLog] Message already pending processing: ID=${messageId}`);
      return;
    }

    if (isMessageProcessed(chatMessage)) {
      if (isFinalUpdate) {
        console.debug(`[ChatLog] Final update for already processed message ID=${chatMessage.id}, allowing merge.`);
      } else {
        return;
      }
    }

    // Enhanced transport-based duplicate detection
    if (chatMessage.id) {
      const existingSource = messageSources.current.get(chatMessage.id);
      if (existingSource && existingSource !== transportSource) {
        if (!isFinalUpdate) {
          console.warn(`[ChatLog] Duplicate streaming message from different transport: ID=${chatMessage.id}, existing=${existingSource}, new=${transportSource}. Skipping interim duplicate.`);
          return;
        }
        console.debug(`[ChatLog] Transport changed for final message ID=${chatMessage.id} (${existingSource} -> ${transportSource}). Accepting final update.`);
      }

    }

    if (messageId) {
      pendingMessageIds.current.add(messageId);
    }

    const expandedMessages = expandMessageWithToolPlaceholder(chatMessage);
    console.debug(`[ChatLog] Expanded to ${expandedMessages.length} message(s)`);

    const assistantUpdates = expandedMessages.filter((msg) => msg.role === 'assistant');
    if (assistantUpdates.length > 0) {
      const shouldStopWaiting = assistantUpdates.some((msg) => {
        const normalizedContent = normalizeChatContent(msg.content);
        if (normalizedContent.trim().length > 0) {
          return true;
        }
        return Boolean(msg.isFinal);
      });
      if (shouldStopWaiting) {
        console.debug(`[ChatLog] Stopping wait for response due to assistant updates`);
        setIsWaitingForResponse(false);
      }
    }

    const expandedWithIds = expandedMessages.map((incoming) =>
      incoming.id ? incoming : { ...incoming, id: ensureStableMessageId(incoming) }
    );

    const filteredMessages = expandedWithIds.filter((msg) => {
      if (isMessageProcessed(msg)) {
        return false;
      }
      return true;
    });

    filteredMessages.forEach((msg) => {
      if (
        Array.isArray((msg.metadata as any)?.attachments) &&
        (msg.metadata as any).attachments.length > 0
      ) {
        console.log('🖼️ Realtime message includes attachments:', {
          messageId: msg.id,
          attachments: (msg.metadata as any).attachments,
        });
      }
    });

    let processedInUpdate = false;
    if (filteredMessages.length > 0) {
      setMessages((prev) => {
        const next = integrateMessages(prev, filteredMessages);
        processedInUpdate = next !== prev;
        return next;
      });

      filteredMessages.forEach((messageWithId) => {
        markMessageAsProcessed(messageWithId, transportSource);
      });
    }

    if (messageId) {
      pendingMessageIds.current.delete(messageId);
      if (!processedInUpdate && !processedMessageIds.current.has(messageId)) {
        trackMessageLifecycle(messageId, 'processed', {
          role: chatMessage.role,
          requestId: chatMessage.requestId,
          transport: transportSource,
          skipped: true
        });
      }
    }

    if (!chatMessage.isOptimistic && chatMessage.role === 'user') {
      setNeedsHistoryRefresh(true);
    } else if (!chatMessage.isOptimistic && chatMessage.role === 'assistant' && chatMessage.isFinal) {
      setNeedsHistoryRefresh(true);
    }
  }, [
    setIsWaitingForResponse,
    isMessageProcessed,
    markMessageAsProcessed,
    activeTransport,
    trackMessageLifecycle,
    ensureStableMessageId,
  ]);

  const handleRealtimeStatus = useCallback(
    (status: string, payload?: RealtimeStatus | Record<string, unknown>, requestId?: string) => {
      const statusData = (payload as RealtimeStatus | undefined) ?? undefined;
      const resolvedStatus = statusData?.status ?? status;

      if (statusData?.status && statusData.message && status === 'project_status') {
        onProjectStatusUpdate?.(statusData.status, statusData.message);
      }

      if (resolvedStatus === 'completed') {
        setActiveSession(null);
        onSessionStatusChange?.(false);
        setIsWaitingForResponse(false);
      }

      if (resolvedStatus === 'starting' || resolvedStatus === 'running') {
        setIsWaitingForResponse(true);
      }

      const requestKey = statusData?.requestId ?? requestId;

      if (requestKey && (resolvedStatus === 'starting' || resolvedStatus === 'running')) {
        startRequest?.(requestKey);
      }

      if (requestKey && resolvedStatus === 'completed') {
        completeRequest?.(requestKey, true);
      }

      if (requestKey && resolvedStatus === 'error') {
        completeRequest?.(requestKey, false, statusData?.message);
      }
    },
    [onProjectStatusUpdate, onSessionStatusChange, startRequest, completeRequest]
  );

  const handleRealtimeError = useCallback((error: Error) => {
    console.error('🔌 [Realtime] Error:', error);
    setEnableSseFallback(true);
  }, []);

  const handleRealtimeEnvelope = useCallback(
    (envelope: RealtimeEvent) => {
      switch (envelope.type) {
        case 'message':
          if (envelope.data) {
            handleRealtimeMessage(envelope.data);
          }
          break;
        case 'status': {
          const data = envelope.data ?? { status: envelope.type };
          handleRealtimeStatus(data.status ?? envelope.type, data, data.requestId);
          break;
        }
        case 'error': {
          const message = envelope.error ?? 'Realtime bridge error';
          const rawData = (envelope.data as Record<string, unknown> | undefined) ?? undefined;
          const requestId = (() => {
            if (!rawData) return undefined;
            const direct = rawData.requestId ?? rawData.request_id;
            return typeof direct === 'string' ? direct : undefined;
          })();
          const payload: RealtimeStatus = {
            status: 'error',
            message,
            ...(requestId ? { requestId } : {}),
          };
          handleRealtimeStatus('error', payload, requestId);
          handleRealtimeError(new Error(message));
          break;
        }
        case 'connected': {
          const payload: RealtimeStatus = {
            status: 'connected',
            message: 'Realtime channel connected',
            sessionId: envelope.data?.sessionId,
          };
          handleRealtimeStatus('connected', payload, envelope.data?.sessionId);
          break;
        }
        case 'preview_error': {
          const data = (envelope as { data?: { message?: string; severity?: string } }).data;
          const payload: RealtimeStatus = {
            status: 'preview_error',
            message: data?.message,
            metadata: data?.severity ? { severity: data.severity } : undefined,
          };
          handleRealtimeStatus('preview_error', payload);
          break;
        }
        case 'preview_success': {
          const data = (envelope as { data?: { message?: string; severity?: string } }).data;
          const payload: RealtimeStatus = {
            status: 'preview_success',
            message: data?.message,
            metadata: data?.severity ? { severity: data.severity } : undefined,
          };
          handleRealtimeStatus('preview_success', payload);
          break;
        }
        case 'heartbeat':
          break;
        default: {
          const unknownEnvelope = envelope as { type?: string };
          handleRealtimeStatus(unknownEnvelope.type ?? 'unknown', envelope as unknown as Record<string, unknown>);
          break;
        }
      }
    },
    [handleRealtimeMessage, handleRealtimeStatus, handleRealtimeError]
  );

  // Use the centralized WebSocket hook (with SSE fallback defined below)
  const { isConnected, isConnecting } = useWebSocket({
    projectId,
    onMessage: handleRealtimeMessage,
    onStatus: handleRealtimeStatus,
    onConnect: () => {
      console.log('🔌 [Transport] WebSocket connected, switching to WebSocket transport');
      setEnableSseFallback(false);
      hasLoggedSseFallbackRef.current = false;
      onSseFallbackActive?.(false);
      activeTransport.current = 'websocket';
      if (sseFallbackTimerRef.current) {
        clearTimeout(sseFallbackTimerRef.current);
        sseFallbackTimerRef.current = null;
      }
      // Recover any missing messages that might have been lost during disconnection
      recoverMissingMessages();
    },
    onDisconnect: () => {
      console.log('🔌 [Transport] WebSocket disconnected, preparing SSE fallback');
      setEnableSseFallback(true);
      activeTransport.current = null; // Reset transport to allow SSE to take over
    },
    onError: handleRealtimeError,
  });

  useEffect(() => {
    if (isConnected) {
      setEnableSseFallback(false);
      hasLoggedSseFallbackRef.current = false;
      onSseFallbackActive?.(false);
      if (sseFallbackTimerRef.current) {
        clearTimeout(sseFallbackTimerRef.current);
        sseFallbackTimerRef.current = null;
      }
      return;
    }

    if (isConnecting) {
      if (sseFallbackTimerRef.current) {
        clearTimeout(sseFallbackTimerRef.current);
        sseFallbackTimerRef.current = null;
      }
      return () => {
        if (sseFallbackTimerRef.current) {
          clearTimeout(sseFallbackTimerRef.current);
          sseFallbackTimerRef.current = null;
        }
      };
    }

    if (sseFallbackTimerRef.current) {
      clearTimeout(sseFallbackTimerRef.current);
    }

    sseFallbackTimerRef.current = setTimeout(() => {
      setEnableSseFallback((previous) => previous || true);
    }, 2500);

    return () => {
      if (sseFallbackTimerRef.current) {
        clearTimeout(sseFallbackTimerRef.current);
        sseFallbackTimerRef.current = null;
      }
    };
  }, [isConnected, isConnecting, onSseFallbackActive]);

  useEffect(() => {
    if (!projectId) return;
    if (!enableSseFallback) return;
    if (typeof window === 'undefined') {
      return;
    }

    if (!('EventSource' in window)) {
      return;
    }

    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const resolveStreamUrl = () => {
      const rawBase = process.env.NEXT_PUBLIC_API_BASE?.trim() ?? '';
      const endpoint = `/api/chat/${projectId}/stream`;
      if (rawBase.length > 0) {
        const normalizedBase = rawBase.replace(/\/+$/, '');
        return `${normalizedBase}${endpoint}`;
      }
      return endpoint;
    };

    const connectSse = () => {
      if (disposed) return;

      try {
        if (!hasLoggedSseFallbackRef.current) {
          console.warn('🔄 [Transport] WebSocket unavailable, switching to SSE transport');
          hasLoggedSseFallbackRef.current = true;
        }

        // Only activate SSE if WebSocket is not connected
        if (activeTransport.current === 'websocket') {
          console.log('🔄 [Transport] WebSocket is active, skipping SSE connection');
          return;
        }

        activeTransport.current = 'sse';

        const streamUrl = resolveStreamUrl();
        let source: EventSource;
        try {
          const parsed = new URL(streamUrl, window.location.href);
          if (parsed.origin !== window.location.origin) {
            source = new EventSource(parsed.toString(), { withCredentials: true });
          } else {
            source = new EventSource(parsed.toString());
          }
        } catch {
          source = new EventSource(streamUrl);
        }
        eventSource = source;

        source.onopen = () => {
          console.log('🔄 [Transport] SSE connection established');
          setIsSseConnected(true);
          onSseFallbackActive?.(true);
          // Recover any missing messages that might have been lost during SSE disconnection
          recoverMissingMessages();
        };

        source.onmessage = (event) => {
          if (!event.data) {
            return;
          }
          try {
            const envelope = JSON.parse(event.data) as RealtimeEvent;
            handleRealtimeEnvelope(envelope);
          } catch (error) {
            console.error('🔄 [Realtime] Failed to parse SSE message:', error);
          }
        };

        source.onerror = () => {
          setIsSseConnected(false);
          if (disposed) {
            return;
          }
          if (reconnectTimer) {
            clearTimeout(reconnectTimer);
          }
          console.warn('🔄 [Realtime] SSE connection lost, retrying...');
          source.close();
          reconnectTimer = setTimeout(connectSse, 2000);
        };
      } catch (error) {
        setIsSseConnected(false);
        console.error('🔄 [Realtime] Failed to establish SSE connection:', error);
      }
    };

    connectSse();

    return () => {
      disposed = true;
      setIsSseConnected(false);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [projectId, enableSseFallback, handleRealtimeEnvelope, onSseFallbackActive, recoverMissingMessages]);

  useEffect(() => {
    return () => {
      if (sseFallbackTimerRef.current) {
        clearTimeout(sseFallbackTimerRef.current);
        sseFallbackTimerRef.current = null;
      }
    };
  }, []);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Function to detect tool usage messages based on patterns
  const isToolUsageMessage = useCallback((message: ChatMessage) => {
    const metadata = message.metadata as Record<string, unknown> | null | undefined;
    const content = normalizeChatContent(message.content);

    if (message.messageType === 'tool_use') {
      return true;
    }

    if (metadata) {
      if (
        metadata.toolName ||
        metadata.tool_name ||
        metadata.toolInput ||
        metadata.tool_input ||
        metadata.filePath ||
        metadata.file_path ||
        metadata.action ||
        metadata.operation
      ) {
        return true;
      }

      const derived = deriveToolInfoFromMetadata(metadata);
      if (derived.filePath) {
        return true;
      }
    }
    
    if (!content) return false;

    if (/^\s*\[Tool:/i.test(content)) return true;
    if (/^Using tool:/i.test(content)) return true;
    if (/^Tool result:/i.test(content)) return true;

    if (content.includes('[object Object]')) return true;
    
    const toolPatterns = [
      /\*\*(Read|LS|Glob|Grep|Edit|Write|Bash|Task|WebFetch|WebSearch|MultiEdit|TodoWrite)\*\*/,
    ];
    
    return toolPatterns.some(pattern => pattern.test(content));
  }, []);

  useEffect(scrollToBottom, [messages, logs]);

  useEffect(() => {
    setExpandedToolMessages((prev) => {
      const prevKeys = Object.keys(prev);

      const validKeys = new Set<string>();
      const requestToKey = new Map<string, string>();
      const toolCallToKey = new Map<string, string>();
      const keyToMessage = new Map<string, ChatMessage>();

      messages.forEach((msg) => {
        if (msg.messageType === 'tool_result' || isToolUsageMessage(msg)) {
          const key = ensureStableMessageId(msg);
          validKeys.add(key);
          keyToMessage.set(key, msg);

          if (msg.requestId) {
            requestToKey.set(msg.requestId, key);
          }

          const metadata =
            msg.metadata && typeof msg.metadata === 'object'
              ? (msg.metadata as Record<string, unknown>)
              : null;
          const toolCallId = extractToolCallId(metadata);
          if (toolCallId) {
            toolCallToKey.set(toolCallId, key);
          }
        }
      });

      if (validKeys.size === 0) {
        return prev;
      }

      let changed = false;
      const next: Record<string, ToolExpansionState> = {};

      validKeys.forEach((key) => {
        const messageForKey = keyToMessage.get(key);
        if (!messageForKey) {
          return;
        }

        const metadata =
          messageForKey.metadata && typeof messageForKey.metadata === 'object'
            ? (messageForKey.metadata as Record<string, unknown>)
            : null;
        const updatedRequestId = messageForKey.requestId ?? null;
        const updatedToolCallId = extractToolCallId(metadata);

        const prevState = prev[key];
        const expanded = prevState?.expanded ?? false;

        if (
          prevState?.requestId !== updatedRequestId ||
          prevState?.toolCallId !== updatedToolCallId
        ) {
          changed = true;
        }

        next[key] = {
          expanded,
          requestId: updatedRequestId,
          toolCallId: updatedToolCallId,
        };
      });

      prevKeys.forEach((oldKey) => {
        if (validKeys.has(oldKey)) {
          return;
        }

        const previousState = prev[oldKey];
        if (!previousState) {
          return;
        }

        const transferKey =
          (previousState.toolCallId ? toolCallToKey.get(previousState.toolCallId) : undefined) ??
          (previousState.requestId ? requestToKey.get(previousState.requestId) : undefined);

        if (transferKey && !next[transferKey]) {
          const targetMessage = keyToMessage.get(transferKey);
          const targetMetadata =
            targetMessage && targetMessage.metadata && typeof targetMessage.metadata === 'object'
              ? (targetMessage.metadata as Record<string, unknown>)
              : null;
          const targetRequestId = targetMessage?.requestId ?? previousState.requestId ?? null;
          const targetToolCallId =
            extractToolCallId(targetMetadata) ?? previousState.toolCallId ?? null;

          next[transferKey] = {
            expanded: previousState.expanded,
            requestId: targetRequestId,
            toolCallId: targetToolCallId,
          };
          changed = true;
        } else if (!transferKey) {
          changed = true;
        }
      });

      if (!changed && Object.keys(next).length === prevKeys.length) {
        return prev;
      }

      return next;
    });
  }, [messages, ensureStableMessageId, isToolUsageMessage]);

  useEffect(() => {
    const validIds = new Set<string>();

    messages.forEach((msg) => {
      if (msg.messageType === 'tool_result') {
        const id = msg.id ?? ensureStableMessageId(msg);
        if (id) {
          validIds.add(id);
        }
      }
    });

    const visibleSet = visibleToolMessageIdsRef.current;
    Array.from(visibleSet).forEach((id) => {
      if (!validIds.has(id)) {
        visibleSet.delete(id);
      }
    });
  }, [messages, ensureStableMessageId]);

  // Load chat history
  const loadChatHistory = useCallback(
    async ({ showLoading }: { showLoading?: boolean } = {}) => {
      const shouldShowLoading = showLoading ?? !hasLoadedInitialDataRef.current;
      let didSucceed = false;
      if (shouldShowLoading) {
        setIsLoading(true);
      }

      try {
        // Load more messages per request to reduce pagination needs
        const response = await fetch(`${API_BASE}/api/chat/${projectId}/messages?limit=200&offset=0`);
        if (response.ok) {
          didSucceed = true;
          const payload = await response.json();
          const chatMessages = Array.isArray(payload)
            ? payload
            : payload?.data ?? payload?.messages ?? [];
          const normalized = Array.isArray(chatMessages)
            ? expandMessagesList(chatMessages.map(toChatMessage), ensureStableMessageId)
            : [];

          console.log('[ChatLog] Loaded messages from API:', {
            totalMessages: normalized.length,
            messagesWithMetadata: normalized.filter(msg => !!msg.metadata).length,
            messagesWithAttachments: normalized.filter(msg =>
              msg.metadata &&
              typeof msg.metadata === 'object' &&
              (msg.metadata as any).attachments
            ).length,
            sampleMessageMetadata: normalized[0]?.metadata
          });

          // Update pagination state
          if (payload.pagination) {
            console.log(`[ChatLog] Loaded ${payload.pagination.count}/${payload.totalCount} messages`);
            setHasMoreMessages(payload.pagination.hasMore || false);
            setTotalMessageCount(payload.totalCount || 0);
          } else {
            setHasMoreMessages(false);
            setTotalMessageCount(normalized.length);
          }

          normalized.forEach((message) => {
            if (Array.isArray((message.metadata as any)?.attachments) && (message.metadata as any).attachments.length > 0) {
              console.log('🖼️ DB loaded message with attachments:', {
                messageId: message.id,
                attachments: (message.metadata as any).attachments,
              });
            }
          });

          setMessages((prev) => integrateMessages(prev, normalized));
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Failed to load chat history (network issue):', error);
        }
      } finally {
        if (shouldShowLoading) {
          setIsLoading(false);
        }
        hasLoadedInitialDataRef.current = true;
        setHasLoadedOnce(true);
      }
    },
    [projectId, ensureStableMessageId]
  );

  useEffect(() => {
    if (!needsHistoryRefresh) {
      return;
    }
    const timer = setTimeout(() => {
      setNeedsHistoryRefresh(false);
      void loadChatHistory({ showLoading: false });
    }, 250);
    return () => clearTimeout(timer);
  }, [needsHistoryRefresh, loadChatHistory]);

  // Load older messages (pagination)
  const loadOlderMessages = useCallback(async () => {
    if (!projectId || !hasMoreMessages) return;

    try {
      const currentOffset = messages.length;
      const response = await fetch(`${API_BASE}/api/chat/${projectId}/messages?limit=100&offset=${currentOffset}`);

      if (response.ok) {
        const payload = await response.json();
        const chatMessages = Array.isArray(payload)
          ? payload
          : payload?.data ?? payload?.messages ?? [];
        const normalized = Array.isArray(chatMessages)
          ? expandMessagesList(chatMessages.map(toChatMessage), ensureStableMessageId)
          : [];

        // Update pagination state
        if (payload.pagination) {
          setHasMoreMessages(payload.pagination.hasMore || false);
          setTotalMessageCount(payload.totalCount || 0);
          console.log(`[ChatLog] Loaded ${payload.pagination.count} older messages (${messages.length + normalized.length}/${payload.totalCount} total)`);
        }

        // Prepend older messages to the existing list
        if (normalized.length > 0) {
          setMessages((prev) => integrateMessages(prev, normalized));
        }
      }
    } catch (error) {
      console.error('[ChatLog] Failed to load older messages:', error);
    }
  }, [projectId, hasMoreMessages, messages.length, ensureStableMessageId]);

  // Poll session status periodically
  const startSessionPolling = useCallback(
    (sessionId: string) => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      pollIntervalRef.current = setInterval(async () => {
        try {
          const response = await fetch(
            `${API_BASE}/api/chat/${projectId}/sessions/${sessionId}/status`
          );
          if (response.ok) {
            const sessionStatus = await response.json();

            if (sessionStatus.status !== 'active') {
              setActiveSession(null);
              onSessionStatusChange?.(false);

              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }

              // Trigger reload flag instead of direct call
          setHasLoadedOnce(false);
            }
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Error polling session status:', error);
          }
        }
      }, 3000); // Poll every 3 seconds
    },
    [projectId, onSessionStatusChange]
  );

  // Check for active session on component mount
  const checkActiveSession = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/chat/${projectId}/active-session`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const session = result.data;
          const sessionData: ActiveSession = {
            status: session.status,
            sessionId: session.sessionId,
          };
          setActiveSession(sessionData);

          if (session.status === 'active' || session.status === 'running') {
            if (process.env.NODE_ENV === 'development') {
              console.log('Found active session:', session.sessionId);
            }
            onSessionStatusChange?.(true);

            // Start polling session status
            startSessionPolling(session.sessionId);
          } else {
            onSessionStatusChange?.(false);
          }
        } else {
          // No active session found
          setActiveSession(null);
          onSessionStatusChange?.(false);
        }
      } else {
        // 404 means no active session, which is normal
        setActiveSession(null);
        onSessionStatusChange?.(false);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to check active session:', error);
      }
      setActiveSession(null);
      onSessionStatusChange?.(false);
    }
  }, [projectId, onSessionStatusChange, startSessionPolling]);

  // Enhanced polling system to prevent conflicts with real-time connections
  useEffect(() => {
    if (!projectId) return;

    // Don't poll if we have active real-time connections
    if (isConnected || isSseConnected) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const isStreamingMessagePending = messages.some(
      (message) => message.role === 'assistant' && message.isStreaming && !message.isFinal
    );

    if (isStreamingMessagePending) {
      return;
    }

    // Only poll when both WebSocket and SSE are disconnected
    const shouldPoll = !isConnected && !isSseConnected && enableSseFallback;

    if (!shouldPoll) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(() => {
      // Double-check connection status before polling
      if (isConnected || isSseConnected) {
        console.debug(`[ChatLog] Stopping polling due to active connection: WebSocket=${isConnected}, SSE=${isSseConnected}`);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        return;
      }

      console.debug(`[ChatLog] Polling for chat history updates...`);
      loadChatHistory({ showLoading: false }).catch(() => {
        // Suppress polling errors; realtime channels may still recover.
        console.debug(`[ChatLog] Polling completed with errors (suppressed)`);
      });
    }, 3000); // Consistent 3-second interval when polling

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [projectId, isConnected, isSseConnected, enableSseFallback, messages, loadChatHistory]);

  // Initial load
  useEffect(() => {
    if (!projectId) return;
    
    let mounted = true;
    
    const loadData = async () => {
      if (mounted) {
        await loadChatHistory({ showLoading: true });
        await checkActiveSession();
      }
    };
    
    loadData();
    
    return () => {
      mounted = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [projectId, checkActiveSession, loadChatHistory]);

  useEffect(() => {
    hasLoadedInitialDataRef.current = false;
    setHasLoadedOnce(false);
    setIsLoading(true);
    setMessages([]);
    setLogs([]);
    setExpandedToolMessages({});
    fallbackMessageIdRef.current.clear();
    visibleToolMessageIdsRef.current.clear();
  }, [projectId]);

  // Handle log entries from other WebSocket data
  const handleWebSocketData = (data: any) => {
    // Filter out system-internal messages that shouldn't be shown to users
    const internalMessageTypes = [
      'cli_output',        // CLI execution logs
      'session_status',    // Session state updates  
      'status',            // Generic status updates
      'message',           // Already handled by onMessage
      'project_status',    // Already handled by onStatus
      'act_complete'       // Already handled by onStatus
    ];
    
    // Only add to logs if it's not an internal message type
    if (!internalMessageTypes.includes(data.type)) {
      const logEntry: LogEntry = {
        id: `${Date.now()}-${Math.random()}`,
        type: data.type,
        data: data.data || data,
        timestamp: data.timestamp || new Date().toISOString()
      };
      
      setLogs(prev => [...prev, logEntry]);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // Function to convert file paths to relative paths
  const shortenPath = (text: string) => {
    if (!text) return text;
    return toRelativePath(text);
  };

const ToolResultMessage = ({
  message,
  metadata,
  isExpanded,
  onToggle,
}: {
  message: ChatMessage;
  metadata?: Record<string, unknown> | null;
  isExpanded?: boolean;
  onToggle?: (nextExpanded: boolean) => void;
}) => {
  return (
    <ToolMessage
      content={normalizeChatContent(message.content)}
      metadata={metadata ?? undefined}
      isExpanded={isExpanded}
      onToggle={onToggle}
    />
  );
};

  // Function to clean user messages by removing think hard instruction and chat mode instructions
  const cleanUserMessage = (content: string) => {
    if (!content) return content;
    
    let cleanedContent = content;
    
    // Remove think hard instruction
    cleanedContent = cleanedContent.replace(/\.\s*think\s+hard\.\s*$/, '');
    
    // Remove chat mode instruction
    cleanedContent = cleanedContent.replace(/\n\nDo not modify code, only answer to the user's request\.$/, '');
    
    return cleanedContent.trim();
  };

  // Function to render content with thinking tags
  const renderContentWithThinking = (content: string): ReactElement => {
    const parts: ReactElement[] = [];
    let lastIndex = 0;
    let segmentCounter = 0;
    const createKey = (prefix: string) => `${prefix}-${segmentCounter++}`;
    const regex = /<thinking>([\s\S]*?)<\/thinking>/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      // Add text before the thinking tag (with markdown)
      if (match.index > lastIndex) {
        const beforeText = content.slice(lastIndex, match.index).trim();
        if (beforeText) {
          parts.push(
            <ReactMarkdown 
              key={createKey('text-before')}
              components={{
                p: ({children}) => <p className="mb-2 last:mb-0 break-words">{children}</p>,
                strong: ({children}) => <strong className="font-medium">{children}</strong>,
                em: ({children}) => <em className="italic">{children}</em>,
                code: ({children}) => <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{children}</code>,
                pre: ({children}) => <pre className="bg-gray-100 p-3 rounded-lg my-2 overflow-x-auto text-xs break-words">{children}</pre>,
                ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                li: ({children}) => <li className="mb-1 break-words">{children}</li>
              }}
            >
              {beforeText}
            </ReactMarkdown>
          );
        }
      }

      // Add the thinking section using the new component
      const thinkingText = match[1].trim();
      if (thinkingText) {
        parts.push(
          <ThinkingSection 
            key={createKey('thinking')}
            content={thinkingText}
          />
        );
      }

      lastIndex = regex.lastIndex;
    }

    // Add remaining text after the last thinking tag (with markdown)
    if (lastIndex < content.length) {
      const remainingText = content.slice(lastIndex).trim();
      if (remainingText) {
        parts.push(
          <ReactMarkdown 
            key={createKey('text-after')}
            components={{
              p: ({children}) => {
                // Check for Planning tool message pattern
                const childrenArray = React.Children.toArray(children);
                const hasPlanning = childrenArray.some(child => {
                  if (typeof child === 'string' && child.includes('Planning for next moves...')) {
                    return true;
                  }
                  return false;
                });
                if (hasPlanning) {
                  return <p className="mb-2 last:mb-0 break-words">
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                      Planning for next moves...
                    </code>
                  </p>;
                }
                return <p className="mb-2 last:mb-0 break-words">{children}</p>;
              },
              strong: ({children}) => <strong className="font-medium">{children}</strong>,
              em: ({children}) => <em className="italic">{children}</em>,
              code: ({children}) => <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{children}</code>,
              pre: ({children}) => <pre className="bg-gray-100 p-3 rounded-lg my-2 overflow-x-auto text-xs break-words">{children}</pre>,
              ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
              ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
              li: ({children}) => <li className="mb-1 break-words">{children}</li>
            }}
          >
            {remainingText}
          </ReactMarkdown>
        );
      }
    }

    // If no thinking tags found, return original content with markdown
    if (parts.length === 0) {
      return (
        <ReactMarkdown 
          components={{
            p: ({children}) => {
              // Check if this paragraph contains Planning tool message
              // The message now comes as plain text "Planning for next moves..."
              // ReactMarkdown passes the whole paragraph with child elements
              const childrenArray = React.Children.toArray(children);
              const hasPlanning = childrenArray.some(child => {
                if (typeof child === 'string' && child.includes('Planning for next moves...')) {
                  return true;
                }
                return false;
              });
              if (hasPlanning) {
                return <p className="mb-2 last:mb-0 break-words">
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                    Planning for next moves...
                  </code>
                </p>;
              }
              return <p className="mb-2 last:mb-0 break-words">{children}</p>;
            },
            strong: ({children}) => <strong className="font-medium">{children}</strong>,
            em: ({children}) => <em className="italic">{children}</em>,
            code: ({children}) => <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{children}</code>,
            pre: ({children}) => <pre className="bg-gray-100 p-3 rounded-lg my-2 overflow-x-auto text-xs break-words">{children}</pre>,
            ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
            ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
            li: ({children}) => <li className="mb-1 break-words">{children}</li>
          }}
        >
          {content}
        </ReactMarkdown>
      );
    }

    return <>{parts}</>;
  };

  // Function to get message type label and styling
  const getMessageTypeInfo = (message: ChatMessage) => {
    const { role, messageType } = message;
    
    // Handle different message types
    switch (messageType) {
      case 'tool_result':
        return {
          bgClass: 'bg-blue-50 border border-blue-200 ',
          textColor: 'text-blue-900 ',
          labelColor: 'text-blue-600 '
        };
      case 'system':
        return {
          bgClass: 'bg-green-50 border border-green-200 ',
          textColor: 'text-green-900 ',
          labelColor: 'text-green-600 '
        };
      case 'error':
        return {
          bgClass: 'bg-red-50 border border-red-200 ',
          textColor: 'text-red-900 ',
          labelColor: 'text-red-600 '
        };
      case 'info':
        return {
          bgClass: 'bg-yellow-50 border border-yellow-200 ',
          textColor: 'text-yellow-900 ',
          labelColor: 'text-yellow-600 '
        };
      default:
        // Handle by role
        switch (role) {
          case 'user':
            return {
              bgClass: 'bg-white border border-gray-200 ',
              textColor: 'text-gray-900 ',
              labelColor: 'text-gray-600 '
            };
          case 'system':
            return {
              bgClass: 'bg-green-50 border border-green-200 ',
              textColor: 'text-green-900 ',
              labelColor: 'text-green-600 '
            };
          case 'tool':
            return {
              bgClass: 'bg-purple-50 border border-purple-200 ',
              textColor: 'text-purple-900 ',
              labelColor: 'text-purple-600 '
            };
          case 'assistant':
          default:
            return {
              bgClass: 'bg-white border border-gray-200 ',
              textColor: 'text-gray-900 ',
              labelColor: 'text-gray-600 '
            };
        }
    }
  };

  // Message filtering function - hide internal tool results and system messages
  const shouldDisplayMessage = (message: ChatMessage) => {
    const metadata = message.metadata as Record<string, unknown> | null | undefined;
    const contentText = normalizeChatContent(message.content);

    if (metadata && (metadata as { hidden_from_ui?: boolean }).hidden_from_ui) {
      return false;
    }

    if (metadata && (metadata as { isTransientToolMessage?: boolean }).isTransientToolMessage) {
      if (
        message.messageType === 'tool_use' ||
        message.messageType === 'tool_result' ||
        message.role === 'tool'
      ) {
        // Keep transient tool updates visible so users can follow in-flight work
      } else {
        return false;
      }
    }

    // **Important**: Always display messages that include attachments
    if (metadata && metadata.attachments && Array.isArray(metadata.attachments) && metadata.attachments.length > 0) {
      console.log('🖼️ Message has attachments, displaying:', { messageId: message.id, attachments: metadata.attachments });
      return true;
    }

    if (message.messageType === 'tool_result') {
      const messageId = message.id ?? ensureStableMessageId(message);
      const visibleSet = visibleToolMessageIdsRef.current;

      const hasContent = contentText.trim().length > 0;
      let shouldShow = hasContent;

      if (!shouldShow && metadata) {
        const meta = metadata as Record<string, unknown>;
        const summary =
          pickFirstString(meta.summary) ??
          pickFirstString(meta.result) ??
          pickFirstString(meta.resultSummary) ??
          pickFirstString(meta.result_summary) ??
          pickFirstString(meta.command) ??
          pickFirstString(meta.content) ??
          pickFirstString(meta.output);
        const diff =
          pickFirstString(meta.diff) ??
          pickFirstString(meta.diff_info) ??
          pickFirstString(meta.toolOutput) ??
          pickFirstString(meta.tool_output);
        const toolName =
          pickFirstString(meta.tool_name) ??
          pickFirstString(meta.toolName) ??
          pickFirstString(meta.action);
        shouldShow = Boolean(summary ?? diff ?? toolName);
      }

      if (shouldShow) {
        if (messageId) {
          visibleSet.add(messageId);
        }
        return true;
      }

      if (messageId && visibleSet.has(messageId)) {
        return true;
      }

      return false;
    }

    if (message.messageType === 'tool_use' || isToolUsageMessage(message)) {
      return true;
    }

    // **Important**: Also display messages that match the legacy image-path pattern
    if (contentText && contentText.includes('Image #') && contentText.includes('path:')) {
      console.log('🖼️ Message contains image paths, displaying:', { messageId: message.id, content: contentText });
      return true;
    }

    if (!contentText || contentText.trim() === '') {
      return false;
    }

    if (message.role === 'system' && message.messageType === 'system') {
      if (contentText.includes('initialized') || contentText.includes('Agent')) {
        return false;
      }
    }

    return true;
  };

  const renderLogEntry = (log: LogEntry) => {
    switch (log.type) {
      case 'system':
        return (
          <div>
            System connected (Model: {log.data.model || 'Unknown'})
          </div>
        );

      case 'act_start':
        return (
          <div>
            Starting task: {shortenPath(log.data.instruction)}
          </div>
        );

      case 'text':
        return (
          <div>
            <ReactMarkdown 
              components={{
                p: ({children}) => <p className="mb-2 last:mb-0 break-words">{children}</p>,
                strong: ({children}) => <strong className="font-medium">{children}</strong>,
                em: ({children}) => <em className="italic">{children}</em>,
                code: ({children}) => <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono break-all">{children}</code>,
                pre: ({children}) => <pre className="bg-gray-100 p-3 rounded-lg my-2 overflow-x-auto text-xs break-words">{children}</pre>,
                ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                li: ({children}) => <li className="mb-1 break-words">{children}</li>
              }}
            >
              {shortenPath(log.data.content)}
            </ReactMarkdown>
          </div>
        );

      case 'thinking':
        return (
          <div className="italic">
            Thinking: {shortenPath(log.data.content)}
          </div>
        );

      case 'tool_start':
        return (
          <div>
            Using tool: {shortenPath(log.data.summary || log.data.tool_name)}
          </div>
        );

      case 'tool_result':
        const isError = log.data.is_error;
        return (
          <div>
            {shortenPath(log.data.summary)} {isError ? 'failed' : 'completed'}
          </div>
        );

      case 'result':
        return (
          <div>
            Task completed ({log.data.duration_ms}ms, {log.data.turns} turns
            {log.data.total_cost_usd && `, $${log.data.total_cost_usd.toFixed(4)}`})
          </div>
        );

      case 'act_complete':
        return (
          <div className="font-medium">
            Task completed: {shortenPath(log.data.commit_message || log.data.changes_summary)}
          </div>
        );

      case 'error':
        return (
          <div>
            Error occurred: {shortenPath(log.data.message)}
          </div>
        );

      default:
        return (
          <div>
            {log.type}: {typeof log.data === 'object' ? JSON.stringify(log.data).substring(0, 100) : String(log.data).substring(0, 100)}...
          </div>
        );
    }
  };

  const openDetailModal = (log: LogEntry) => {
    setSelectedLog(log);
  };

  const closeDetailModal = () => {
    setSelectedLog(null);
  };

  const renderDetailModal = () => {
    if (!selectedLog) return null;

    const { type, data } = selectedLog;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
        >
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-auto border border-gray-200 ">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 ">Log Details</h3>
            <button
              onClick={closeDetailModal}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div className="text-gray-900 ">
              <strong className="text-gray-700 ">Type:</strong> {type}
            </div>
            <div className="text-gray-900 ">
              <strong className="text-gray-700 ">Time:</strong> {formatTime(selectedLog.timestamp)}
            </div>

            {type === 'tool_result' && data.diff_info && (
              <div>
                <strong className="text-gray-700 ">Changes:</strong>
                <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto text-xs font-mono">
                  {data.diff_info}
                </pre>
              </div>
            )}

            <div>
              <strong className="text-gray-700 ">Detailed Data:</strong>
              <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto text-xs font-mono">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </div>
          </div>
        </motion.div>
      </div>
    );
  };

  // Expose add/remove message functions to parent
  useEffect(() => {
    if (onAddUserMessage) {
      const addMessage = (message: ChatMessage) => {
        console.log('🔄 [Parent] Adding message via parent callback:', {
          messageId: message.id,
          role: message.role,
          isOptimistic: message.isOptimistic,
          requestId: message.requestId
        });

        setMessages((prev) => {
          const exists = prev.some(m => m.id === message.id);
          if (exists) {
            console.log('🔄 [Parent] Message already exists, skipping:', message.id);
            return prev;
          }

          // Enhanced optimistic message replacement with atomic operation
          if (message.requestId && !message.isOptimistic) {
            const optimisticMessages = prev.filter(
              (m) => m.isOptimistic && m.requestId === message.requestId
            );

            if (optimisticMessages.length > 0) {
              console.log('🔄 [Parent] Found optimistic messages to replace via parent callback:', {
                count: optimisticMessages.length,
                requestId: message.requestId,
                realId: message.id,
                realRole: message.role,
                optimisticIds: optimisticMessages.map(m => m.id)
              });

              // Atomic operation: remove ALL optimistic messages for this requestId
              let newMessages = [...prev];
              optimisticMessages.forEach(optimisticMessage => {
                const index = newMessages.findIndex(m => m.id === optimisticMessage.id);
                if (index !== -1) {
                  console.log('🔄 [Parent] Removing optimistic message:', optimisticMessage.id);
                  newMessages.splice(index, 1);
                }
              });

              return [...newMessages, message];
            }
          }

          return [...prev, message];
        });
      };

      const removeMessage = (messageId: string) => {
        console.log('🔄 [Parent] Removing message via parent callback:', messageId);
        setMessages((prev) => prev.filter(m => m.id !== messageId));
      };

      onAddUserMessage({ add: addMessage, remove: removeMessage });
    }
  }, [onAddUserMessage]);

  return (
    <div className="flex flex-col h-full bg-white ">

      {/* Error Display */}
      {hasError && (
        <div className="mx-8 mt-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Connection error
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  <p>{errorMessage}</p>
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    Retrying automatically in a few seconds...
                  </p>
                </div>
              </div>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={clearError}
                className="inline-flex text-red-400 hover:text-red-600 focus:outline-none focus:text-red-600 transition-colors"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Display messages and logs together */}
      <div className="flex-1 overflow-y-auto px-8 py-3 space-y-2 custom-scrollbar ">
        {isLoading && !hasLoadedOnce && !hasError && (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mb-2 mx-auto"></div>
              <p>Loading chat history...</p>
            </div>
          </div>
        )}
        
        {!isLoading && messages.length === 0 && logs.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            <div className="text-center">
              <div className="text-2xl mb-2">💬</div>
              <p>Start a conversation with your agent</p>
            </div>
          </div>
        )}

        {/* Load older messages button */}
        {hasMoreMessages && (
          <div className="mb-4 flex justify-center">
            <button
              onClick={loadOlderMessages}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : `Load older messages (${totalMessageCount - messages.length} remaining)`}
            </button>
          </div>
        )}

        {/* Render chat messages */}
        {messages.filter(shouldDisplayMessage).map((message, index) => {
          const messageMetadata = message.metadata as Record<string, unknown> | null;
          const messageText = normalizeChatContent(message.content);
          const isToolMessage = message.messageType === 'tool_result' || isToolUsageMessage(message);
          const toolMessageKey = isToolMessage
            ? ensureStableMessageId(message)
            : null;
          const reactKey = message.id ?? toolMessageKey ?? `message-${index}`;
          const toolExpanded =
            toolMessageKey != null ? expandedToolMessages[toolMessageKey]?.expanded : undefined;
          const onToggleTool =
            toolMessageKey != null
              ? (nextExpanded: boolean) => handleToolMessageToggle(message, toolMessageKey, nextExpanded)
              : undefined;

          return (
            <div className="mb-4" key={reactKey}>
                {message.role === 'user' ? (
                  // User message - boxed on the right
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-gray-100 rounded-lg px-4 py-3">
                      <div className="text-sm text-gray-900 break-words">
                        {(() => {
                          const cleanedMessage = cleanUserMessage(messageText);
                          
                          // Check if message contains image paths
                          const imagePattern = /Image #\d+ path: ([^\n]+)/g;
                          const imagePaths: string[] = [];
                          let match;
                          
                          while ((match = imagePattern.exec(cleanedMessage)) !== null) {
                            imagePaths.push(match[1]);
                          }
                          
                          // Remove image paths from message
                          const messageWithoutPaths = cleanedMessage.replace(/\n*Image #\d+ path: [^\n]+/g, '').trim();
                          
                          return (
                            <>
                              {messageWithoutPaths && (
                                <div>{shortenPath(messageWithoutPaths)}</div>
                              )}
                              {(() => {
                                // Use attachments from metadata if available, otherwise fallback to parsed paths
                                const attachments = Array.isArray((messageMetadata as Record<string, any>)?.attachments)
                                  ? ((messageMetadata as Record<string, any>).attachments as any[])
                                  : [];
                                console.log('🖼️ Message attachments:', attachments);
                                if (attachments.length > 0) {
                                  return (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {attachments.map((attachment: any, idx: number) => {
                                        console.log(`🖼️ Processing attachment ${idx}:`, attachment);
                                        const candidateRawUrls: string[] = [];
                                        const pushCandidate = (value: unknown) => {
                                          if (typeof value === 'string') {
                                            const trimmed = value.trim();
                                            if (trimmed.length > 0) {
                                              candidateRawUrls.push(trimmed);
                                            }
                                          }
                                        };

                                        pushCandidate((attachment as Record<string, unknown>)?.publicUrl);
                                        pushCandidate((attachment as Record<string, unknown>)?.public_url);
                                        pushCandidate((attachment as Record<string, unknown>)?.url);
                                        pushCandidate((attachment as Record<string, unknown>)?.assetUrl);

                                        const uniqueCandidates = Array.from(new Set(candidateRawUrls));
                                        if (uniqueCandidates.length === 0) {
                                          console.log(`🖼️ No URL found for attachment ${idx}`);
                                          return null;
                                        }
                                        const resolveUrl = (value: string) => {
                                          if (/^https?:\/\//i.test(value)) {
                                            return value;
                                          }
                                          // Handle correctly even when API_BASE is empty
                                          if (value.startsWith('/')) {
                                            return API_BASE ? `${API_BASE}${value}` : value;
                                          }
                                          return API_BASE ? `${API_BASE}/${value}` : `/${value}`;
                                        };
                                        const resolvedCandidates = uniqueCandidates.map(resolveUrl);
                                        const imageUrl =
                                          resolvedCandidates.find(url => !failedImageUrls.has(url)) ??
                                          resolvedCandidates[0];
                                        if (!imageUrl) {
                                          console.log(`🖼️ Failed to resolve any URL for attachment ${idx}`);
                                          return null;
                                        }
                                        const allCandidatesFailed = resolvedCandidates.every(url => failedImageUrls.has(url));
                                        console.log(`🖼️ Resolved image URL for attachment ${idx}:`, imageUrl, {
                                          candidates: resolvedCandidates,
                                          allCandidatesFailed,
                                        });

                                        const handleImageError = () => {
                                          console.error('❌ Image failed to load:', imageUrl);
                                          setFailedImageUrls(prev => {
                                            const next = new Set(prev);
                                            next.add(imageUrl);
                                            return next;
                                          });
                                        };

                                        return (
                                          <div key={idx} className="relative group">
                                            <div className="w-40 h-40 bg-gray-200 rounded-lg overflow-hidden border border-gray-300 ">
                                              {allCandidatesFailed ? (
                                                // Show an icon when loading fails
                                                <div className="w-full h-full flex items-center justify-center">
                                                  <svg className="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                  </svg>
                                                </div>
                                              ) : (
                                                // Display the image when it loads successfully
                                                /* eslint-disable-next-line @next/next/no-img-element */
                                                <img
                                                  src={imageUrl}
                                                  alt={`Image ${idx + 1}`}
                                                  className="w-full h-full object-cover"
                                                  onError={handleImageError}
                                                />
                                              )}
                                            </div>
                                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-lg transition-opacity flex items-center justify-center">
                                              <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-60 px-2 py-1 rounded">
                                                #{idx + 1}
                                              </span>
                                            </div>
                                            {/* Tooltip with filename */}
                                            <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                              {toRelativePath(attachment.name)}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                } else if (imagePaths.length > 0) {
                                  // Fallback to old method for backward compatibility
                                  return (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {imagePaths.map((path, idx) => {
                                        const filename = path.split('/').pop() || 'image';
                                        return (
                                          <div key={idx} className="relative group">
                                            <div className="w-40 h-40 bg-gray-200 rounded-lg overflow-hidden border border-gray-300 flex items-center justify-center">
                                              <svg className="w-16 h-16 text-gray-400 " fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                              </svg>
                                            </div>
                                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-lg transition-opacity flex items-center justify-center">
                                              <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-60 px-2 py-1 rounded">
                                                #{idx + 1}
                                              </span>
                                            </div>
                                            {/* Tooltip with filename */}
                                            <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                              {filename}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Agent message - full width, no box
                  <div className="w-full">
                    {message.messageType === 'tool_result' ? (
                      <ToolResultMessage
                        message={message}
                        metadata={messageMetadata}
                        isExpanded={toolExpanded}
                        onToggle={onToggleTool}
                      />
                    ) : isToolUsageMessage(message) ? (
                      // Tool usage - clean display with expand functionality
                      <ToolMessage
                        content={messageText}
                        metadata={messageMetadata}
                        isExpanded={toolExpanded}
                        onToggle={onToggleTool}
                      />
                    ) : (
                      // Regular agent message - plain text
                      <div className="text-sm text-gray-900 leading-relaxed">
                        {renderContentWithThinking(shortenPath(messageText))}
                      </div>
                    )}
                  </div>
                )}
            </div>
          );
        })}
        
        {/* Render filtered agent logs as plain text */}
        {logs.filter(log => {
          // Hide internal tool results and system logs
          const hideTypes = ['tool_result', 'tool_start', 'system'];
          return !hideTypes.includes(log.type);
        }).map((log, index) => (
          <div
            key={log.id ?? `log-${index}`}
            className="mb-4 w-full cursor-pointer"
            onClick={() => openDetailModal(log)}
          >
            <div className="text-sm text-gray-900 leading-relaxed">
              {renderLogEntry(log)}
            </div>
          </div>
        ))}
        
        {/* Loading indicator for waiting response */}
        {isWaitingForResponse && (
          <div className="mb-4 w-full">
            <div className="text-xl text-gray-900 leading-relaxed font-bold">
              <span className="animate-pulse">...</span>
            </div>
          </div>
        )}
        
        <div ref={logsEndRef} />
      </div>

      {/* Detail modal */}
      <AnimatePresence initial={false}>
        {selectedLog && renderDetailModal()}
      </AnimatePresence>
    </div>
  );
}
