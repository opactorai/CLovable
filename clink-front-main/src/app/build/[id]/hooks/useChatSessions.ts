'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { flushSync } from 'react-dom';
import { apiClient } from '@/lib/api-client';
import {
  chatService,
  ChatSession,
  ChatSessionStatusPayload,
  ChatStreamEvent,
  Message,
} from '@/lib/chat';
import { clientLogger } from '@/lib/client-logger';
import {
  ASSISTANT_OPTIONS,
  AssistantKey,
  normalizeCli,
  resolveApiModel,
} from '@/lib/assistant-options';
import { useChatMessageBuffers } from './useChatMessageBuffers';
import { processEvent } from '@/lib/chat/events/eventProcessor';
import { ChatEvent } from '@/lib/chat/events/types';
import * as Sentry from '@sentry/nextjs';

interface ImageMetadata {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

interface UploadedImage {
  file: File;
  metadata?: ImageMetadata;
  uploading?: boolean;
  error?: string;
}

interface UseChatSessionsOptions {
  projectId: string | undefined | null;
  initialPrompt: string | null;
  previewReady: boolean;
  waitForPreviewReady: () => Promise<void>;
  triggerPreview: () => void;
  loadFileTree: () => Promise<any>;
  notifyActivity: (
    source?: string,
    options?: { autoStart?: boolean },
  ) => void;
  onTurnEnd?: () => void | Promise<void>;
  integrationsHint?: {
    supabaseConnected: boolean;
    githubConnected: boolean;
  };
  openIntegrationModal?: (integration: 'supabase' | 'github' | 'other-apps') => void;
  projectType?: 'base' | 'dev';
}

interface UseChatSessionsReturn {
  messages: Message[];
  allMessages: Message[];
  sessions: ChatSession[];
  isLoading: boolean;
  isInitialPromptRunning: boolean;
  canEdit: boolean;
  canCancelActiveSession: boolean;
  roomsReady: boolean;
  input: string;
  uploadedImages: UploadedImage[];
  selectedCli: AssistantKey;
  selectedModel: string;
  selectedEffort: 'low' | 'medium' | 'high';
  activeChatRoomId: number | null;
  setInput: (value: string) => void;
  setSelectedModel: (model: string) => void;
  setSelectedEffort: (effort: 'low' | 'medium' | 'high') => void;
  setUploadedImages: Dispatch<SetStateAction<UploadedImage[]>>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setSelectedCli: (cli: AssistantKey) => void;
  setActiveChatRoomId: (chatRoomId: number | null) => void;
  handleAssistantTabSelect: (cli: AssistantKey) => void;
  handleSendMessage: (
    overrideContent?: string,
    options?: {
      imageMetadata?: any[];
      newSession?: boolean;
      source?: 'home_initial' | 'new_session' | 'message';
    },
  ) => Promise<void>;
  handleImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  removeImage: (index: number) => void;
  processMessage: (content: string, images?: File[], newSession?: boolean, imageMetadata?: any[]) => Promise<void>;
  sendInitialMessage: (prompt: string, images?: any[]) => Promise<void>;
  handleSessionSwitch: (chatRoomId: number | null) => Promise<void>;
  handleNewSession: () => void;
  handleRenameSession: (chatRoomId: number, name: string) => Promise<void>;
  handleCloseSession: (chatRoomId: number) => Promise<void>;
  refreshSessions: (preferredActiveRoomId?: number | null) => Promise<ChatSession[]>;
  applyChatEvent: (
    event: {
      sessionId: string;
      sequence: number;
      event: string;
      payload: any;
      createdAt: string;
    },
    options?: { replay?: boolean },
  ) => void;
  hydrateSessions: () => Promise<void>;
  loadChatHistory: () => Promise<void>;
  handleSessionStatus: (status: ChatSessionStatusPayload) => void;
  handleReconnect: () => Promise<void>;
  resetChatState: (options?: { resetInitialPrompt?: boolean }) => void;
  cancelActiveSession: () => Promise<void>;
  historyLoadedRef: MutableRefObject<boolean>;
  initialPromptRef: MutableRefObject<string | null>;
  resumeEditing: () => void | Promise<void>;
}

export const useChatSessions = ({
  projectId,
  initialPrompt,
  previewReady,
  waitForPreviewReady,
  triggerPreview,
  loadFileTree,
  notifyActivity,
  onTurnEnd,
  integrationsHint,
  openIntegrationModal,
  projectType = 'base',
}: UseChatSessionsOptions): UseChatSessionsReturn => {
  const safeProjectId = useMemo(() => projectId ?? '', [projectId]);

  const [messages, setMessagesInternal] = useState<Message[]>([]);
  
  // Wrapper to track message updates
  const setMessages = useCallback((updater: Message[] | ((prev: Message[]) => Message[])) => {
    setMessagesInternal((prev) => {
      const newMessages = typeof updater === 'function' ? updater(prev) : updater;
      return newMessages;
    });
  }, []);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isLoadingRef = useRef(isLoading);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [selectedCli, setSelectedCli] = useState<AssistantKey>('codex');
  const [selectedModel, setSelectedModel] = useState<string>('gpt-5');
  const [selectedEffort, setSelectedEffort] = useState<'low' | 'medium' | 'high'>('medium');
  const storageKey =
    typeof window !== 'undefined' && safeProjectId
      ? `chat:${safeProjectId}:activeRoom`
      : null;
  const [activeChatRoomId, setActiveChatRoomId] = useState<number | null>(() => {
    if (storageKey) {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = parseInt(stored, 10);
        return isNaN(parsed) ? null : parsed;
      }
    }
    return null;
  });
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [serverActiveRoomId, setServerActiveRoomId] = useState<number | null>(null);
  const [roomsReady, setRoomsReady] = useState(false);

  const initialPromptRef = useRef<string | null>(initialPrompt);
  const historyLoadedRef = useRef(false);
  const hasProcessedInitialPromptRef = useRef(false);
  // Guard: prevent cancellation during the very first initial prompt
  const initialCancelLockedRef = useRef(false);
  const initialSessionIdRef = useRef<string | null>(null);
  const loadingResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRoomMapRef = useRef<Map<string, number>>(new Map());

  const sortSessions = useCallback((list: ChatSession[]): ChatSession[] => {
    return [...list].sort((a, b) => {
      // Sort by chatRoomId (highest first = most recent)
      return b.chatRoomId - a.chatRoomId;
    });
  }, []);

