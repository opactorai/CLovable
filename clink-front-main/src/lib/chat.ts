import { io, Socket } from 'socket.io-client';
import { config } from './config';
import { apiClient } from './api-client';
import { clientLogger } from './client-logger';

export type AssistantMessageVariant =
  | 'message'
  | 'reasoning'
  | 'tool'
  | 'system'
  | 'secrets_request'
  | 'integration_prompt';

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
}

export interface ToolDetails {
  icon: string;
  label: string;
  details: string;
}

export interface ImageMetadata {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  base64?: string; // Optional: base64-encoded image data for CLI
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sessionId?: string | null;  // May be null initially, updated by turn_end event
  images?: ImageMetadata[];
  localFiles?: File[]; // For local preview before server response
  toolInvocations?: ToolInvocation[];
  variant?: AssistantMessageVariant;
  title?: string;
  toolName?: string;
  status?: 'running' | 'success' | 'failed'; // Tool execution status
  todos?: TodoItem[];
  toolDetails?: ToolDetails;
  duration?: string;
  isStreaming?: boolean;
  metadata?: Record<string, any>;
  chatRoomId?: number;
  secretsData?: {
    secrets: Array<{
      key: string;
      label: string;
      required?: boolean;
      placeholder?: string;
    }>;
    requestId?: string;
    sessionId: string;
  };
  actionData?: {
    type: 'open_integration';
    integration: 'supabase' | 'github' | 'other-apps';
    buttonText?: string;
  };
}

export interface ToolInvocation {
  toolName: string;
  parameters: any;
  result?: any;
  error?: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileNode[];
}

interface SandboxFileNode {
  name?: string;
  path?: string;
  type?: 'file' | 'folder' | 'directory';
  children?: SandboxFileNode[];
}

export interface ChatStreamEventPayload {
  projectId: string;
  sessionId: string;
  chatRoomId?: number;
  event: string;
  sequence: number;
  payload: any;
  createdAt: string;
  timestamp: string;
}

export interface ChatSessionStatusPayload {
  projectId: string;
  sessionId: string;
  chatRoomId?: number;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  provider?: string | null;
  model?: string | null;
  createdAt: string;
  updatedAt: string;
  lastSequence: number;
  sequence?: number;
  timestamp: string;
}

export interface ProvisioningUpdatePayload {
  projectId: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  step?: string;
  progress?: number;
  timestamp: string;
}

export interface ProjectStatusUpdatePayload {
  projectId: string;
  status:
    | 'creating'
    | 'active'
    | 'failed'
    | 'stopped'
    | 'archived'
    | 'starting';
  timestamp: string;
  urls?: {
    devServer?: string;
    preview?: string;
    codeServer?: string;
    mcpUrl?: string;
    repoId?: string;
  };
  // Direct fields sent by backend (in addition to urls object)
  previewUrl?: string;
  devServerUrl?: string;
  sandboxId?: string;
  error?: string;
  lifecycle?: {
    phase?: string;
    reason?: string;
    idleSeconds?: number;
  };
}

export interface FreestyleMessagePayload {
  projectId: string;
  type: string;
  message: string;
  data?: any;
  timestamp: string;
  level?: 'info' | 'warning' | 'error';
}

export interface ServerRestartPayload {
  projectId: string;
  status: 'restarting' | 'completed' | 'failed';
  message: string;
  timestamp: string;
}

export interface ChatRoom {
  id: number;
  projectId: string;
  name: string | null;
  isActive: boolean;
  messageCount: number;
  lastMessage: string | null;
  lastSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSession {
  id: string;
  projectId: string;
  chatRoomId: number;
  sessionId: string | null;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  isActive?: boolean;
  provider?: string | null;
  model?: string | null;
  name?: string | null;
  metadata?: Record<string, any> | null;
  messageCount?: number;
  lastMessage?: string | null;
  lastSequence: number;
  createdAt: string;
  updatedAt: string;
  events?: ChatStreamEvent[];
}

export interface ChatStreamEvent {
  id: number;
  projectId: string;
  sessionId: string;
  sequence: number;
  event: string;
  payload: any;
  createdAt: string;
}

class ChatService {
  private projectId: string | null = null;
  private socket: Socket | null = null;
  private joinedProjects = new Set<string>();
  private activeSubscriptions = new Map<string, number>();

