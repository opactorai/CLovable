"use client";
import React, { useEffect, useState, useRef, ReactElement, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Brain } from 'lucide-react';
import ToolResultItem from './ToolResultItem';
import ThinkingSection from './ThinkingSection';
import type { ChatMessage, RealtimeEvent, RealtimeStatus } from '@/types';
import { toChatMessage } from '@/lib/serializers/client/chat';
import { toRelativePath } from '@/lib/utils/path';

type ToolAction = 'Edited' | 'Created' | 'Read' | 'Deleted' | 'Generated' | 'Searched' | 'Executed';

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

const randomMessageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `msg_${Math.random().toString(36).slice(2, 11)}`;
};

const createToolMessageFromPlaceholder = (message: ChatMessage): { toolMessage: ChatMessage; skipOriginal: boolean } | null => {
  const details = parseToolPlaceholder(message.content);
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
    content: summary ?? target ?? (toolName ? `[Tool: ${toolName}]` : message.content ?? ''),
    metadata,
  };

  const skipOriginal =
    !message.metadata &&
    (!message.content ||
      /^\s*\[Tool:/i.test(message.content) ||
      /^Using tool:/i.test(message.content) ||
      /^Tool result:/i.test(message.content));

  if (!metadata.filePath) {
    metadata.filePath = fallbackPath;
    metadata.file_path = fallbackPath;
  }

  if (!metadata.summary && summary) {
    metadata.summary = summary;
  }

  return { toolMessage, skipOriginal };
};

const expandMessageWithToolPlaceholder = (message: ChatMessage): ChatMessage[] => {
  const conversion = message.messageType === 'tool_use' ? null : createToolMessageFromPlaceholder(message);
  if (!conversion) {
    return [message];
  }

  const { toolMessage, skipOriginal } = conversion;
  if (skipOriginal) {
    return [toolMessage];
  }
  return [toolMessage, message];
};

const expandMessagesList = (messages: ChatMessage[]): ChatMessage[] => {
  const result: ChatMessage[] = [];
  const seen = new Set<string>();

  messages.forEach((message) => {
    const expanded = expandMessageWithToolPlaceholder(message);
    expanded.forEach((entry) => {
      if (!entry.id) {
        entry.id = randomMessageId();
      }
      if (!seen.has(entry.id)) {
        result.push(entry);
        seen.add(entry.id);
      }
    });
  });

  return result;
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
  }
  return true;
};