  const mergeSessionsByRoom = useCallback(
    (
      existing: ChatSession[],
      updates: ChatSession[],
      activeRoomId: number | null,
    ): ChatSession[] => {
      const map = new Map<number, ChatSession>();

      const upsert = (session: ChatSession) => {
        if (typeof session.chatRoomId !== 'number' || Number.isNaN(session.chatRoomId)) {
          return;
        }

        const previous = map.get(session.chatRoomId);
        const merged: ChatSession = {
          ...(previous ?? session),
          ...session,
          name: session.name ?? previous?.name ?? null,
          messageCount: session.messageCount ?? previous?.messageCount ?? 0,
          lastMessage: session.lastMessage ?? previous?.lastMessage ?? null,
                    metadata: session.metadata ?? previous?.metadata ?? null,
          provider: session.provider ?? previous?.provider ?? null,
          model: session.model ?? previous?.model ?? null,
          status: session.status ?? previous?.status ?? 'running',
          sessionId: session.sessionId ?? previous?.sessionId ?? null,
          lastSequence: session.lastSequence ?? previous?.lastSequence ?? 0,
          events: session.events ?? previous?.events ?? [],
          createdAt:
            session.createdAt ??
            previous?.createdAt ??
            new Date().toISOString(),
          updatedAt:
            session.updatedAt ??
            previous?.updatedAt ??
            session.createdAt ??
            previous?.createdAt ??
            new Date().toISOString(),
        };

        map.set(session.chatRoomId, merged);
      };

      existing.forEach(upsert);
      updates.forEach(upsert);

      const mergedArray = sortSessions(Array.from(map.values()));
      return mergedArray.map((session) => ({
        ...session,
        isActive: session.chatRoomId === activeRoomId,
      }));
    },
    [sortSessions],
  );

  const setLoadingState = useCallback<Dispatch<SetStateAction<boolean>>>(
    (value) => {
      const nextValue =
        typeof value === 'function' ? value(isLoadingRef.current) : value;

      if (nextValue) {
        if (loadingResetTimeoutRef.current) {
          clearTimeout(loadingResetTimeoutRef.current);
          loadingResetTimeoutRef.current = null;
        }
        setIsLoading(true);
        return;
      }

      if (loadingResetTimeoutRef.current) {
        clearTimeout(loadingResetTimeoutRef.current);
      }

      loadingResetTimeoutRef.current = setTimeout(() => {
        setIsLoading(false);
        loadingResetTimeoutRef.current = null;
      }, 300);
    },
    [],
  );

  // Use message buffer management hook
  const resolveChatRoomId = useCallback(
    (sessionId: string) => {
      if (sessionId && sessionRoomMapRef.current.has(sessionId)) {
        return sessionRoomMapRef.current.get(sessionId);
      }

      const match = sessions.find((session) => session.sessionId === sessionId);
      if (match?.chatRoomId) {
        if (sessionId) {
          sessionRoomMapRef.current.set(sessionId, match.chatRoomId);
        }
        return match.chatRoomId;
      }

      return activeChatRoomId ?? undefined;
    },
    [activeChatRoomId, sessions],
  );