  async initializeProject(projectId: string) {
    this.projectId = projectId;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private ensureProjectId() {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }
    return this.projectId;
  }

  private ensureSocket(): Socket {
    if (this.socket) {
      return this.socket;
    }

    const socket = io(`${config.apiUrl}/projects`, {
      withCredentials: true,
      autoConnect: false,
    });

    // Re-join project rooms on reconnect to continue receiving events
    socket.on('connect', () => {
      this.joinedProjects.forEach((projectId) => {
        socket.emit('joinProject', { projectId });
      });
    });

    socket.on('disconnect', (reason) => {
      clientLogger.info(`Socket disconnected (${reason})`);
    });

    socket.on('connect_error', (error: unknown) => {
      if (this.isUnauthorizedSocketError(error)) {
        clientLogger.warn('Socket unauthorized. Attempting token refresh before reconnect.');
        void this.connectWithFreshAuth(socket, true);
        return;
      }

      clientLogger.warn('Socket connection error', error);
    });

    socket.on('error', (error: unknown) => {
      clientLogger.error('Socket error:', error);
    });

    // Debug: Log all incoming events (can be removed in production)
    const logAllEvents = (eventName: string, ...args: any[]) => {
      if (!['connect', 'disconnect', 'connect_error'].includes(eventName)) {
        clientLogger.info(`[Socket] Received event: ${eventName}`, args);
      }
    };
    socket.onAny(logAllEvents);
    clientLogger.info('[Socket] onAny listener added');

    socket.io.on('reconnect_attempt', () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) {
        socket.auth = { ...(socket.auth ?? {}), token };
      } else {
        socket.auth = {};
      }
    });

    void this.connectWithFreshAuth(socket);

