'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { chatService, type ProvisioningUpdatePayload } from '@/lib/chat';
import { apiClient } from '@/lib/api-client';
import { clientLogger } from '@/lib/client-logger';
import { resumeSandboxAndWait } from '@/lib/sandbox-resume';
import { normalizeCli, ASSISTANT_OPTIONS } from '@/lib/assistant-options';
import { ChatSidebar } from './ChatSidebar';
import { PreviewPanel } from './PreviewPanel';
import ProjectSettingsModal from '@/components/ProjectSettingsModal';
import type { IFrameError } from './ErrorCard';
import { ErrorDetailModal } from './ErrorDetailModal';
import { BuildThemeProvider } from '@/contexts/BuildThemeContext';
import { safelyParseJson } from '@/lib/utils/json';
import type { UserProfile } from '@/types/user';
import type { Provider } from '@/types/streaming';
import type { FileNode } from '@/lib/chat';
import { useBuildInitialization } from '../hooks/useBuildInitialization';
import { useProjectLifecycle } from '../hooks/useProjectLifecycle';
import { useChatSessions } from '../hooks/useChatSessions';
import { useFileTree } from '../hooks/useFileTree';
import { useFileEditor } from '../hooks/useFileEditor';
import { useProjectActivity } from '../hooks/useProjectActivity';
import { useStreamActivityTracking } from '../hooks/useStreamActivityTracking';
import { usePublishControls } from '../hooks/usePublishControls';
import { useLatest } from '@/hooks/use-latest';