  const bufferHandlers = useChatMessageBuffers(setMessages, resolveChatRoomId);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    if (storageKey) {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = parseInt(stored, 10);
        setActiveChatRoomId(isNaN(parsed) ? null : parsed);
      } else {
        setActiveChatRoomId(null);
      }
    } else {
      setActiveChatRoomId(null);
    }
  }, [storageKey]);

  useEffect(() => {
    if (initialPrompt) {
      initialPromptRef.current = initialPrompt;
    }
  }, [initialPrompt]);

  const handleAssistantTabSelect = useCallback((cli: AssistantKey) => {
    setSelectedCli(cli);
    setSelectedModel((prev) => {
      const models = ASSISTANT_OPTIONS[cli].models;
      return models.some((model) => model.value === prev) ? prev : models[0].value;
    });
  }, []);

  const applyChatEvent = useCallback(
    (event: ChatEvent, options?: { replay?: boolean }) => {
      // When the first live (non-replay) SSE arrives, and it's non-final,
      // treat streaming as actually started and unlock the initial cancel guard.
      if (!options?.replay && initialCancelLockedRef.current) {
        const name = (event.event || '').toLowerCase();
        const p: any = event.payload || {};
        const statusCandidates = [
          p?.metadata?.status,
          p?.status,
          p?.raw?.status,
          p?.raw?.result,
          p?.result,
        ];
        const normalizedStatus = statusCandidates
          .map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : undefined))
          .find((v) => v && v.length > 0);

        const subtype = (p?.raw?.subtype || p?.subtype || '').toLowerCase();

        const isFinalName =
          name.endsWith('turn_end') ||
          name.endsWith('.completed') ||
          name.endsWith('.done') ||
          name.includes('result');

        const isErrorName = name.includes('error');

        const isFinalStatus =
          normalizedStatus === 'completed' ||
          normalizedStatus === 'success' ||
          normalizedStatus === 'cancelled';

        const isFinalSubtype = subtype === 'success' || subtype.startsWith('error');

        const isFinalEvent = isErrorName || isFinalStatus || isFinalSubtype || isFinalName;

        if (!isFinalEvent) {
          initialCancelLockedRef.current = false;
        }
      }

      if (
        event.sessionId &&
        typeof event.chatRoomId === 'number' &&
        !Number.isNaN(event.chatRoomId)
      ) {
        sessionRoomMapRef.current.set(event.sessionId, event.chatRoomId);
      }

      const deps = {
        setMessages,
        setIsLoading: setLoadingState,
        triggerPreview,
        loadFileTree,
        onTurnEnd,
        safeProjectId,
        openIntegrationModal,
        integrationsHint,
      };

      processEvent(event, bufferHandlers, deps, options);
    },
    [bufferHandlers, safeProjectId, triggerPreview, loadFileTree, onTurnEnd, setLoadingState, openIntegrationModal, integrationsHint],
  );

  const hydrateSessions = useCallback(async () => {
    if (!safeProjectId) {
      clientLogger.warn('hydrateSessions skipped: projectId not set');
      return;
    }

    await chatService.initializeProject(safeProjectId);

    try {
      const fetchedSessions: ChatSession[] =
        await chatService.listSessions(true);
      fetchedSessions.forEach((session) => {
        // Skip sessions without sessionId OR without events to restore
        // This handles both: 1) newly created sessions (sessionId=null), 2) empty sessions
        if (!session.sessionId || !session.events || session.events.length === 0) return;
        if (typeof session.chatRoomId === 'number' && !Number.isNaN(session.chatRoomId)) {
          sessionRoomMapRef.current.set(session.sessionId, session.chatRoomId);
        }
        const state = bufferHandlers.getSessionState(session.sessionId, true);

        if (session.events && session.events.length > 0) {
          session.events
            .sort((a, b) => a.sequence - b.sequence)
            .forEach((event: ChatStreamEvent) => {
              applyChatEvent(
                {
                  sessionId: event.sessionId,
                  sequence: event.sequence,
                  event: event.event,
                  payload: event.payload,
                  createdAt: event.createdAt,
                  chatRoomId: session.chatRoomId,
                },
                { replay: true },
              );
            });
        }
        state.lastSequence = session.lastSequence ?? state.lastSequence;
      });

      const orderedSessions = sortSessions(fetchedSessions);

      // Also capture server active room for read-only gating on first load
      let rooms: any[] = [];
      try {
        rooms = await chatService.listChatRooms();
        const activeRoom = rooms.find((r) => r.isActive);
        setServerActiveRoomId(activeRoom ? activeRoom.id : null);
        setRoomsReady(true);
      } catch (e) {
        clientLogger.warn('[Chat] hydrateSessions: failed to fetch chat rooms:', e);
        setServerActiveRoomId(null);
        setRoomsReady(false);
      }

      let targetChatRoomId: number | null =
        (storageKey && typeof window !== 'undefined'
          ? (() => {
              const stored = sessionStorage.getItem(storageKey);
              if (stored) {
                const parsed = parseInt(stored, 10);
                // Validate that the stored room ID actually exists
                if (!isNaN(parsed) && rooms.some((r) => r.id === parsed)) {
                  return parsed;
                }
                // Room doesn't exist anymore (e.g., after recovery), clear stale storage
                sessionStorage.removeItem(storageKey);
              }
              return null;
            })()
          : null);

      if (!targetChatRoomId && orderedSessions.length > 0) {
        const running = orderedSessions.find((session) => session.status === 'running');
        targetChatRoomId = running?.chatRoomId ?? orderedSessions[0].chatRoomId;
      }

      setSessions((prev) =>
        mergeSessionsByRoom(prev, orderedSessions, targetChatRoomId ?? activeChatRoomId ?? null),
      );

      if (targetChatRoomId) {
        // Use flushSync to force immediate state update before loading history
        flushSync(() => {
          setActiveChatRoomId(targetChatRoomId);
        });
        if (storageKey) {
          sessionStorage.setItem(storageKey, String(targetChatRoomId));
        }
        // Reset history loaded flag and load chat history (especially important for auto-recovered rooms)
        historyLoadedRef.current = false;
        await loadChatHistory();
      } else if (storageKey) {
        sessionStorage.removeItem(storageKey);
      }
    } catch (error) {
      console.error('Failed to hydrate chat sessions:', error);
    }
  }, [
    applyChatEvent,
    bufferHandlers,
    mergeSessionsByRoom,
    sortSessions,
    storageKey,
    safeProjectId,
    activeChatRoomId,
    // Note: loadChatHistory intentionally not in deps to avoid circular dependency
  ]);

  const loadChatHistory = useCallback(async () => {
    if (!safeProjectId) {
      setMessages([]);
      historyLoadedRef.current = true;
      return;
    }
    try {
      const history = await apiClient.request<any[]>(
        `/api/chat/${safeProjectId}/history`,
      );

      // Helper to strip workspace path prefixes from tool messages
      const stripWorkspacePath = (path: string): string => {
        if (!path) return path;
        // Common workspace paths used by Daytona
        const workspacePrefixes = [
          '/home/daytona/template/',
          '/home/daytona/',
          '/workspace/',
        ];
        for (const prefix of workspacePrefixes) {
          if (path.startsWith(prefix)) {
            return path.slice(prefix.length);
          }
        }
        return path;
      };

      // Helper to convert old bash commands to Read format
      const convertBashToRead = (content: string, title: string): { content: string; title: string } => {
        // Check for apply_patch first - these should be filtered out (handled separately)
        if (title && title.includes('apply_patch')) {
          return { content: '', title: '' }; // Will be filtered out
        }
        if (content && content.includes('apply_patch')) {
          return { content: '', title: '' }; // Will be filtered out
        }

        // Try title first
        if (title) {
          const catMatch = title.match(/\[Bash\]\s+bash\s+-lc\s+cat\s+(.+)$/);
          if (catMatch && catMatch[1]) {
            return { content: `[Read] ${catMatch[1].trim()}`, title: `[Read] ${catMatch[1].trim()}` };
          }
          const sedMatch = title.match(/\[Bash\]\s+bash\s+-lc\s+sed\s+-n\s+['"][^'"]+['"]\s+(.+)$/);
          if (sedMatch && sedMatch[1]) {
            return { content: `[Read] ${sedMatch[1].trim()}`, title: `[Read] ${sedMatch[1].trim()}` };
          }
        }

        // Try content
        if (content) {
          const catMatch = content.match(/\[Bash\]\s+bash\s+-lc\s+cat\s+(.+)$/);
          if (catMatch && catMatch[1]) {
            return { content: `[Read] ${catMatch[1].trim()}`, title: `[Read] ${catMatch[1].trim()}` };
          }
          const sedMatch = content.match(/\[Bash\]\s+bash\s+-lc\s+sed\s+-n\s+['"][^'"]+['"]\s+(.+)$/);
          if (sedMatch && sedMatch[1]) {
            return { content: `[Read] ${sedMatch[1].trim()}`, title: `[Read] ${sedMatch[1].trim()}` };
          }
        }

        return { content, title };
      };

      const mapped: Message[] = (history || []).map((item: any) => {
        let content = item.content;
        let title = item.title;

        // Convert bash read commands for tool messages
        if (item.variant === 'tool') {
          // Debug logging for Edit/Delete messages
          if (content === 'Edit' || content === 'Delete' || title === 'Edit' || title === 'Delete') {
            clientLogger.debug('[DEBUG] Tool message:', {
              id: item.id,
              content: item.content,
              title: item.title,
              metadata: item.metadata,
            });
          }

          const converted = convertBashToRead(content, title);
          content = converted.content;
          title = converted.title;

          // Fix Edit/Delete messages with missing file path
          if ((title === 'Edit' || title === 'Delete') && item.metadata?.filePath) {
            const filePath = stripWorkspacePath(item.metadata.filePath);
            title = `[${title}] ${filePath}`;
            content = title;
          }
          
          // Strip workspace paths from all tool message content/titles
          if (content) {
            content = stripWorkspacePath(content);
          }
          if (title) {
            title = stripWorkspacePath(title);
          }
        }

        const rawChatRoomId = (() => {
          if (typeof item.chatRoomId === 'number') {
            return item.chatRoomId;
          }
          if (typeof item.chatRoomId === 'string') {
            const parsed = parseInt(item.chatRoomId.trim(), 10);
            if (!isNaN(parsed)) return parsed;
          }
          // Don't default to 1 - keep NULL to avoid filtering issues after recovery
          return item.chatRoomId;
        })();

        return {
          id: item.id,
          role: item.role,
          content,
          images: item.images ?? [],
          timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
          variant: item.variant ?? (item.role === 'user' ? undefined : 'message'),
          title,
          toolName: item.toolName,
          status: item.status,
          todos: item.todos,
          toolDetails: item.toolDetails,
          duration: item.duration,
          metadata: item.metadata ?? undefined,
          sessionId: item.sessionId ?? undefined,
          chatRoomId: rawChatRoomId,
        };
      });

      // If history already exists, clear the initial prompt to prevent duplicate
      if (mapped.length > 0) {
        initialPromptRef.current = null;
        hasProcessedInitialPromptRef.current = true;
      }

      // Merge with existing messages, avoiding duplicates
      setMessages((prev) => {
        // Create a map of existing message IDs
        const existingIds = new Set(prev.map(msg => msg.id));

        // Add history messages that don't already exist
        const newMessages = mapped.filter(msg => !existingIds.has(msg.id));

        // Combine and sort by timestamp
        const combined = [...prev, ...newMessages].sort((a, b) =>
          a.timestamp.getTime() - b.timestamp.getTime()
        );

        return combined;
      });
      historyLoadedRef.current = true;

      // Ensure sessions exist for all chat rooms referenced in history
      const roomsFromHistory = new Map<number, { sessionId?: string | null; updatedAt: string }>();
      mapped.forEach((msg) => {
        // Skip messages without chatRoomId (TypeScript safety check)
        if (msg.chatRoomId === undefined) return;

        const existing = roomsFromHistory.get(msg.chatRoomId);
        if (!existing || existing.updatedAt < msg.timestamp.toISOString()) {
          roomsFromHistory.set(msg.chatRoomId, {
            sessionId: msg.sessionId ?? null,
            updatedAt: msg.timestamp.toISOString(),
          });
        }
      });

      if (roomsFromHistory.size > 0) {
        const historySessions = Array.from(roomsFromHistory.entries()).map(([roomId, value]) => ({
          id: `history-room-${roomId}`,
          projectId: safeProjectId,
          chatRoomId: roomId,
          sessionId: value.sessionId ?? null,
          status: 'completed',
          isActive: false,
          provider: null,
          model: null,
          metadata: null,
          messageCount: mapped.filter((msg) => msg.chatRoomId === roomId).length,
          lastMessage: null,
          lastSequence: 0,
          name: null,
          createdAt: value.updatedAt,
          updatedAt: value.updatedAt,
          events: [],
        } as ChatSession));

        setSessions((prev) =>
          mergeSessionsByRoom(prev, historySessions, activeChatRoomId),
        );

        if (!activeChatRoomId) {
          const latestRoom = Array.from(roomsFromHistory.entries()).sort(
            (a, b) => Date.parse(b[1].updatedAt) - Date.parse(a[1].updatedAt),
          )[0]?.[0];
          if (latestRoom !== undefined) {
            setActiveChatRoomId(latestRoom);
            if (storageKey) {
              sessionStorage.setItem(storageKey, String(latestRoom));
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      setMessages([]);
      historyLoadedRef.current = true;
    }
  }, [activeChatRoomId, mergeSessionsByRoom, safeProjectId, storageKey]);

  const refreshSessions = useCallback(async (preferredActiveRoomId: number | null = null): Promise<ChatSession[]> => {
    if (!safeProjectId) {
      setSessions([]);
      return [];
    }

    try {
      const list = await chatService.listSessions(false);
      const normalized = list.map((session) => ({
        ...session,
        name: session.name ?? null,
      }));

      let mergedResult: ChatSession[] = [];
      setSessions((prev) => {
        const nextActive = preferredActiveRoomId ?? activeChatRoomId ?? prev.find((session) => session.isActive)?.chatRoomId ?? null;
        const merged = mergeSessionsByRoom(prev, normalized, nextActive);
        merged.forEach((session) => {
          if (
            session.sessionId &&
            typeof session.chatRoomId === 'number' &&
            !Number.isNaN(session.chatRoomId)
          ) {
            sessionRoomMapRef.current.set(session.sessionId, session.chatRoomId);
          }
        });
        mergedResult = merged;
        return merged;
      });

      // Also fetch chat rooms to reflect server-side active room for read-only gating
      try {
        const rooms = await chatService.listChatRooms();
        const activeRoom = rooms.find((r) => r.isActive);
        setServerActiveRoomId(activeRoom ? activeRoom.id : null);
        setRoomsReady(true);
      } catch (e) {
        clientLogger.warn('[Chat] Failed to fetch chat rooms for server-active state:', e);
        setServerActiveRoomId(null);
        setRoomsReady(false);
      }

      return mergedResult;
    } catch (error) {
      clientLogger.error('[Chat] Failed to refresh sessions list:', error);
      return [];
    }
  }, [activeChatRoomId, chatService, mergeSessionsByRoom, safeProjectId]);

  const handleSessionStatus = useCallback(
    (status: ChatSessionStatusPayload) => {
      if (
        status.sessionId &&
        typeof status.chatRoomId === 'number' &&
        !Number.isNaN(status.chatRoomId)
      ) {
        sessionRoomMapRef.current.set(status.sessionId, status.chatRoomId);
      }

      const state = bufferHandlers.getSessionState(status.sessionId);
      if (status.sequence !== undefined && status.sequence <= state.lastSequence) {
        return;
      }
      if (status.sequence !== undefined) {
        state.lastSequence = status.sequence;
      }

      if (
        status.status === 'completed' ||
        status.status === 'error' ||
        status.status === 'cancelled'
      ) {
        // Release the initial-prompt cancellation lock when the first turn ends
        if (initialCancelLockedRef.current) {
          if (!initialSessionIdRef.current || initialSessionIdRef.current === status.sessionId) {
            initialCancelLockedRef.current = false;
            initialSessionIdRef.current = null;
          }
        }
        const relatedSession = sessions.find(
          (session) => session.sessionId === status.sessionId,
        );
        const roomId = status.chatRoomId ?? relatedSession?.chatRoomId ?? 1;
        if (storageKey && typeof roomId === 'number') {
          sessionStorage.setItem(storageKey, String(roomId));
        }
        setActiveChatRoomId((current) => (current ? current : roomId));
        setLoadingState(false);
      }

      setSessions((prev) => {
        const exists = prev.some(
          (session) =>
            session.sessionId === status.sessionId ||
            session.chatRoomId === status.chatRoomId,
        );
        if (!exists) {
          return prev;
        }

        const updated = prev.map((session) =>
          session.sessionId === status.sessionId ||
          session.chatRoomId === status.chatRoomId
            ? {
                ...session,
                status: status.status,
                lastSequence:
                  status.sequence ?? session.lastSequence ?? 0,
                updatedAt: status.timestamp ?? session.updatedAt,
              }
            : session,
        );

        return sortSessions(updated);
      });
    },
    [bufferHandlers, sessions, sortSessions, storageKey],
  );

  const resetChatState = useCallback(
    (options?: { resetInitialPrompt?: boolean }) => {
      setMessages([]);
      setInput('');
      setUploadedImages([]);
      setLoadingState(false);
      setActiveChatRoomId(null);
      setSessions([]);
      sessionRoomMapRef.current.clear();

      if (options?.resetInitialPrompt !== false) {
        hasProcessedInitialPromptRef.current = false;
      }

      if (storageKey) {
        sessionStorage.removeItem(storageKey);
      }
    },
    [storageKey],
  );

  const processMessage = useCallback(
    async (
      content: string,
      images?: File[],
      newSession?: boolean,
      imageMetadata?: any[],
      source?: 'home_initial' | 'new_session' | 'message',
    ) => {
      if (!content.trim() && (!images || images.length === 0) && (!imageMetadata || imageMetadata.length === 0)) {
        return;
      }

      setLoadingState(true);
      notifyActivity('chat', { autoStart: true });

      let chatRoomIdForRequest = activeChatRoomId;
      let createdSession: ChatSession | null = null;

      if (chatRoomIdForRequest == null) {
        try {
          const created = await chatService.createChatRoom({
            provider: normalizeCli(selectedCli),
            model: selectedModel,
          });

          chatRoomIdForRequest = created.id;
          createdSession = {
            id: `chat-room-${created.id}`,
            projectId: safeProjectId,
            chatRoomId: created.id,
            sessionId: created.lastSessionId ?? null,
            isActive: true,
            status: created.isActive ? 'running' : 'completed',
            provider: null,
            model: null,
            metadata: null,
            messageCount: created.messageCount ?? 0,
            lastMessage: created.lastMessage ?? null,
            lastSequence: 0,
            name: created.name ?? null,
            createdAt: created.createdAt,
            updatedAt: created.updatedAt,
            events: [],
          } as ChatSession;

          setActiveChatRoomId(chatRoomIdForRequest);
          if (storageKey) {
            sessionStorage.setItem(storageKey, String(chatRoomIdForRequest));
          }
          setSessions((prev) =>
            mergeSessionsByRoom(prev, [createdSession!], chatRoomIdForRequest),
          );
          // Ensure server-active matches the newly created room immediately to avoid read-only banner on first prompt
          setServerActiveRoomId(chatRoomIdForRequest);
          try {
            await chatService.toggleSession(chatRoomIdForRequest, true);
          } catch (e) {
            clientLogger.warn('[Chat] toggleSession after on-demand room create failed:', e);
          }
        } catch (error) {
          clientLogger.error('[Chat] Failed to create chat room before sending message:', error);
          setLoadingState(false);
          return;
        }
      }

      if (chatRoomIdForRequest == null) {
        setLoadingState(false);
        return;
      }

      const ensuredChatRoomId = chatRoomIdForRequest;

      const currentSession =
        sessions.find((session) => session.chatRoomId === ensuredChatRoomId) ??
        createdSession ??
        null;

      const previousRoomId = ensuredChatRoomId;

      const storedSessionId =
        storageKey && typeof window !== 'undefined'
          ? sessionStorage.getItem(storageKey)
          : null;

      // IMPORTANT: Always start a new session for each chat room to avoid SSE mismatch
      // Daytona may reject old sessionIds and return new ones, causing SSE connection issues
      const hasExistingSession = Boolean(currentSession?.sessionId);
      const effectiveNewSession =
        newSession !== undefined ? Boolean(newSession) : !hasExistingSession;

      // Force new session for chat rooms without messages to prevent resume failures
      let sessionIdForRequest: string | undefined;
      if (!effectiveNewSession && currentSession?.messageCount && currentSession.messageCount > 0) {
        // Only resume if session has messages (actual conversation history)
        sessionIdForRequest = currentSession.sessionId ?? undefined;
      } else {
        // Start new session for empty chat rooms or when explicitly requested
        sessionIdForRequest = undefined;
      }

      const newMessageId = `user-${Date.now()}`;

      const userMessage: Message = {
        id: newMessageId,
        role: 'user',
        content,
        localFiles: images || [],
        images: imageMetadata || [],
        timestamp: new Date(),
        sessionId: sessionIdForRequest ?? currentSession?.sessionId ?? undefined,
        chatRoomId: ensuredChatRoomId as number,
      };

      setMessages((prev) => [...prev, userMessage]);
      clientLogger.debug('[Chat] processMessage started', {
        contentLength: content.length,
        imagesCount: images?.length || 0,
        imageMetadataCount: imageMetadata?.length || 0,
        activeChatRoomId,
        requestedNewSession: Boolean(newSession),
        effectiveNewSession,
        storedSessionId,
        projectId: safeProjectId,
      });

      try {
        // Wait for preview ready - throw error if not ready
        clientLogger.debug('[processMessage] Step 1: Waiting for preview to be ready...');
        await waitForPreviewReady();
        clientLogger.debug('[processMessage] Step 2: Preview is ready ✅');

        const resolvedModel = resolveApiModel(selectedCli, selectedModel);
        clientLogger.debug('[processMessage] Step 3: About to call chatService.sendMessage with:', {
          contentLength: content.length,
          imagesCount: (images || []).length,
          imageMetadataCount: imageMetadata?.length || 0,
        options: {
          cli: normalizeCli(selectedCli),
          model: resolvedModel,
          effort: selectedEffort,
          newSession: effectiveNewSession,
          source: source ?? (effectiveNewSession ? 'new_session' : 'message'),
          sessionId: sessionIdForRequest,
          chatRoomId: chatRoomIdForRequest,
          imageMetadata: imageMetadata || undefined,
          integrationsHint,
        }
      });

      const result = await chatService.sendMessage(content, images || [], {
        cli: normalizeCli(selectedCli),
        model: resolvedModel,
        effort: selectedEffort,
        newSession: effectiveNewSession,
        source: source ?? (effectiveNewSession ? 'new_session' : 'message'),
        sessionId: sessionIdForRequest,
        chatRoomId: chatRoomIdForRequest,
        imageMetadata: imageMetadata || undefined,
        integrationsHint,
      });

      clientLogger.debug('[processMessage] Step 4: chatService.sendMessage returned:', result);

        const resolvedRoomId = result.chatRoomId ?? chatRoomIdForRequest;

        if (resolvedRoomId !== chatRoomIdForRequest) {
          chatRoomIdForRequest = resolvedRoomId;
          setActiveChatRoomId(resolvedRoomId);
          if (storageKey) {
            sessionStorage.setItem(storageKey, String(resolvedRoomId));
          }
          setSessions((prev) =>
            prev.map((session) =>
              session.chatRoomId === previousRoomId
                ? {
                    ...session,
                    chatRoomId: resolvedRoomId,
                  }
                : session,
            ),
          );
        } else if (storageKey) {
          sessionStorage.setItem(storageKey, String(chatRoomIdForRequest));
        }

      if (result.sessionId) {
        // If this was the first initial prompt, remember its session id to unlock later
        if (initialCancelLockedRef.current && effectiveNewSession) {
          initialSessionIdRef.current = result.sessionId;
        }
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === newMessageId
              ? {
                  ...msg,
                  sessionId: result.sessionId,
                  chatRoomId: chatRoomIdForRequest as number,
                }
              : msg,
          ),
        );

        setSessions((prev) =>
          prev.map((session) =>
            session.chatRoomId === chatRoomIdForRequest
              ? {
                  ...session,
                  sessionId: result.sessionId,
                  updatedAt: new Date().toISOString(),
                  isActive: true,
                }
              : session,
          ),
        );

          bufferHandlers.getSessionState(result.sessionId, true);
        }

        void refreshSessions(chatRoomIdForRequest);
      } catch (error: any) {
        console.error('[processMessage] ERROR occurred:', {
          error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        console.error('[processMessage] Full error response:', {
          response: error?.response,
          data: error?.response?.data,
          message: error?.response?.data?.message,
          details: error?.response?.data?.details,
        });
        setLoadingState(false);

        // Check if this is a Supabase integration required error
        // NestJS BadRequestException response structure:
        // { statusCode: 400, message: { message: '...', details: {...} }, error: 'Bad Request' }
        const errorData = error?.response?.data;

        // Try different possible paths for details
        let errorDetails = null;
        if (errorData?.details) {
          errorDetails = errorData.details;
        } else if (errorData?.message && typeof errorData.message === 'object') {
          errorDetails = errorData.message.details;
        }

        console.log('[processMessage] Parsed errorDetails:', errorDetails);

        if (
          projectType !== 'dev' &&
          errorDetails?.requiresSupabase === true &&
          errorDetails?.supabaseConnected === false
        ) {
          // Show integration prompt message with link to Supabase settings
          setMessages((prev) => [
            ...prev,
            {
              id: `integration-prompt-${Date.now()}`,
              role: 'system',
              content: 'You need to connect Supabase first to proceed with this request.',
              timestamp: new Date(),
              variant: 'integration_prompt',
              actionData: {
                type: 'open_integration',
                integration: 'supabase',
                buttonText: 'Connect Supabase',
              },
              sessionId: sessionIdForRequest ?? currentSession?.sessionId ?? undefined,
              chatRoomId: chatRoomIdForRequest as number,
            },
          ]);
        } else {
          // Generic error message for other errors
          setMessages((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: 'system',
              content: 'Failed to send message. Please try again.',
              timestamp: new Date(),
              variant: 'system',
              sessionId: sessionIdForRequest ?? currentSession?.sessionId ?? undefined,
              chatRoomId: chatRoomIdForRequest as number,
            },
          ]);
        }
      }
    },
    [
      activeChatRoomId,
      selectedCli,
      selectedModel,
      selectedEffort,
      storageKey,
      notifyActivity,
      waitForPreviewReady,
      bufferHandlers,
      refreshSessions,
      sessions,
      mergeSessionsByRoom,
      safeProjectId,
      chatService,
    ],
  );

  const handleSendMessage = useCallback(
    async (
      overrideContent?: string,
      options?: {
        imageMetadata?: any[];
        newSession?: boolean;
        source?: 'home_initial' | 'new_session' | 'message';
      },
    ) => {
      const isOverride = typeof overrideContent === 'string';
      const content = overrideContent ?? input;
      const images = isOverride
        ? options?.imageMetadata ?? []
        : uploadedImages
            .filter((img) => img.metadata)
            .map((img) => img.metadata!);

      if (!content.trim() && images.length === 0) {
        return;
      }

      const previousImages = uploadedImages;
      if (!isOverride) {
        setUploadedImages([]);
      }

      try {
        await processMessage(
          content,
          undefined,
          options?.newSession,
          images,
          options?.source,
        );
        setInput('');
      } catch (error) {
        if (!isOverride) {
          setUploadedImages(previousImages);
        }
        throw error;
      }
    },
    [input, uploadedImages, processMessage],
  );

  const handleSessionSwitch = useCallback(
    async (chatRoomId: number | null) => {
      if (chatRoomId && chatRoomId === activeChatRoomId) {
        return;
      }

      if (!chatRoomId) {
        setActiveChatRoomId(null);
        if (storageKey) {
          sessionStorage.removeItem(storageKey);
        }
        setSessions((prev) =>
          prev.map((session) => ({ ...session, isActive: false })),
        );
        return;
      }

      setActiveChatRoomId(chatRoomId);
      if (storageKey) {
        sessionStorage.setItem(storageKey, String(chatRoomId));
      }

      // 서버 활성 전환은 명시적 Resume 버튼에서만 수행

      setSessions((prev) =>
        mergeSessionsByRoom(prev, [], chatRoomId),
      );

      void refreshSessions(chatRoomId);
    },
    [activeChatRoomId, chatService, mergeSessionsByRoom, refreshSessions, storageKey],
  );

  const resumeEditing = useCallback(async () => {
    if (!activeChatRoomId) return;
    try {
      await chatService.toggleSession(activeChatRoomId, true);
      setServerActiveRoomId(activeChatRoomId);
      await refreshSessions(activeChatRoomId);
    } catch (error) {
      clientLogger.warn('[Chat] Failed to resume editing for room:', activeChatRoomId, error);
    }
  }, [activeChatRoomId, chatService, refreshSessions]);

  const handleNewSession = useCallback(async () => {
    try {
      const created = await chatService.createChatRoom({
        provider: normalizeCli(selectedCli),
        model: selectedModel,
      });

      const newRoomId = created.id;
      setActiveChatRoomId(newRoomId);
      if (storageKey) {
        sessionStorage.setItem(storageKey, String(newRoomId));
      }
      setServerActiveRoomId(newRoomId);

      // 보수적으로 서버 활성화도 명시 호출(단일 활성 보장 실패 방지)
      try {
        await chatService.toggleSession(newRoomId, true);
      } catch (e) {
        clientLogger.warn('[Chat] toggleSession after create failed (will rely on server enforcement):', e);
      }

      const sessionPayload: ChatSession = {
        id: `chat-room-${newRoomId}`,
        projectId: safeProjectId,
        chatRoomId: newRoomId,
        sessionId: created.lastSessionId ?? null,
        isActive: true,
        status: created.isActive ? 'running' : 'completed',
        provider: normalizeCli(selectedCli),
        model: selectedModel ?? null,
        metadata: null,
        messageCount: created.messageCount ?? 0,
        lastMessage: created.lastMessage ?? null,
        lastSequence: 0,
        name: created.name ?? null,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        events: [],
      };

      setSessions((prev) =>
        mergeSessionsByRoom(prev, [sessionPayload], newRoomId),
      );

      void refreshSessions(newRoomId);

      return created;
    } catch (error) {
      clientLogger.error('[Chat] Failed to create new chat room:', error);
      throw error;
    }
  }, [chatService, selectedCli, selectedModel, mergeSessionsByRoom, refreshSessions, storageKey, safeProjectId]);

  const handleRenameSession = useCallback(
    async (chatRoomId: number, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return;
      }

      setSessions((prev) =>
        prev.map((session) =>
          session.chatRoomId === chatRoomId ? { ...session, name: trimmed } : session,
        ),
      );

      try {
        await chatService.renameSession(chatRoomId, trimmed);
      } catch (error) {
        clientLogger.error('[Chat] Failed to rename session:', error);
        await refreshSessions(activeChatRoomId);
      }
    },
    [activeChatRoomId, chatService, refreshSessions],
  );

  const handleCloseSession = useCallback(
    async (chatRoomId: number) => {
      try {
        await chatService.toggleSession(chatRoomId, false);
      } catch (error) {
        clientLogger.error('[Chat] Failed to deactivate session:', error);
        throw error;
      }

      const updated = await refreshSessions(activeChatRoomId === chatRoomId ? null : activeChatRoomId);

      if (activeChatRoomId === chatRoomId) {
        const fallback = updated.find((session) => session.chatRoomId !== chatRoomId);
        const fallbackId = fallback?.chatRoomId ?? null;
        setActiveChatRoomId(fallbackId);
        if (storageKey) {
          if (fallbackId !== null) {
            sessionStorage.setItem(storageKey, String(fallbackId));
          } else {
            sessionStorage.removeItem(storageKey);
          }
        }
      }
    },
    [activeChatRoomId, chatService, refreshSessions, storageKey],
  );

  const sendInitialMessage = useCallback(
    async (prompt: string, images?: any[]) => {
      // Prevent duplicate initial message
      if (hasProcessedInitialPromptRef.current) {
        return;
      }
      hasProcessedInitialPromptRef.current = true;
      // Engage cancellation lock for the initial prompt
      initialCancelLockedRef.current = true;
      initialSessionIdRef.current = null;

      // Check if images are ImageMetadata (objects with url, filename, etc.) or File objects
      const isImageMetadata = images && images.length > 0 && typeof images[0] === 'object' && 'url' in images[0];

      clientLogger.debug('[sendInitialMessage] Processing initial message with images:', {
        imagesCount: images?.length || 0,
        isImageMetadata,
        firstImage: images?.[0],
      });

      // We want to explicitly tag the origin for initial prompt from main page
      if (isImageMetadata) {
        // Pass as imageMetadata (pre-uploaded images from project creation)
        await processMessage(prompt, undefined, true, images, 'home_initial');
      } else {
        // Pass as File objects (normal file upload)
        await processMessage(prompt, images as File[], true, undefined, 'home_initial');
      }
    },
    [processMessage],
  );

  const handleImageUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Check current image count and limit to 5
    const remainingSlots = 5 - uploadedImages.length;
    if (remainingSlots <= 0) {
      alert('Maximum 5 images allowed');
      event.target.value = '';
      return;
    }

    // Filter out files larger than 5MB and unsupported formats
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];
    const unsupportedFiles: string[] = [];

    // Claude API only supports: jpeg, png, gif, webp
    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    Array.from(files).slice(0, remainingSlots).forEach((file) => {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const fileName = file.name.toLowerCase();
      const fileType = file.type.toLowerCase();

      // Check if file type or extension is supported
      const isSupportedType = supportedTypes.includes(fileType);
      const isSupportedExt = supportedExtensions.some(ext => fileName.endsWith(ext));

      if (!isSupportedType && !isSupportedExt) {
        unsupportedFiles.push(file.name);
      } else if (file.size > maxSize) {
        invalidFiles.push(file.name);
      } else {
        validFiles.push(file);
      }
    });

    if (unsupportedFiles.length > 0) {
      alert(`The following file formats are not supported:\n${unsupportedFiles.join('\n')}\n\nSupported formats: JPEG, PNG, GIF, WEBP`);
    }

    if (invalidFiles.length > 0) {
      alert(`The following images exceed 5MB and cannot be uploaded:\n${invalidFiles.join('\n')}`);
    }

    if (validFiles.length === 0) {
      event.target.value = '';
      return;
    }

    const newImages: UploadedImage[] = validFiles.map((file) => ({
      file,
      uploading: true,
    }));

    setUploadedImages((prev) => [...prev, ...newImages]);

    // Upload each image immediately
    for (let i = 0; i < newImages.length; i++) {
      const image = newImages[i];
      const imageIndex = uploadedImages.length + i;

      await Sentry.startSpan(
        {
          op: 'http.client',
          name: 'POST /api/uploads/image',
          attributes: {
            'http.method': 'POST',
            'http.url': '/api/uploads/image',
            fileSize: image.file.size,
            fileType: image.file.type,
          },
        },
        async () => {
          try {
            const result = await apiClient.uploadImage(image.file);

            setUploadedImages((prev) =>
              prev.map((img, idx) =>
                idx === imageIndex
                  ? { ...img, metadata: result, uploading: false }
                  : img
              )
            );
          } catch (error) {
            console.error('Failed to upload image:', error);
            Sentry.captureException(error, {
              contexts: {
                image_upload: {
                  fileSize: image.file.size,
                  fileType: image.file.type,
                  fileName: image.file.name,
                },
              },
            });
            setUploadedImages((prev) =>
              prev.map((img, idx) =>
                idx === imageIndex
                  ? { ...img, uploading: false, error: 'Upload failed' }
                  : img
              )
            );
          }
        },
      );
    }

    // Reset input
    event.target.value = '';
  }, [uploadedImages.length]);

  const removeImage = useCallback((index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleReconnect = useCallback(async () => {
    await hydrateSessions();
  }, [hydrateSessions]);

  const cancelActiveSession = useCallback(async () => {
    // Block cancellation during very first initial prompt
    if (initialCancelLockedRef.current) {
      throw new Error('초기 실행은 취소할 수 없습니다');
    }
    const chatRoomId =
      activeChatRoomId ||
      (storageKey && typeof window !== 'undefined'
        ? (() => {
            const stored = sessionStorage.getItem(storageKey);
            if (stored) {
              const parsed = parseInt(stored, 10);
              return isNaN(parsed) ? null : parsed;
            }
            return null;
          })()
        : null);
    if (!chatRoomId) {
      throw new Error('취소할 세션이 없습니다');
    }

    let targetSession = sessions.find(
      (session) => session.chatRoomId === chatRoomId,
    );
    let sessionIdForCancel: string | undefined = targetSession?.sessionId || undefined;

    if (!targetSession?.sessionId) {
      clientLogger.debug('[Chat] No active provider session to cancel (resolving...)');
      // Try to resolve sessionId by refreshing sessions a few times
      const tryDelay = (ms: number) => new Promise((r) => setTimeout(r, ms));
      let resolvedSessionId: string | undefined = undefined;
      for (let i = 0; i < 8 && !resolvedSessionId; i++) {
        const updated = await refreshSessions(chatRoomId);
        const found = updated.find((s) => s.chatRoomId === chatRoomId);
        resolvedSessionId = found?.sessionId ?? undefined;
        if (!resolvedSessionId) {
          await tryDelay(150);
        }
      }
      if (!resolvedSessionId) {
        throw new Error('세션 초기화 중입니다. 잠시 후 다시 시도해 주세요.');
      }
      // Rebind targetSession with resolved id
      targetSession = {
        ...(targetSession || { chatRoomId, projectId: safeProjectId } as any),
        sessionId: resolvedSessionId,
      } as any;
      sessionIdForCancel = resolvedSessionId;
    }

    try {
      const result = await chatService.cancelSession(
        sessionIdForCancel!,
        'Cancelled by user',
      );

      if (!result?.success) {
        throw new Error(result?.error || 'Cancellation failed');
      }

      setLoadingState(false);

      // Keep session state - user can continue chatting in the same session
      // activeChatRoomId and sessionStorage remain unchanged
    } catch (error) {
      console.error('Failed to cancel session:', error);
      const messageContent =
        error instanceof Error
          ? `Failed to cancel session: ${error.message}`
          : 'Failed to cancel session.';
      setMessages((prev) => [
        ...prev,
        {
          id: `cancel-error-${Date.now()}`,
          role: 'assistant',
          content: messageContent,
          timestamp: new Date(),
          variant: 'system',
          sessionId: sessionIdForCancel ?? undefined,
          chatRoomId: chatRoomId ?? undefined,
        },
      ]);
      setLoadingState(false);
    }
  }, [activeChatRoomId, chatService, sessions, storageKey, refreshSessions, safeProjectId]);

  // Derived flags used by UI
  const isInitialPromptRunning = isLoading && initialCancelLockedRef.current;
  const canCancelActiveSession = isLoading && !initialCancelLockedRef.current;
  const canEdit = useMemo(() => {
    if (!activeChatRoomId) return false;
    if (serverActiveRoomId == null) {
      const roomCount = sessions.filter((s) => typeof s.chatRoomId === 'number').length;
      return roomCount <= 1;
    }
    return activeChatRoomId === serverActiveRoomId;
  }, [activeChatRoomId, serverActiveRoomId, sessions]);

  const visibleMessages = useMemo(() => {
    if (!messages.length) {
      return [] as Message[];
    }

    if (!activeChatRoomId) {
      return messages;
    }

    // Get unique room IDs from sessions
    const roomIds = new Set(sessions.map(s => s.chatRoomId).filter(id => id != null));
    const isSingleRoomProject = roomIds.size <= 1;

    // Filter by room
    // In single-room projects: include NULL messages (from auto-recovery)
    // In multi-room projects: strictly filter by room ID
    const filtered = messages.filter((msg) => {
      if (msg.chatRoomId === activeChatRoomId) return true;
      if (isSingleRoomProject && msg.chatRoomId == null) return true;
      return false;
    });
    
    // Debug: Log if messages are being filtered out
    if (filtered.length < messages.length) {
      const hiddenCount = messages.length - filtered.length;
      const hiddenRooms = Array.from(new Set(
        messages.filter(m => !filtered.includes(m)).map(m => m.chatRoomId)
      ));
      console.log(`[visibleMessages] Hiding ${hiddenCount} messages from rooms:`, hiddenRooms, 'Active room:', activeChatRoomId);
    }
    
    return filtered;
  }, [messages, activeChatRoomId, sessions]);

  return {
    messages: visibleMessages,
    allMessages: messages,
    sessions,
    isLoading,
    isInitialPromptRunning,
    canCancelActiveSession,
    canEdit,
    roomsReady,
    input,
    uploadedImages,
    selectedCli,
    selectedModel,
    selectedEffort,
    activeChatRoomId,
    setInput,
    setSelectedModel,
    setSelectedEffort,
    setUploadedImages,
    setMessages,
    setSelectedCli,
    setActiveChatRoomId,
    handleSessionSwitch,
    handleNewSession,
    handleRenameSession,
    handleCloseSession,
    refreshSessions,
    handleAssistantTabSelect,
    handleSendMessage,
    handleImageUpload,
    removeImage,
    processMessage,
    sendInitialMessage,
    applyChatEvent,
    hydrateSessions,
    loadChatHistory,
    handleSessionStatus,
    handleReconnect,
    resetChatState,
    cancelActiveSession,
    historyLoadedRef,
    initialPromptRef,
    resumeEditing,
  };
};