    this.socket = socket;
    return socket;
  }

  private async connectWithFreshAuth(socket: Socket, forceRefresh = false): Promise<void> {
    const hasToken = await this.updateSocketAuth(socket, forceRefresh);
    if (!hasToken) {
      clientLogger.warn('Unable to establish socket connection: no valid access token.');
      return;
    }

    if (!socket.connected) {
      socket.connect();
    }
  }

  private async updateSocketAuth(socket: Socket, forceRefresh = false): Promise<boolean> {
    try {
      const token = await apiClient.ensureFreshAccessToken(forceRefresh);
      if (!token) {
        socket.auth = {};
        return false;
      }

      socket.auth = { ...(socket.auth ?? {}), token };
      return true;
    } catch (error) {
      clientLogger.warn('Failed to update socket authentication token', error);
      return false;
    }
  }

  private isUnauthorizedSocketError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const err = error as {
      message?: string;
      status?: number;
      statusCode?: number;
      code?: number | string;
      data?: Record<string, unknown> | null;
    };

    const statusCandidates = [err.status, err.statusCode, err.code];
    if (statusCandidates.some((value) => Number(value) === 401)) {
      return true;
    }

    if (err.data) {
      const data = err.data as Record<string, unknown>;
      const dataStatus = [data['status'], data['statusCode'], data['code']];
      if (dataStatus.some((value) => Number(value) === 401)) {
        return true;
      }
      const dataMessage =
        typeof data['message'] === 'string' ? data['message'].toLowerCase() : '';
      if (dataMessage.includes('unauthorized') || dataMessage.includes('token')) {
        return true;
      }
    }

    const message = typeof err.message === 'string' ? err.message.toLowerCase() : '';
    return (
      message.includes('unauthorized') ||
      message.includes('jwt') ||
      message.includes('token')
    );
  }

  requestResumeStream(projectId: string, sessionId: string, lastSequence: number) {
    const socket = this.ensureSocket();
    clientLogger.info(
      `Requesting resume for session ${sessionId} from sequence ${lastSequence}`,
    );
    socket.emit('resumeStream', { projectId, sessionId, lastSequence });
  }

  subscribeToProject(
    projectId: string,
    handlers: {
      onChatEvent?: (event: ChatStreamEventPayload) => void;
      onSessionStatus?: (status: ChatSessionStatusPayload) => void;
      onProvisioningUpdate?: (update: ProvisioningUpdatePayload) => void;
      onProjectStatus?: (status: ProjectStatusUpdatePayload) => void;
      onFreestyleMessage?: (message: FreestyleMessagePayload) => void;
      onResumeComplete?: (data: { sessionId: string; count: number; message: string }) => void;
      onResumeError?: (data: { message: string }) => void;
      onReconnect?: () => void;
      onServerRestart?: (data: ServerRestartPayload) => void;
    } = {},
  ) {
    if (!this.projectId) {
      this.projectId = projectId;
    }

    const count = (this.activeSubscriptions.get(projectId) || 0) + 1;
    this.activeSubscriptions.set(projectId, count);
    clientLogger.info(`[Chat] subscribeToProject called for ${projectId} (subscription #${count})`);

    const socket = this.ensureSocket();

    // Handle reconnection
    const reconnectHandler = () => {
      clientLogger.info('Socket reconnected');
      handlers.onReconnect?.();
    };


    socket.on('connect', reconnectHandler);

    // Capture projectId at subscription time to avoid stale closures
    const subscribedProjectId = projectId;

    const chatHandler = (payload: ChatStreamEventPayload) => {
      clientLogger.info(`[Chat] chatStream: payload.projectId=${payload.projectId}, subscribedProjectId=${subscribedProjectId}, match=${payload.projectId === subscribedProjectId}, hasHandler=${!!handlers.onChatEvent}`);
      if (payload.projectId === subscribedProjectId) {
        if (handlers.onChatEvent) {
          handlers.onChatEvent(payload);
          clientLogger.info(`[Chat] Called onChatEvent handler for ${payload.event}`);
        } else {
          clientLogger.warn(`[Chat] No onChatEvent handler provided for subscription to ${subscribedProjectId}`);
        }
      } else {
        clientLogger.warn(`[Chat] Ignoring chatStream for wrong project: ${payload.projectId} (subscribed to: ${subscribedProjectId})`);
      }
    };

    const sessionStatusHandler = (payload: ChatSessionStatusPayload) => {
      clientLogger.info(`[Chat] chatSessionStatus: payload.projectId=${payload.projectId}, subscribedProjectId=${subscribedProjectId}, match=${payload.projectId === subscribedProjectId}`);
      if (payload.projectId === subscribedProjectId) {
        handlers.onSessionStatus?.(payload);
      } else {
        clientLogger.warn(`[Chat] Ignoring chatSessionStatus for wrong project: ${payload.projectId} (subscribed to: ${subscribedProjectId})`);
      }
    };

    const provisioningHandler = (payload: ProvisioningUpdatePayload) => {
      if (payload.projectId === subscribedProjectId) {
        handlers.onProvisioningUpdate?.(payload);
      }
    };

    const projectStatusHandler = (payload: ProjectStatusUpdatePayload) => {
      if (payload.projectId === subscribedProjectId) {
        handlers.onProjectStatus?.(payload);
      }
    };

    const freestyleHandler = (payload: FreestyleMessagePayload) => {
      if (payload.projectId === subscribedProjectId) {
        handlers.onFreestyleMessage?.(payload);
      }
    };

    const resumeCompleteHandler = (data: { sessionId: string; count: number; message: string }) => {
      handlers.onResumeComplete?.(data);
    };

    const resumeErrorHandler = (data: { message: string }) => {
      handlers.onResumeError?.(data);
    };

    const serverRestartHandler = (payload: ServerRestartPayload) => {
      if (payload.projectId === subscribedProjectId) {
        handlers.onServerRestart?.(payload);
      }
    };

    socket.on('chatStream', chatHandler);
    socket.on('chatSessionStatus', sessionStatusHandler);
    socket.on('provisioningUpdate', provisioningHandler);
    socket.on('projectStatusUpdate', projectStatusHandler);
    socket.on('freestyleMessage', freestyleHandler);
    socket.on('resumeComplete', resumeCompleteHandler);
    socket.on('resumeError', resumeErrorHandler);
    socket.on('serverRestart', serverRestartHandler);

    // Emit joinProject - wait for socket to connect if not already connected
    const emitJoin = () => {
      clientLogger.info(`[Chat] Joining project ${projectId}, socket connected: ${socket.connected}`);
      socket.emit('joinProject', { projectId });
      clientLogger.info(`[Chat] joinProject emitted for ${projectId}`);
    };

    if (socket.connected) {
      clientLogger.info('[Chat] Socket already connected, emitting joinProject immediately');
      emitJoin();
    } else {
      // Wait for connection before joining
      clientLogger.info(`[Chat] Waiting for socket connection to join project ${projectId}`);
      const onConnectJoin = () => {
        clientLogger.info('[Chat] Socket connected, now emitting joinProject');
        emitJoin();
        socket.off('connect', onConnectJoin);
      };
      socket.on('connect', onConnectJoin);
    }

    this.joinedProjects.add(projectId);

    return () => {
      const remaining = (this.activeSubscriptions.get(projectId) || 1) - 1;
      this.activeSubscriptions.set(projectId, remaining);
      clientLogger.info(`[Chat] Unsubscribed from ${projectId} (${remaining} subscriptions remaining)`);

      // Always remove the specific handlers for this subscription
      socket.off('chatStream', chatHandler);
      socket.off('chatSessionStatus', sessionStatusHandler);
      socket.off('provisioningUpdate', provisioningHandler);
      socket.off('projectStatusUpdate', projectStatusHandler);
      socket.off('freestyleMessage', freestyleHandler);
      socket.off('resumeComplete', resumeCompleteHandler);
      socket.off('resumeError', resumeErrorHandler);
      socket.off('serverRestart', serverRestartHandler);
      socket.off('connect', reconnectHandler);

      // Only leave the project room if this was the last subscription
      if (remaining === 0) {
        socket.emit('leaveProject', { projectId });
        this.joinedProjects.delete(projectId);
        this.activeSubscriptions.delete(projectId);
      }
    };
  }

  async sendMessage(
    content: string,
    images: File[] = [],
    options?: {
      cli?: string;
      model?: string;
      effort?: string;
      newSession?: boolean;
      source?: 'home_initial' | 'new_session' | 'message';
      timestamp?: number;
      imageMetadata?: ImageMetadata[];
      sessionId?: string;
      chatRoomId?: number;
      integrationsHint?: {
        supabaseConnected?: boolean;
        githubConnected?: boolean;
      };
    },
  ): Promise<{ sessionId: string | null; chatId?: string; sseReady: boolean; chatRoomId?: number }> {
    clientLogger.debug('[ChatService.sendMessage] START - Called with:', {
      contentLength: content.length,
      imagesCount: images.length,
      options,
    });

    const projectId = this.ensureProjectId();
    clientLogger.debug('[ChatService.sendMessage] projectId:', projectId);

    const formData = new FormData();
    formData.append('message', content);
    formData.append('projectId', projectId);
    formData.append('timestamp', String(options?.timestamp ?? Date.now()));

    if (options?.cli) {
      clientLogger.debug('[ChatService.sendMessage] Adding cli to FormData:', options.cli);
      formData.append('cli', options.cli);
    } else {
      clientLogger.debug('[ChatService.sendMessage] cli is missing from options:', options);
    }
    if (options?.model) {
      clientLogger.debug('[ChatService.sendMessage] Adding model to FormData:', options.model);
      formData.append('model', options.model);
    }
    if (options?.effort) {
      formData.append('effort', options.effort);
    }
    if (options?.newSession) {
      formData.append('newSession', 'true');
    }
    if (options?.source) {
      formData.append('source', options.source);
    }
    if (options?.imageMetadata) {
      formData.append('imageMetadata', JSON.stringify(options.imageMetadata));
    }

    images.forEach((file) => {
      formData.append('images', file);
    });

    if (options?.sessionId) {
      formData.append('sessionId', options.sessionId);
    }

    if (options?.chatRoomId) {
      formData.append('chatRoomId', String(options.chatRoomId));
    }

    if (options?.integrationsHint) {
      formData.append('integrationsHint', JSON.stringify(options.integrationsHint));
    }

    clientLogger.debug('[ChatService.sendMessage] FormData prepared, about to call apiClient.request');
    clientLogger.debug('[ChatService.sendMessage] Request URL: /api/chat');
    clientLogger.debug('[ChatService.sendMessage] Request method: POST');

    try {
      const response = await apiClient.request<{
        sessionId: string;
        chatId?: string;
        sseReady: boolean;
        resume?: {
          resumed: boolean;
          source?: string;
          sessionId?: string;
        };
      }>(`/api/chat`, {
        method: 'POST',
        body: formData,
      });
      clientLogger.debug('[ChatService.sendMessage] SUCCESS - Response received:', response);
      return response;
    } catch (error) {
      clientLogger.error('[ChatService.sendMessage] ERROR - Request failed:', error);
      throw error;
    }
  }

  async cancelSession(
    sessionId: string,
    reason?: string,
  ): Promise<{ success: boolean; message?: string; error?: string; status?: string }> {
    const projectId = this.ensureProjectId();
    const body = reason && reason.trim().length > 0 ? { reason } : {};

    return apiClient.request(`/api/chat/${projectId}/sessions/${sessionId}/cancel`, {
      method: 'POST',
      body,
    });
  }

  async listSessions(includeEvents = false): Promise<ChatSession[]> {
    const projectId = this.ensureProjectId();
    return apiClient.request(
      `/api/chat/${projectId}/sessions?includeEvents=${includeEvents}`,
    );
  }

  async getSessionEvents(
    sessionId: string,
    after?: number,
  ): Promise<ChatStreamEvent[]> {
    const projectId = this.ensureProjectId();
    const query = typeof after === 'number' ? `?after=${after}` : '';
    return apiClient.request(
      `/api/chat/${projectId}/sessions/${sessionId}/events${query}`,
    );
  }

  async getActiveSessions(): Promise<Record<string, any>> {
    const projectId = this.ensureProjectId();
    return apiClient.request(`/api/chat/${projectId}/active-sessions`);
  }

  async getActiveSessionsList(provider?: string): Promise<ChatSession[]> {
    const projectId = this.ensureProjectId();
    const query = provider ? `?provider=${encodeURIComponent(provider)}` : '';
    return apiClient.request(
      `/api/chat/${projectId}/sessions/active${query}`,
    );
  }

  async toggleSession(chatRoomId: number, isActive: boolean): Promise<void> {
    const projectId = this.ensureProjectId();
    await apiClient.request(
      `/api/chat/${projectId}/chat-rooms/${chatRoomId}/toggle`,
      {
        method: 'PATCH',
        body: { isActive },
      },
    );
  }

  async renameSession(chatRoomId: number, name: string): Promise<void> {
    const projectId = this.ensureProjectId();
    await apiClient.request(
      `/api/chat/${projectId}/chat-rooms/${chatRoomId}/rename`,
      {
        method: 'PATCH',
        body: { name },
      },
    );
  }

  async createChatRoom(options?: {
    provider?: string;
    model?: string;
  }): Promise<ChatRoom> {
    const projectId = this.ensureProjectId();
    return apiClient.request<ChatRoom>(
      `/api/chat/${projectId}/chat-rooms`,
      {
        method: 'POST',
        body: {
          provider: options?.provider,
          model: options?.model,
        },
      },
    );
  }

  async listChatRooms(): Promise<ChatRoom[]> {
    const projectId = this.ensureProjectId();
    return apiClient.request<ChatRoom[]>(`/api/chat/${projectId}/chat-rooms`);
  }

  async getProjectFiles(): Promise<FileNode[]> {
    const projectId = this.ensureProjectId();

    try {
      const response = await apiClient.request<any>(
        `/api/projects/${projectId}/files`,
      );

      return this.normalizeFileTreeResponse(response);
    } catch (error) {
      clientLogger.error('Failed to get project files:', error);
      return [];
    }
  }

  async getFileContent(
    filePath: string,
    options: { workspacePath?: string } = {},
  ): Promise<string> {
    const projectId = this.ensureProjectId();
    const params = new URLSearchParams({ filePath });
    if (options.workspacePath) {
      params.set('workspacePath', options.workspacePath);
    }

    const response = await apiClient.request<any>(
      `/api/projects/${projectId}/files/content?${params.toString()}`,
    );

    return this.extractFileContent(response);
  }

  async updateFileContent(
    filePath: string,
    content: string,
    options: { workspacePath?: string } = {},
  ): Promise<void> {
    const projectId = this.ensureProjectId();
    const body: Record<string, any> = { filePath, content };
    if (options.workspacePath) {
      body.workspacePath = options.workspacePath;
    }

    await apiClient.request(`/api/projects/${projectId}/files/content`, {
      method: 'PUT',
      body,
    });
  }

  private extractFileContent(payload: any): string {
    if (payload == null) {
      return '';
    }

    if (typeof payload === 'string') {
      return payload;
    }

    if (typeof payload === 'object') {
      const possibleKeys = ['content', 'data', 'body', 'text'];
      for (const key of possibleKeys) {
        const value = payload[key];
        if (typeof value === 'string') {
          return value;
        }
      }

      if (Array.isArray(payload.lines)) {
        return payload.lines.join('\n');
      }
    }

    return String(payload);
  }

  private normalizeFileTreeResponse(payload: any): FileNode[] {
    const nodes: SandboxFileNode[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.tree)
        ? payload.tree
        : [];

    return nodes
      .map((node) => this.normalizeSandboxNode(node))
      .filter((node): node is FileNode => node !== null);
  }

  private normalizeSandboxNode(
    node: SandboxFileNode | undefined,
  ): FileNode | null {
    if (!node || typeof node !== 'object') {
      return null;
    }

    const name = typeof node.name === 'string' ? node.name : null;
    const path = typeof node.path === 'string' ? node.path : null;
    if (!name || !path) {
      return null;
    }

    const type = this.normalizeNodeType(node.type);
    if (!type) {
      return null;
    }

    const normalized: FileNode = {
      name,
      path,
      type,
    };

    if (type === 'folder' && Array.isArray(node.children)) {
      const children = node.children
        .map((child) => this.normalizeSandboxNode(child))
        .filter((child): child is FileNode => child !== null);

      if (children.length > 0) {
        normalized.children = children;
      }
    }

    return normalized;
  }

  private normalizeNodeType(
    type: SandboxFileNode['type'],
  ): FileNode['type'] | null {
    if (type === 'file') {
      return 'file';
    }

    if (type === 'folder' || type === 'directory') {
      return 'folder';
    }

    return null;
  }

  async commitChanges(message: string = 'AI-generated changes'): Promise<void> {
    void message;
  }

  async getAvailableTools() {
    return [
      {
        name: 'read_file',
        description: 'Read file contents',
        parameters: { path: 'string' },
      },
      {
        name: 'write_file',
        description: 'Write file contents',
        parameters: { path: 'string', content: 'string' },
      },
      {
        name: 'create_file',
        description: 'Create new file',
        parameters: { path: 'string', content: 'string' },
      },
    ];
  }
}

export const chatService = new ChatService();