export function BuildPageContent({
  user,
  refreshAuth,
}: {
  user: UserProfile;
  refreshAuth: () => Promise<void>;
}) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const projectId = params.id as string;
  const initialPrompt = searchParams.get('prompt');
  const cliParam = searchParams.get('cli');
  const modelParam = searchParams.get('model');
  const effortParam = searchParams.get('effort');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    'project' | 'custom' | 'workspace' | 'billing' | 'integrations'
  >('project');
  const [settingsInitialIntegration, setSettingsInitialIntegration] = useState<
    'supabase' | 'github' | 'other-apps' | null
  >(null);

  const [activeView, setActiveView] = useState<'preview' | 'code' | 'analytics' | 'terminal'>('preview');
  const [hasDevServer, setHasDevServer] = useState(false);
  const hasRequestedFileTreeRef = useRef(false);
  const [provider, setProvider] = useState<Provider>('claude');
  const [highlightRequest, setHighlightRequest] = useState<{ line: number; timestamp: number } | null>(null);

  const [appRoutes, setAppRoutes] = useState<string[]>([]);
  const hasRequestedAppRoutesRef = useRef(false);

  const [integrationsStatus, setIntegrationsStatus] = useState<{
    supabaseConnected: boolean;
    githubConnected: boolean;
  }>({ supabaseConnected: false, githubConnected: false });

  // Turn diff state (shown in code panel)
  const [turnDiff, setTurnDiff] = useState<any | null>(null);
  const [restoreState, setRestoreState] = useState<Record<string, 'idle' | 'loading' | 'confirming'>>({});
  const [restoreOriginalHash, setRestoreOriginalHash] = useState<string | null>(null);

  // IFrame errors state
  const [iframeErrors, setIframeErrors] = useState<IFrameError[]>([]);
  const [iframeConsoles, setIframeConsoles] = useState<IFrameError[]>([]);
  const [showErrorDetail, setShowErrorDetail] = useState(false);
  const [shouldSendErrorFix, setShouldSendErrorFix] = useState(false);
  const [hideErrorsUntil, setHideErrorsUntil] = useState<number>(0);

  const userPlan = user.plan ?? 'free';
  const [accessDenied, setAccessDenied] = useState(false);
  const [serverRestartStatus, setServerRestartStatus] = useState<{
    status: 'restarting' | 'completed' | 'failed' | null;
    message: string;
  }>({ status: null, message: '' });
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Handle payment redirect
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const tab = searchParams.get('tab');

    // Only process if we have the query params
    if (!paymentStatus || !tab) return;

    if (paymentStatus === 'success' && tab === 'custom') {
      // Refresh user data to get updated plan
      refreshAuth();
      setSettingsInitialTab('custom');
      setIsSettingsModalOpen(true);
    } else if (paymentStatus === 'cancelled' && tab === 'custom') {
      setSettingsInitialTab('custom');
      setIsSettingsModalOpen(true);
    }

    // Clean up URL immediately
    const newUrl = `/build/${projectId}`;
    router.replace(newUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const {
    streamingState,
    processEvent,
    resetTurn,
  } = useStreamActivityTracking(provider);

  const {
    projectName,
    projectStatus,
    previewUrl,
    previewNonce,
    isPreviewRunning,
    isPreviewLoading,
    previewReady,
    refreshProject,
    waitForPreviewReady,
    startPreview,
    stopPreview,
    publishProject,
    fetchDeploymentStatus,
    triggerPreview: triggerPreviewLifecycle,
    forcePreviewRefresh,
    handleProjectStatusUpdate,
    handleFreestyleMessage,
    resetLifecycle,
    project,
    railwayDeploymentStatus,
    railwayMessage,
    railwayUrl,
    railwayErrorLogs,
    checkRailwayDeploymentStatus,
  } = useProjectLifecycle(projectId);

  const { notifyActivity, sandboxId: activitySandboxId } = useProjectActivity(
    projectId,
    project?.sandboxId ?? null,
  );

  const refreshProjectAndTrack = useCallback(async () => {
    const data = await refreshProject();
    const hasDev = Boolean(data?.devServerUrl);
    setHasDevServer(hasDev);
    // 샌드박스가 없으면 파일 트리 요청 플래그 리셋 (샌드박스 재생성 시 다시 로드하기 위해)
    if (!data?.sandboxId) {
      hasRequestedFileTreeRef.current = false;
    }
    return data;
  }, [refreshProject]);

  const {
    isPublishPanelOpen,
    setIsPublishPanelOpen,
    publishState,
    deploymentError,
    subdomainName,
    setSubdomainName,
    publishDomain,
    handleSubdomainChange,
    currentDeploymentSubdomain,
    setCurrentDeploymentSubdomain,
    handlePublishButtonClick,
    handlePublishPanelClose,
    handleUpdatePublish,
    handleUnpublish,
  } = usePublishControls({
    projectId,
    project,
    projectName,
    fetchDeploymentStatus,
    publishProject,
    refreshProjectAndTrack,
    notifyActivity,
  });

  // Check project ownership and redirect if user doesn't own this project
  // Admin users can access all projects
  useEffect(() => {
    if (!project) {
      return;
    }

    // Admin and super_admin users can access all projects
    if (user.role === 'admin' || user.role === 'super_admin') {
      return;
    }

    const projectUserId =
      (project as any).userId ||
      (project as any).user?.id ||
      (project as any).ownerId;

    if (projectUserId && projectUserId !== user.id) {
      clientLogger.warn('[BuildPage] Access denied: User does not own this project');
      setAccessDenied(true);
      router.push('/');
    }
  }, [project, user.id, user.role, router]);

  const openSettingsModal = useCallback(
    (
      tab: 'project' | 'custom' | 'workspace' | 'billing' | 'integrations',
      integration: 'supabase' | 'github' | 'other-apps' | null = null,
    ) => {
      setSettingsInitialTab(tab);
      setSettingsInitialIntegration(integration);
      setIsSettingsModalOpen(true);
    },
    [],
  );

  const handleOpenProjectSettings = useCallback(() => {
    openSettingsModal('project');
  }, [openSettingsModal]);

  const handleOpenGithubSettings = useCallback(() => {
    openSettingsModal('integrations', 'github');
  }, [openSettingsModal]);

  const handleOpenSupabaseSettings = useCallback(() => {
    openSettingsModal('integrations', 'supabase');
  }, [openSettingsModal]);

  const handleSettingsClose = useCallback(async () => {
    setIsSettingsModalOpen(false);
    setSettingsInitialTab('project');
    setSettingsInitialIntegration(null);

    // Refresh integrations status after closing settings modal
    if (projectId) {
      try {
        const status = await apiClient.getIntegrationsStatus(projectId);
        clientLogger.info('[BuildPage] Refreshed integrations status after settings close:', status);
        setIntegrationsStatus(status);
      } catch (error) {
        clientLogger.warn('[BuildPage] Failed to refresh integrations status:', error);
      }
    }
  }, [projectId]);

  // IFrame error handlers
  const handleIFrameError = useCallback((error: IFrameError) => {
    setIframeErrors((prev) => {
      // Check if exact same error already exists
      const isDuplicate = prev.some((existingError) => {
        // Compare by error type first
        if (existingError.type !== error.type) return false;

        // Vite errors: compare raw content
        if (error.type === 'vite') {
          return existingError.raw === error.raw;
        }

        // Runtime errors: compare message, filename, and line number
        if (error.type === 'runtime') {
          return (
            existingError.message === error.message &&
            existingError.filename === error.filename &&
            existingError.lineno === error.lineno
          );
        }

        // Promise errors: compare message and stack
        if (error.type === 'promise') {
          return (
            existingError.message === error.message &&
            existingError.stack === error.stack
          );
        }

        return false;
      });

      // Don't add if duplicate
      if (isDuplicate) {
        return prev;
      }

      // Limit to last 10 errors
      const updated = [error, ...prev].slice(0, 10);
      return updated;
    });
    // Clear consoles when there's an error (focus on errors)
    setIframeConsoles([]);
  }, []);

  const handleIFrameSuccess = useCallback(() => {
    // Clear all errors when page loads successfully without errors
    setIframeErrors([]);
    setIframeConsoles([]);
    // Clear fixing flag when iframe successfully rebuilds
    setShouldSendErrorFix(false);
  }, []);

  const handleIFrameConsole = useCallback((log: IFrameError) => {
    // Ignore all console logs (only show Vite, Runtime, Promise errors)
    // Console errors/warnings are too noisy and not critical
  }, []);

  const handleOpenErrorDetail = useCallback(() => {
    setShowErrorDetail(true);
  }, []);

  const triggerPreviewWithActivity = useCallback(() => {
    notifyActivity('preview:start');
    triggerPreviewLifecycle();
  }, [notifyActivity, triggerPreviewLifecycle]);

  const {
    fileTree,
    expandedFolders,
    selectedFile,
    openFiles,
    loadFileTree,
    toggleFolder,
    selectFile,
    closeFile,
    resetFileTree,
    expandToFile,
  } = useFileTree({ notifyActivity });

  const {
    content: fileContent,
    isLoading: isFileLoading,
    isSaving: isSavingFile,
    dirty: isFileDirty,
    error: fileError,
    lastSavedAt,
    loadContent: loadFileContent,
    updateContent: updateFileContent,
    saveContent: saveFileContent,
    reset: resetFileEditor,
    setError: setFileError,
    dirtyFiles,
    evictFile,
    refreshFiles,
  } = useFileEditor({ notifyActivity });

  const refreshAppRoutes = useCallback(async () => {
    if (!projectId || !isPreviewRunning) {
      return;
    }

    try {
      const response = await apiClient.getAppRoutes(projectId);
      if (response.routes && Array.isArray(response.routes)) {
        const validRoutes = response.routes.filter((route) => {
          if (!route || typeof route !== 'string') return false;
          const trimmed = route.trim();
          if (!trimmed || trimmed === '*' || trimmed === '/*' || trimmed.replace(/\*/g, '').trim() === '') {
            return false;
          }
          return true;
        });
        setAppRoutes(validRoutes);
      }
    } catch (error) {
      console.error('Failed to fetch app routes:', error);
    }
  }, [projectId, isPreviewRunning]);

  const handleTurnEnd = useCallback(async () => {
    const targets = Array.from(
      new Set([
        ...openFiles,
        ...(selectedFile ? [selectedFile] : []),
      ]),
    );

    const tasks: Promise<unknown>[] = [loadFileTree()];
    if (targets.length > 0) {
      tasks.push(refreshFiles(targets));
    }
    if (isPreviewRunning) {
      tasks.push(refreshAppRoutes());
    }

    await Promise.allSettled(tasks);

    // Briefly hide errors after turn end to wait for iframe rebuild
    // This prevents flickering during the rebuild process
    setHideErrorsUntil(Date.now() + 1000);
  }, [openFiles, selectedFile, loadFileTree, refreshFiles, isPreviewRunning, refreshAppRoutes]);

  const {
    messages,
    allMessages,
    isLoading,
    isInitialPromptRunning,
    canCancelActiveSession,
    canEdit,
    roomsReady,
    input,
    setMessages,
    sessions,
    activeChatRoomId,
    uploadedImages,
    selectedCli,
    selectedModel,
    selectedEffort,
    setInput,
    setSelectedModel,
    setSelectedEffort,
    setSelectedCli,
    handleSessionSwitch,
    handleNewSession,
    handleRenameSession,
    handleCloseSession,
    handleAssistantTabSelect,
    handleSendMessage,
    handleImageUpload,
    removeImage,
    applyChatEvent,
    hydrateSessions,
    loadChatHistory,
    handleSessionStatus,
    resetChatState,
    sendInitialMessage,
    handleReconnect,
    cancelActiveSession,
    historyLoadedRef,
    initialPromptRef,
    resumeEditing,
    processMessage,
  } = useChatSessions({
    projectId,
    initialPrompt,
    previewReady,
    waitForPreviewReady,
    triggerPreview: triggerPreviewWithActivity,
    loadFileTree,
    notifyActivity,
    onTurnEnd: handleTurnEnd,
    integrationsHint: integrationsStatus,
    openIntegrationModal: (integration) => {
      openSettingsModal('integrations', integration);
    },
    projectType: project?.projectType as 'base' | 'dev',
  });

  const initialSendLoggedRef = useRef(false);
  const queryAppliedRef = useRef(false);

  const {
    isReady: initializationReady,
    isResuming,
    resumeError,
  } = useBuildInitialization({
    projectId,
    resetLifecycle,
    resetChatState,
    resetFileTree,
    resetFileEditor,
    setFileError,
    setHasDevServer,
    setCurrentDeploymentSubdomain,
    setSubdomainName,
    setIsPublishPanelOpen,
    hasRequestedFileTreeRef,
    resetTurn,
    refreshProject,
    resumeSandboxAndWait,
    loadChatHistory,
    hydrateSessions,
    setSelectedCli,
    setSelectedModel,
    setSelectedEffort,
  });

  const handleSendMessageWhenReady = useCallback(async () => {
    if (!initializationReady) {
      clientLogger.warn('Ignoring chat submission because initialization has not completed yet.');
      return;
    }
    await handleSendMessage();
  }, [handleSendMessage, initializationReady]);

  const handleFixAllErrors = useCallback(() => {
    if (iframeErrors.length === 0) return;
    if (shouldSendErrorFix) {
      clientLogger.debug('[BuildPage] Ignoring duplicate fix request while one is in flight.');
      return;
    }
    if (!initializationReady) {
      clientLogger.warn('[BuildPage] Skipping error fix because initialization is not ready yet.');
      return;
    }

    // Generate AI prompt for all errors
    let prompt = `I'm getting ${iframeErrors.length === 1 ? 'an error' : `${iframeErrors.length} errors`} in my preview:\n\n`;

    iframeErrors.forEach((error, index) => {
      if (iframeErrors.length > 1) {
        prompt += `${index + 1}. `;
      }

      if (error.type === 'vite' && error.raw) {
        // Clean up Vite error
        const lines = error.raw.split('\n');
        const cleanLines: string[] = [];
        let foundCodeSnippet = false;

        for (const line of lines) {
          if (line.trim().startsWith('at ') ||
              line.includes('node_modules') ||
              line.includes('node:internal')) {
            break;
          }

          if (/^\s*\d+\s*\|/.test(line)) {
            foundCodeSnippet = true;
          }

          if (foundCodeSnippet && line.trim() === '') {
            const nextIdx = lines.indexOf(line) + 1;
            if (nextIdx < lines.length && lines[nextIdx].trim() === '') {
              break;
            }
          }

          cleanLines.push(line);
        }

        const cleanError = cleanLines.join('\n').trim();
        prompt += `Build Error:\n${cleanError}`;
      } else if (error.type === 'runtime') {
        prompt += `Runtime Error: ${error.message}`;
        if (error.filename) {
          prompt += `\nFile: ${error.filename}:${error.lineno}`;
        }
      } else if (error.type === 'promise') {
        prompt += `Promise Rejection: ${error.message}`;
      }

      if (index < iframeErrors.length - 1) {
        prompt += '\n\n';
      }
    });

    prompt += '\n\nPlease help me fix these errors.';

    // Close modal if open
    setShowErrorDetail(false);

    // Mark fixing state so the summary stays hidden until the iframe rebuilds
    setShouldSendErrorFix(true);
    void handleSendMessage(prompt).catch((error) => {
      clientLogger.error('[BuildPage] Failed to send auto error fix prompt:', error);
      setShouldSendErrorFix(false);
    });
  }, [iframeErrors, shouldSendErrorFix, initializationReady, handleSendMessage]);

  useEffect(() => {
    const mappedProvider: Provider =
      selectedCli === 'claude'
        ? 'claude'
        : selectedCli === 'gemini'
          ? 'gemini'
          : 'codex';
    setProvider(mappedProvider);
  }, [selectedCli, setProvider]);

  useEffect(() => {
    if (queryAppliedRef.current) {
      return;
    }

    if (!modelParam && !effortParam) {
      return;
    }

    queryAppliedRef.current = true;

    // Note: CLI is fixed per project and cannot be changed via URL parameter
    // Only model and effort can be changed

    if (modelParam) {
      setSelectedModel(modelParam);
    }

    if (effortParam === 'low' || effortParam === 'medium' || effortParam === 'high') {
      setSelectedEffort(effortParam);
    }
  }, [modelParam, effortParam, setSelectedModel, setSelectedEffort]);

  useEffect(() => {
    if (!projectId || !initializationReady) {
      return;
    }
    if (previewReady || projectStatus === 'failed') {
      return;
    }

    const interval = setInterval(() => {
      void refreshProjectAndTrack();
    }, 5000);

    return () => clearInterval(interval);
  }, [
    projectId,
    initializationReady,
    previewReady,
    projectStatus,
    refreshProjectAndTrack,
  ]);

  // Send initial message with project images once everything is ready
  useEffect(() => {
    if (!initializationReady) {
      return;
    }
    const historyReady = historyLoadedRef.current;
    const promptPending = initialPromptRef.current;

    if (
      historyReady &&
      promptPending &&
      messages.length === 0 &&
      !isLoading &&
      project
    ) {
      clientLogger.debug('[BuildPage] ✅ Conditions met - sending initial message');
      initialSendLoggedRef.current = false;
      const prompt = promptPending;
      initialPromptRef.current = null;
      void sendInitialMessage(prompt, project.images);
      return;
    }

    if (promptPending) {
      if (!initialSendLoggedRef.current) {
        clientLogger.debug('[BuildPage] ❌ Conditions not met - skipping sendInitialMessage');
        initialSendLoggedRef.current = true;
      }
    } else {
      initialSendLoggedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializationReady, messages.length, isLoading, project]);

  // Auto-resume preview when sandbox is paused/archived but we still have a last preview URL.
  useEffect(() => {
    if (
      previewUrl &&
      !isPreviewRunning &&
      (projectStatus === 'stopped' || projectStatus === 'archived')
    ) {
      // Keep cached view visible via overlay; kick off background resume
      triggerPreviewWithActivity();
    }
  }, [previewUrl, isPreviewRunning, projectStatus, triggerPreviewWithActivity]);

  const projectHandlersRef = useLatest({
    onChatEvent: (event: any, options: any) => {
      applyChatEvent(event, options);
      processEvent(event);
    },
    onSessionStatus: handleSessionStatus,
    onProvisioningUpdate: (update: ProvisioningUpdatePayload) => {
      // Provisioning updates handled silently
      void update;
    },
    onProjectStatus: handleProjectStatusUpdate,
    onFreestyleMessage: handleFreestyleMessage,
    onReconnect: handleReconnect,
    onResumeComplete: (data: { sessionId: string; count: number; message: string }) => {
      clientLogger.info(
        `Resume complete for session ${data.sessionId}: ${data.count} events received`,
      );
    },
    onResumeError: (data: { message: string }) => {
      console.error(`Resume error: ${data.message}`);
    },
  });

  const handleOpenCustomDomain = useCallback(() => {
    setIsPublishPanelOpen(false);
    openSettingsModal('custom');
  }, [openSettingsModal, setIsPublishPanelOpen]);

  useEffect(() => {
    if (!projectId || !initializationReady) {
      return;
    }

    const unsubscribe = chatService.subscribeToProject(projectId, {
      onChatEvent: (payload) => {
        clientLogger.info(`[BuildPage] onChatEvent received: ${payload.event}, sessionId: ${payload.sessionId}`);
        const handler = projectHandlersRef.current.onChatEvent;
        if (!handler) {
          clientLogger.warn('[BuildPage] No onChatEvent handler in ref');
          return;
        }
        const normalizedPayload =
          typeof payload.payload === 'string'
            ? safelyParseJson(payload.payload)
            : payload.payload;
        handler(
          {
            sessionId: payload.sessionId,
            sequence: payload.sequence,
            event: payload.event,
            payload: normalizedPayload,
            createdAt: payload.createdAt,
          },
          { replay: false },
        );
      },
      onSessionStatus: (status) => {
        projectHandlersRef.current.onSessionStatus?.(status);
      },
      onProvisioningUpdate: (update) => {
        projectHandlersRef.current.onProvisioningUpdate?.(update);
      },
      onProjectStatus: (status) => {
        projectHandlersRef.current.onProjectStatus?.(status);
      },
      onFreestyleMessage: (message) => {
        // Intercept turn_diff to append a system card immediately
        if (message?.type === 'turn_diff' && message?.data?.turnDiff) {
          const diff = message.data.turnDiff;
          const id = message.data?.messageId || `turn-diff-${Date.now()}`;
          setMessages((prev) => [
            ...prev,
            {
              id,
              role: 'assistant',
              content: '',
              timestamp: new Date(),
              variant: 'system',
              title: message.message || 'Git Changes',
              metadata: { systemType: 'turn_diff', turnDiff: diff },
              sessionId: diff.sessionId ?? undefined,
              chatRoomId: diff.chatRoomId ?? undefined,
            },
          ]);
          return;
        }

        // Intercept restore to append a system card immediately
        if (message?.type === 'restore' && message?.data) {
          const id = message.data?.messageId || `restore-${Date.now()}`;
          setMessages((prev) => [
            ...prev,
            {
              id,
              role: 'assistant',
              content: message.message || '',
              timestamp: new Date(),
              variant: 'system',
              title: 'Restore',
              metadata: {
                systemType: 'restore',
                commitHash: message.data.commitHash,
                commitMessage: message.data.commitMessage,
              },
              sessionId: message.data.sessionId ?? undefined,
              chatRoomId: message.data.chatRoomId ?? undefined,
            },
          ]);
          return;
        }

        projectHandlersRef.current.onFreestyleMessage?.(message);
      },
      onReconnect: () => {
        projectHandlersRef.current.onReconnect?.();
      },
      onResumeComplete: (data) => {
        projectHandlersRef.current.onResumeComplete?.(data);
      },
      onResumeError: (data) => {
        projectHandlersRef.current.onResumeError?.(data);
      },
      onServerRestart: (data) => {
        clientLogger.info(`[BuildPage] Server restart event: ${data.status} - ${data.message}`);
        setServerRestartStatus({
          status: data.status,
          message: data.message,
        });

        // Auto-refresh iframe when restart completes
        if (data.status === 'completed') {
          setTimeout(() => {
            // Force iframe reload
            const iframe = document.querySelector('iframe');
            if (iframe && iframe.src) {
              const currentSrc = iframe.src;
              iframe.src = '';
              setTimeout(() => {
                iframe.src = currentSrc;
              }, 100);
            }
            // Clear status after 2 seconds
            setTimeout(() => {
              setServerRestartStatus({ status: null, message: '' });
            }, 2000);
          }, 500);
        } else if (data.status === 'failed') {
          // Clear failed status after 5 seconds
          setTimeout(() => {
            setServerRestartStatus({ status: null, message: '' });
          }, 5000);
        }
      },
    });

    return () => {
      unsubscribe();
    };
  }, [projectId, projectHandlersRef, initializationReady]);

  useEffect(() => {
    if (!selectedFile) {
      return;
    }

    void loadFileContent(selectedFile);
  }, [selectedFile, loadFileContent]);

  useEffect(() => {
    // 프로젝트가 존재하고 샌드박스 ID가 있으면 파일 트리 로드 (devServer 실행 여부 무관)
    const canLoadFiles = project?.sandboxId && initializationReady;

    if (!canLoadFiles || hasRequestedFileTreeRef.current) {
      return;
    }

    hasRequestedFileTreeRef.current = true;
    void loadFileTree();
  }, [project?.sandboxId, initializationReady, loadFileTree]);

  // Fetch app routes when preview becomes running for the first time
  useEffect(() => {
    if (isPreviewRunning && !hasRequestedAppRoutesRef.current) {
      hasRequestedAppRoutesRef.current = true;
      void refreshAppRoutes();
    }

    // Reset flag when preview stops
    if (!isPreviewRunning) {
      hasRequestedAppRoutesRef.current = false;
    }
  }, [isPreviewRunning, refreshAppRoutes]);

  const findFirstFile = useCallback((nodes: FileNode[]): FileNode | null => {
    for (const node of nodes) {
      if (node.type === 'file') {
        return node;
      }
      if (node.children && node.children.length > 0) {
        const childResult = findFirstFile(node.children);
        if (childResult) {
          return childResult;
        }
      }
    }
    return null;
  }, []);

  const findFileByPartialPath = useCallback((nodes: FileNode[], partialPath: string): FileNode | null => {
    const normalizedPartial = partialPath.toLowerCase();

    // First try exact match (case insensitive)
    for (const node of nodes) {
      if (node.type === 'file' && node.path.toLowerCase() === normalizedPartial) {
        return node;
      }
      if (node.children && node.children.length > 0) {
        const found = findFileByPartialPath(node.children, partialPath);
        if (found) {
          return found;
        }
      }
    }

    // Then try matching by path ending (case insensitive)
    for (const node of nodes) {
      if (node.type === 'file') {
        const normalizedPath = node.path.toLowerCase();
        // Match if the node path ends with the partial path
        if (normalizedPath.endsWith(normalizedPartial) || normalizedPath.endsWith(`/${normalizedPartial}`)) {
          return node;
        }
        // Match if just the filename matches
        const fileName = node.path.split('/').pop();
        if (fileName?.toLowerCase() === normalizedPartial) {
          return node;
        }
      }
      if (node.children && node.children.length > 0) {
        const found = findFileByPartialPath(node.children, partialPath);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }, []);


  const codePanelProps = useMemo(
    () => ({
      projectId,
      projectName,
      fileTree,
      expandedFolders,
      selectedFile,
      openFiles,
      onToggleFolder: toggleFolder,
      onSelectFile: (path: string) => {
        if (path !== selectedFile) {
          selectFile(path);
        }
      },
      onSelectTab: selectFile,
      onCloseTab: (path: string) => {
        closeFile(path);
        evictFile(path);
      },
      dirtyFiles,
      content: fileContent,
      isLoading: isFileLoading,
      isSaving: isSavingFile,
      dirty: isFileDirty,
      lastSavedAt,
      error: fileError,
      onContentChange: updateFileContent,
      onConfirm: () => {
        void saveFileContent(selectedFile ?? undefined);
      },
      highlightRequest,
      projectType: project?.projectType,
      devServerUrl: project?.devServerUrl ?? null,
      turnDiff,
      onCloseTurnDiff: () => {
        setTurnDiff(null);
        setRestoreState({});
        setRestoreOriginalHash(null);
        
      },
      onTempRestore: async () => {
        if (!projectId || !turnDiff) return;
        setRestoreState(prev => ({ ...prev, [turnDiff.commitHash]: 'loading' }));
        try {
          const commits = await apiClient.getGitCommits(projectId, 1);
          const head = commits?.data?.[0]?.hash || null;
          setRestoreOriginalHash(head);

          // Restore directly to the commit shown on the turn_diff card
          await apiClient.restoreTemp(projectId, turnDiff.commitHash, true);
          try { await loadFileTree(); } catch {}
          forcePreviewRefresh();
          setRestoreState(prev => ({ ...prev, [turnDiff.commitHash]: 'confirming' }));
        } catch (err) {
          console.error('Temp restore failed:', err);
          setRestoreState(prev => ({ ...prev, [turnDiff.commitHash]: 'idle' }));
        }
      },
      onConfirmRestore: async () => {
        if (!projectId || !turnDiff) return;
        setRestoreState(prev => ({ ...prev, [turnDiff.commitHash]: 'loading' }));
        try {
          const activeSession = sessions.find(s => s.chatRoomId === activeChatRoomId);
          await apiClient.restoreConfirm(projectId, {
            // Confirm restore to the commit shown on the card
            commitHash: turnDiff.commitHash,
            sessionId: activeSession?.sessionId ?? null,
            chatRoomId: activeChatRoomId ?? null,
            
          });
          try { await loadFileTree(); } catch {}
          forcePreviewRefresh();
          setTurnDiff(null);
          setRestoreState(prev => {
            const newState = { ...prev };
            delete newState[turnDiff.commitHash];
            return newState;
          });
          setRestoreOriginalHash(null);
          
        } catch (err) {
          console.error('Confirm restore failed:', err);
          setRestoreState(prev => ({ ...prev, [turnDiff.commitHash]: 'confirming' }));
        }
      },
      onCancelRestore: async () => {
        if (!projectId || !turnDiff) return;
        setRestoreState(prev => ({ ...prev, [turnDiff.commitHash]: 'loading' }));
        try {
          // Preferred: server-side cancel using pending baseline
          try {
            await apiClient.restoreCancel(projectId);
          } catch (_e) {
            // Fallback: revert to latest HEAD (legacy behavior)
            const commits = await apiClient.getGitCommits(projectId, 1);
            const latestHead = commits?.data?.[0]?.hash || restoreOriginalHash;
            if (latestHead) {
              await apiClient.restoreTemp(projectId, latestHead, true);
            }
          }
          try { await loadFileTree(); } catch {}
          try { triggerPreviewWithActivity(); } catch {}

          setRestoreState(prev => {
            const newState = { ...prev };
            delete newState[turnDiff.commitHash];
            return newState;
          });
          setRestoreOriginalHash(null);
          
        } catch (err) {
          console.error('Cancel restore failed:', err);
          setRestoreState(prev => ({ ...prev, [turnDiff.commitHash]: 'confirming' }));
        }
      },
      restoreState: turnDiff ? { [turnDiff.commitHash]: restoreState[turnDiff.commitHash] || 'idle' } : {},
    }),
    [
      projectId,
      projectName,
      fileTree,
      expandedFolders,
      selectedFile,
      openFiles,
      toggleFolder,
      selectFile,
      closeFile,
      evictFile,
      dirtyFiles,
      fileContent,
      isFileLoading,
      isSavingFile,
      isFileDirty,
      lastSavedAt,
      fileError,
      updateFileContent,
      saveFileContent,
      highlightRequest,
      project?.projectType,
      project?.devServerUrl,
      turnDiff,
      restoreState,
      restoreOriginalHash,
      sessions,
      activeChatRoomId,
      loadFileTree,
      triggerPreviewWithActivity,
      forcePreviewRefresh,
    ],
  );

  useEffect(() => {
    return () => {
      chatService.disconnect();
    };
  }, []);

  // Fetch integrations status on initialization
  useEffect(() => {
    if (!projectId || !initializationReady) {
      return;
    }

    const fetchIntegrationsStatus = async () => {
      try {
        const status = await apiClient.getIntegrationsStatus(projectId);
        clientLogger.info('[BuildPage] Fetched integrations status:', status);
        setIntegrationsStatus(status);
      } catch (error) {
        clientLogger.warn('[BuildPage] Failed to fetch integrations status:', error);
        // Keep default false values
      }
    };

    void fetchIntegrationsStatus();
  }, [projectId, initializationReady]);

  // Apply theme on mount
  useEffect(() => {
    try {
      const theme = localStorage.getItem('clink-theme') || 'dark';
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {
      // Ignore errors
    }
  }, []);

  if (accessDenied) {
    return null;
  }

  return (
    <BuildThemeProvider>
      <div className="relative h-screen w-full bg-white dark:bg-primary">
        <div className="h-full flex">
          <ChatSidebar
            projectName={projectName}
            projectId={projectId}
            projectStatus={projectStatus}
            messages={messages}
            allMessages={allMessages}
            canEdit={canEdit}
            roomsReady={roomsReady}
            isLoading={isLoading}
            isInitialPromptRunning={isInitialPromptRunning}
            input={input}
            onInputChange={(value) => setInput(value)}
            onSubmit={handleSendMessageWhenReady}
            uploadedImages={uploadedImages}
            onImageUpload={handleImageUpload}
            onRemoveImage={removeImage}
            selectedCli={selectedCli}
            onAssistantTabSelect={handleAssistantTabSelect}
            selectedModel={selectedModel}
            onModelChange={(value) => setSelectedModel(value)}
            selectedEffort={selectedEffort}
            onEffortChange={(value) => setSelectedEffort(value)}
            onNavigateHome={() => router.push('/')}
            sessions={sessions}
        activeChatRoomId={activeChatRoomId}
            onSessionSwitch={(sessionId) => void handleSessionSwitch(sessionId)}
            onNewSession={handleNewSession}
            onRenameSession={(sessionId, name) => handleRenameSession(sessionId, name)}
            onCloseSession={(sessionId) => handleCloseSession(sessionId)}
            onCancel={cancelActiveSession}
            onResumeEditing={resumeEditing}
            streamingState={streamingState}
            previewReady={previewReady}
            isResuming={isResuming}
            resumeError={resumeError}
            onFileClick={async (filePath, lineNumber) => {
              setActiveView('code');

              // Ensure file tree is loaded before selecting file
              let currentTree = fileTree;
              if (fileTree.length === 0) {
                // Load the file tree and get the fresh data
                currentTree = await loadFileTree();
              }

              // Try to find the file in the tree (handles both full and partial paths)
              const foundFile = findFileByPartialPath(currentTree, filePath);
              const targetPath = foundFile ? foundFile.path : filePath;

              // Check if file is already selected
              const isAlreadyOpen = selectedFile === targetPath;

              if (foundFile) {
                expandToFile(foundFile.path);
                selectFile(foundFile.path);
              } else {
                expandToFile(filePath);
                selectFile(filePath);
              }

              // Set highlight request after a delay to ensure file is loaded
              if (lineNumber) {
                // If file is already open, highlight sooner; otherwise wait for load
                const delay = isAlreadyOpen ? 150 : 800;
                setTimeout(() => {
                  setHighlightRequest({ line: lineNumber, timestamp: Date.now() });
                }, delay);
              }
            }}
            onOpenIntegration={(integration) => {
              openSettingsModal('integrations', integration);
            }}
            projectType={project?.projectType}
            importedRepoUrl={project?.importedRepoUrl}
            onOpenDiff={(diff) => {
              setActiveView('code');
              setTurnDiff(diff);
              setRestoreState({});
              setRestoreOriginalHash(null);
              
            }}
            onRestoreDiff={async (diff) => {
              // Reset all other diffs to idle when starting a new restore
              setRestoreState({ [diff.commitHash]: 'loading' });
              try {
                const commits = await apiClient.getGitCommits(projectId, 1);
                const head = commits?.data?.[0]?.hash || null;
                setRestoreOriginalHash(head);

                // Restore directly to the commit shown on the card
                await apiClient.restoreTemp(projectId, diff.commitHash, true);
                try { await loadFileTree(); } catch {}
                forcePreviewRefresh();
                setRestoreState({ [diff.commitHash]: 'confirming' });
              } catch (err) {
                console.error('Temp restore failed:', err);
                setRestoreState({ [diff.commitHash]: 'idle' });
              }
            }}
            onConfirmRestore={async (diff) => {
              setRestoreState(prev => ({ ...prev, [diff.commitHash]: 'loading' }));
              try {
                const activeSession = sessions.find(s => s.chatRoomId === activeChatRoomId);
                await apiClient.restoreConfirm(projectId, {
                  // Confirm restore to the commit shown on the card
                  commitHash: diff.commitHash,
                  sessionId: activeSession?.sessionId ?? null,
                  chatRoomId: activeChatRoomId ?? null,
                  
                });
                try { await loadFileTree(); } catch {}
                forcePreviewRefresh();
                setTurnDiff(null);
                setRestoreState(prev => {
                  const newState = { ...prev };
                  delete newState[diff.commitHash];
                  return newState;
                });
                setRestoreOriginalHash(null);
                
              } catch (err) {
                console.error('Confirm restore failed:', err);
                setRestoreState(prev => ({ ...prev, [diff.commitHash]: 'confirming' }));
              }
            }}
            onCancelRestore={async (diff) => {
              setRestoreState(prev => ({ ...prev, [diff.commitHash]: 'loading' }));
              try {
                // Preferred: server-side cancel using pending baseline
                try {
                  await apiClient.restoreCancel(projectId);
                } catch (_e) {
                  // Fallback: revert to latest HEAD (legacy behavior)
                  const commits = await apiClient.getGitCommits(projectId, 1);
                  const latestHead = commits?.data?.[0]?.hash || restoreOriginalHash;
                  if (latestHead) {
                    await apiClient.restoreTemp(projectId, latestHead, true);
                  }
                }
                try { await loadFileTree(); } catch {}
                try { triggerPreviewWithActivity(); } catch {}

                setRestoreState(prev => {
                  const newState = { ...prev };
                  delete newState[diff.commitHash];
                  return newState;
                });
                setRestoreOriginalHash(null);
                
              } catch (err) {
                console.error('Cancel restore failed:', err);
                setRestoreState(prev => ({ ...prev, [diff.commitHash]: 'confirming' }));
              }
            }}
            restoreState={restoreState}
            iframeErrors={iframeErrors}
            hideErrorsUntil={hideErrorsUntil}
            onOpenErrorDetail={handleOpenErrorDetail}
            onFixError={handleFixAllErrors}
            isFixingErrors={shouldSendErrorFix}
          />
          <PreviewPanel
            previewUrl={previewUrl}
            projectType={project?.projectType as 'base' | 'dev'}
            productionUrl={project?.productionUrl}
            railwayProjectId={(project as any)?.railwayProjectId}
            railwayServiceId={(project as any)?.railwayServiceId}
            expectedDomain={(project as any)?.expectedDomain}
            railwayDeploymentStatus={railwayDeploymentStatus}
            railwayMessage={railwayMessage}
            railwayUrl={railwayUrl}
            railwayErrorLogs={railwayErrorLogs}
            onCheckRailwayStatus={checkRailwayDeploymentStatus}
            previewNonce={previewNonce}
            isPreviewLoading={isPreviewLoading}
            isPreviewRunning={isPreviewRunning}
            projectStatus={projectStatus}
            onStartPreview={() => {
              notifyActivity('preview:start');
              void startPreview();
            }}
            onStopPreview={() => {
              notifyActivity('preview:stop', { autoStart: false });
              void stopPreview();
            }}
            onPublishButtonClick={handlePublishButtonClick}
            onPublishPanelClose={handlePublishPanelClose}
            isPublishPanelOpen={isPublishPanelOpen}
            publishState={publishState}
            userPlan={userPlan}
            publishDomain={publishDomain}
            subdomainName={subdomainName}
            currentSubdomain={currentDeploymentSubdomain}
            onSubdomainChange={handleSubdomainChange}
            onUpdatePublish={handleUpdatePublish}
            onUnpublish={handleUnpublish}
            canUpdate={publishState === 'idle' || publishState === 'live'}
            canUnpublish={publishState === 'live'}
            publishError={deploymentError}
            onOpenGithub={handleOpenGithubSettings}
            onOpenSupabase={handleOpenSupabaseSettings}
            onOpenSettings={handleOpenProjectSettings}
            onOpenCustomDomain={handleOpenCustomDomain}
            onOpenAnalytics={() => setActiveView('analytics')}
            activeView={activeView}
            onViewChange={(view) => setActiveView(view)}
            codePanelProps={codePanelProps}
            streamingState={streamingState}
            sandboxId={activitySandboxId}
            projectId={projectId}
            domainSuffix={(project as any)?.deploymentDomainSuffix || 'freerider.dev'}
            appRoutes={appRoutes}
            supabaseConnected={integrationsStatus.supabaseConnected}
            supabaseProjectRef={(project as any)?.supabaseProjectMapping?.supabaseProjectId ?? null}
            serverRestartStatus={serverRestartStatus}
            onSendPromptToAgent={(prompt: string) => {
              // Use processMessage to directly send the message without relying on input state
              void processMessage(prompt);
            }}
            onRailwayUnpublishSuccess={refreshProjectAndTrack}
            onRailwayDeploySuccess={refreshProjectAndTrack}
            onIFrameError={handleIFrameError}
            onIFrameConsole={handleIFrameConsole}
            onIFrameSuccess={handleIFrameSuccess}
            iframeErrors={iframeErrors}
            onOpenErrorDetail={handleOpenErrorDetail}
            onFixError={handleFixAllErrors}
          />
      </div>
      <ErrorDetailModal
        errors={showErrorDetail ? iframeErrors : []}
        onClose={() => setShowErrorDetail(false)}
      />
      <ProjectSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={handleSettingsClose}
        projectId={projectId}
        projectName={projectName}
        projectCreatedAt={project?.createdAt ?? null}
        onProjectUpdate={() => {
          void refreshProjectAndTrack();
        }}
        initialTab={settingsInitialTab}
        initialIntegration={settingsInitialIntegration}
        userPlan={userPlan}
        projectType={project?.projectType as 'base' | 'dev'}
      />
      </div>
    </BuildThemeProvider>
  );
}