// Tool Message Component - Enhanced with new design
const ToolMessage = ({
  content,
  metadata,
}: {
  content: unknown;
  metadata?: Record<string, unknown> | null;
}) => {
  const metadataInfo = deriveToolInfoFromMetadata(metadata);

  const processToolContent = (rawContent: unknown) => {
    let processedContent = '' as string;
    let action: ToolAction = metadataInfo.action ?? 'Executed';
    let filePath = metadataInfo.filePath ?? '';
    let cleanContent: string | undefined = metadataInfo.cleanContent;
    let inferredToolName = metadataInfo.toolName;

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
    
    // Normalize content to string
    if (typeof rawContent === 'string') {
      processedContent = rawContent;
    } else if (rawContent && typeof rawContent === 'object') {
      const obj = rawContent as Record<string, unknown>;
      processedContent =
        cleanContent ??
        pickFirstString(obj.summary) ??
        pickFirstString(obj.description) ??
        JSON.stringify(rawContent);
    } else {
      processedContent = String(rawContent ?? '');
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
  
  return <ToolResultItem action={finalAction} filePath={finalLabel} content={cleanedContent} />;
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
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedInitialDataRef = useRef(false);
  const sseFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoggedSseFallbackRef = useRef(false);
  const [enableSseFallback, setEnableSseFallback] = useState(false);
  const [isSseConnected, setIsSseConnected] = useState(false);

  const handleRealtimeMessage = useCallback((message: unknown) => {
    const chatMessage = toChatMessage(message);
    const expandedMessages = expandMessageWithToolPlaceholder(chatMessage);

    const assistantUpdates = expandedMessages.filter((msg) => msg.role === 'assistant');
    if (assistantUpdates.length > 0) {
      const shouldStopWaiting = assistantUpdates.some((msg) => {
        const normalizedContent =
          typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content.join('')
              : '';
        if (normalizedContent.trim().length > 0) {
          return true;
        }
        return Boolean(msg.isFinal);
      });
      if (shouldStopWaiting) {
        setIsWaitingForResponse(false);
      }
    }

    setMessages((prev) => {
      if (expandedMessages.length === 0) {
        return prev;
      }

      const indexById = new Map(prev.map((msg, index) => [msg.id, index]));
      let changed = false;
      let next = [...prev];

      expandedMessages.forEach((incoming) => {
        const messageWithId: ChatMessage = incoming.id ? incoming : { ...incoming, id: randomMessageId() };

        // Check if this real message should replace an optimistic one
        if (messageWithId.requestId) {
          const optimisticIndex = next.findIndex(
            (m) => m.isOptimistic && m.requestId === messageWithId.requestId
          );

          if (optimisticIndex !== -1) {
            // Remove optimistic message and replace with real one
            next.splice(optimisticIndex, 1);
            indexById.clear();
            next.forEach((msg, idx) => indexById.set(msg.id, idx));
            changed = true;
          }
        }

        const existingIndex = indexById.get(messageWithId.id);

        if (existingIndex != null) {
          const existing = next[existingIndex];
          const mergedMetadata =
            messageWithId.metadata !== undefined
              ? messageWithId.metadata ?? null
              : existing.metadata ?? null;
          const incomingContent =
            typeof messageWithId.content === 'string' ? messageWithId.content : undefined;
          const shouldReplaceContent =
            incomingContent !== undefined &&
            (incomingContent.trim().length > 0 ||
              existing.content == null ||
              (typeof existing.content === 'string' && existing.content.trim().length === 0));

          const mergedContent =
            shouldReplaceContent && incomingContent !== undefined
              ? incomingContent
              : existing.content;

          const merged: ChatMessage = {
            ...existing,
            ...messageWithId,
            content: mergedContent,
            metadata: mergedMetadata,
            isOptimistic: false, // Real message from server, not optimistic
          };

          const metadataChanged = (() => {
            if (existing.metadata === merged.metadata) return false;
            try {
              return JSON.stringify(existing.metadata ?? null) !== JSON.stringify(merged.metadata ?? null);
            } catch {
              return true;
            }
          })();

          if (
            merged.content !== existing.content ||
            merged.updatedAt !== existing.updatedAt ||
            merged.isStreaming !== existing.isStreaming ||
            merged.isFinal !== existing.isFinal ||
            merged.isOptimistic !== existing.isOptimistic ||
            metadataChanged
          ) {
            next[existingIndex] = merged;
            changed = true;
          }
          return;
        }

        // Ensure incoming message is not marked as optimistic (it's real from server)
        const realMessage = { ...messageWithId, isOptimistic: false };
        next.push(realMessage);
        indexById.set(realMessage.id, next.length - 1);
        changed = true;
      });

      return changed ? next : prev;
    });
  }, [setIsWaitingForResponse]);

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
  const { isConnected } = useWebSocket({
    projectId,
    onMessage: handleRealtimeMessage,
    onStatus: handleRealtimeStatus,
    onConnect: () => {
      setEnableSseFallback(false);
      hasLoggedSseFallbackRef.current = false;
      onSseFallbackActive?.(false);
      if (sseFallbackTimerRef.current) {
        clearTimeout(sseFallbackTimerRef.current);
        sseFallbackTimerRef.current = null;
      }
    },
    onDisconnect: () => {
      setEnableSseFallback(true);
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

    if (sseFallbackTimerRef.current) {
      clearTimeout(sseFallbackTimerRef.current);
    }

    sseFallbackTimerRef.current = setTimeout(() => {
      setEnableSseFallback((previous) => previous || true);
    }, 1500);

    return () => {
      if (sseFallbackTimerRef.current) {
        clearTimeout(sseFallbackTimerRef.current);
        sseFallbackTimerRef.current = null;
      }
    };
  }, [isConnected, onSseFallbackActive]);

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
          console.warn('🔄 [Realtime] WebSocket unavailable, using SSE fallback');
          hasLoggedSseFallbackRef.current = true;
        }

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
          setIsSseConnected(true);
          onSseFallbackActive?.(true);
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
  }, [projectId, enableSseFallback, handleRealtimeEnvelope]);

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
  const isToolUsageMessage = (message: ChatMessage) => {
    const metadata = message.metadata as Record<string, unknown> | null | undefined;
    const content = message.content ?? '';

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
  };

  useEffect(scrollToBottom, [messages, logs]);

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
            console.log('Found active session:', session.sessionId);
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
  }, [projectId, onSessionStatusChange]);

  // Poll session status periodically
  const startSessionPolling = (sessionId: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/chat/${projectId}/sessions/${sessionId}/status`);
        if (response.ok) {
          const sessionStatus = await response.json();
          
          if (sessionStatus.status !== 'active') {
            setActiveSession(null);
            onSessionStatusChange?.(false);
            
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            
            // Reload messages to get final results
            loadChatHistory({ showLoading: false });
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Error polling session status:', error);
        }
      }
    }, 3000); // Poll every 3 seconds
  };

  // Load chat history
  const loadChatHistory = useCallback(
    async ({ showLoading }: { showLoading?: boolean } = {}) => {
      const shouldShowLoading = showLoading ?? !hasLoadedInitialDataRef.current;
      let didSucceed = false;
      if (shouldShowLoading) {
        setIsLoading(true);
      }

      try {
        const response = await fetch(`${API_BASE}/api/chat/${projectId}/messages`);
        if (response.ok) {
          didSucceed = true;
          const payload = await response.json();
          const chatMessages = Array.isArray(payload)
            ? payload
            : payload?.data ?? payload?.messages ?? [];
          const normalized = Array.isArray(chatMessages)
            ? expandMessagesList(chatMessages.map(toChatMessage))
            : [];

          // Merge DB messages with optimistic messages instead of replacing
          setMessages((prev) => {
            const keyForMessage = (message: ChatMessage): string | null => {
              if (message.id) {
                return `id:${message.id}`;
              }
              if (message.requestId) {
                return `request:${message.requestId}`;
              }
              return null;
            };

            const prevByKey = new Map<string, ChatMessage>();
            prev.forEach((message) => {
              const key = keyForMessage(message);
              if (key) {
                prevByKey.set(key, message);
              }
            });

            const merged = normalized.map((message) => {
              const key = keyForMessage(message);
              if (!key) {
                return message;
              }

              const previous = prevByKey.get(key);
              if (!previous) {
                return message;
              }

              const incomingContent = typeof message.content === 'string' ? message.content : '';
              const previousContent = typeof previous.content === 'string' ? previous.content : '';

              const shouldKeepPreviousContent =
                previousContent.trim().length > 0 && incomingContent.trim().length === 0;

              if (shouldKeepPreviousContent) {
                return {
                  ...message,
                  content: previous.content,
                  isStreaming: previous.isStreaming,
                  metadata: message.metadata ?? previous.metadata ?? null,
                };
              }

              return message;
            });

            const mergedKeys = new Set<string>();
            merged.forEach((message) => {
              const key = keyForMessage(message);
              if (key) {
                mergedKeys.add(key);
              }
            });

            // Keep transient messages during polling if the DB hasn't persisted them yet.
            // - optimistic messages (local/UI placeholders)
            // - in-progress streaming messages (isStreaming && !isFinal)
            const transientMessages = prev.filter(
              (m) => m.isOptimistic || (m.isStreaming && !m.isFinal)
            );

            transientMessages.forEach((msg) => {
              const key = keyForMessage(msg);
              if (key && mergedKeys.has(key)) {
                return;
              }
              if (key) {
                mergedKeys.add(key);
              }
              merged.push(msg);
            });

            // Sort by creation time
            const sorted = merged.sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            // Only update if there's an actual change
            return areMessagesEqual(prev, sorted) ? prev : sorted;
          });
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
    [projectId],
  );

  useEffect(() => {
    if (!projectId) return;
    if (isConnected && !enableSseFallback) return;

    const isStreamingMessagePending = messages.some(
      (message) => message.role === 'assistant' && message.isStreaming && !message.isFinal
    );

    if (isStreamingMessagePending) {
      return;
    }

    const interval = setInterval(() => {
      loadChatHistory({ showLoading: false }).catch(() => {
        // Suppress polling errors; realtime channels may still recover.
      });
    }, (!isConnected && enableSseFallback && !isSseConnected) ? 2000 : 5000);

    return () => {
      clearInterval(interval);
    };
  }, [projectId, isConnected, enableSseFallback, isSseConnected, loadChatHistory, messages]);

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
  }, [projectId, loadChatHistory, checkActiveSession]);

  useEffect(() => {
    hasLoadedInitialDataRef.current = false;
    setHasLoadedOnce(false);
    setIsLoading(true);
    setMessages([]);
    setLogs([]);
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
}: {
  message: ChatMessage;
  metadata?: Record<string, unknown> | null;
}) => {
  return <ToolMessage content={message.content} metadata={metadata ?? undefined} />;
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
    const regex = /<thinking>([\s\S]*?)<\/thinking>/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      // Add text before the thinking tag (with markdown)
      if (match.index > lastIndex) {
        const beforeText = content.slice(lastIndex, match.index).trim();
        if (beforeText) {
          parts.push(
            <ReactMarkdown 
              key={`text-${lastIndex}`}
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
            key={`thinking-${match.index}`}
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
            key={`text-${lastIndex}`}
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

    if (metadata && (metadata as { hidden_from_ui?: boolean }).hidden_from_ui) {
      return false;
    }

    if (metadata && (metadata as { isTransientToolMessage?: boolean }).isTransientToolMessage) {
      return false;
    }

    if (message.messageType === 'tool_result') {
      const hasContent = typeof message.content === 'string' && message.content.trim().length > 0;
      if (hasContent) {
        return true;
      }
      if (metadata) {
        const meta = metadata as Record<string, unknown>;
        const summary =
          pickFirstString(meta.summary) ??
          pickFirstString(meta.result) ??
          pickFirstString(meta.resultSummary) ??
          pickFirstString(meta.result_summary);
        const diff =
          pickFirstString(meta.diff) ??
          pickFirstString(meta.diff_info) ??
          pickFirstString(meta.toolOutput) ??
          pickFirstString(meta.tool_output);
        return Boolean(summary ?? diff);
      }
      return false;
    }

    if (message.messageType === 'tool_use' || isToolUsageMessage(message)) {
      return true;
    }

    if (!message.content || message.content.trim() === '') {
      return false;
    }

    if (message.role === 'system' && message.messageType === 'system') {
      if (message.content.includes('initialized') || message.content.includes('Agent')) {
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
        setMessages((prev) => {
          const exists = prev.some(m => m.id === message.id);
          if (exists) return prev;
          return [...prev, message];
        });
      };

      const removeMessage = (messageId: string) => {
        setMessages((prev) => prev.filter(m => m.id !== messageId));
      };

      onAddUserMessage({ add: addMessage, remove: removeMessage });
    }
  }, [onAddUserMessage]);

  return (
    <div className="flex flex-col h-full bg-white ">

      {/* Display messages and logs together */}
      <div className="flex-1 overflow-y-auto px-8 py-3 space-y-2 custom-scrollbar ">
        {isLoading && !hasLoadedOnce && (
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
        
        {/* Render chat messages */}
        {messages.filter(shouldDisplayMessage).map((message, index) => {
          const messageMetadata = message.metadata as Record<string, unknown> | null;
          
          return (
            <div
              className="mb-4"
              key={message.id ?? `message-${index}`}
            >
                {message.role === 'user' ? (
                  // User message - boxed on the right
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-gray-100 rounded-lg px-4 py-3">
                      <div className="text-sm text-gray-900 break-words">
                        {(() => {
                          const cleanedMessage = cleanUserMessage(message.content);
                          
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
                                if (attachments.length > 0) {
                                  return (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {attachments.map((attachment: any, idx: number) => {
                                        const rawUrl =
                                          (typeof attachment.publicUrl === 'string' && attachment.publicUrl.trim().length > 0
                                            ? attachment.publicUrl.trim()
                                            : typeof attachment.url === 'string' && attachment.url.trim().length > 0
                                            ? attachment.url.trim()
                                            : null);
                                        if (!rawUrl) {
                                          return null;
                                        }
                                        const resolveUrl = (value: string) => {
                                          if (/^https?:\/\//i.test(value)) {
                                            return value;
                                          }
                                          if (API_BASE) {
                                            if (value.startsWith('/')) {
                                              return `${API_BASE}${value}`;
                                            }
                                            return `${API_BASE}/${value}`;
                                          }
                                          return value.startsWith('/') ? value : `/${value}`;
                                        };
                                      const imageUrl = resolveUrl(rawUrl);
                                      return (
                                        <div key={idx} className="relative group">
                                          <div className="w-40 h-40 bg-gray-200 rounded-lg overflow-hidden border border-gray-300 ">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img 
                                              src={imageUrl}
                                              alt={`Image ${idx + 1}`}
                                              className="w-full h-full object-cover"
                                              onError={(e) => {
                                                // Fallback to icon if image fails to load
                                                const target = e.target as HTMLImageElement;
                                                console.error('❌ Image failed to load:', target.src, 'Error:', e);
                                                target.style.display = 'none';
                                                const parent = target.parentElement;
                                                if (parent) {
                                                  parent.innerHTML = `
                                                    <div class="w-full h-full flex items-center justify-center">
                                                      <svg class="w-16 h-16 text-gray-400 " fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                      </svg>
                                                    </div>
                                                  `;
                                                }
                                              }}
                                            />
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
                      <ToolResultMessage message={message} metadata={messageMetadata} />
                    ) : isToolUsageMessage(message) ? (
                      // Tool usage - clean display with expand functionality
                      <ToolMessage content={message.content} metadata={messageMetadata} />
                    ) : (
                      // Regular agent message - plain text
                      <div className="text-sm text-gray-900 leading-relaxed">
                        {renderContentWithThinking(shortenPath(message.content))}
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
