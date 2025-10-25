"use client";
import { useEffect, useState, useRef, useCallback, useMemo, type ChangeEvent, type KeyboardEvent, type UIEvent } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MotionDiv, MotionH3, MotionP, MotionButton } from '@/lib/motion';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { FaCode, FaDesktop, FaMobileAlt, FaPlay, FaStop, FaSync, FaCog, FaRocket, FaFolder, FaFolderOpen, FaFile, FaFileCode, FaCss3Alt, FaHtml5, FaJs, FaReact, FaPython, FaDocker, FaGitAlt, FaMarkdown, FaDatabase, FaPhp, FaJava, FaRust, FaVuejs, FaLock, FaHome, FaChevronUp, FaChevronRight, FaChevronDown, FaArrowLeft, FaArrowRight, FaRedo } from 'react-icons/fa';
import { SiTypescript, SiGo, SiRuby, SiSvelte, SiJson, SiYaml, SiCplusplus } from 'react-icons/si';
import { VscJson } from 'react-icons/vsc';
import ChatLog from '@/components/chat/ChatLog';
import { ProjectSettings } from '@/components/settings/ProjectSettings';
import ChatInput from '@/components/chat/ChatInput';
import { ChatErrorBoundary } from '@/components/ErrorBoundary';
import { useUserRequests } from '@/hooks/useUserRequests';
import { useGlobalSettings } from '@/contexts/GlobalSettingsContext';
import { getDefaultModelForCli, getModelDisplayName } from '@/lib/constants/cliModels';
import {
  ACTIVE_CLI_BRAND_COLORS,
  ACTIVE_CLI_IDS,
  ACTIVE_CLI_MODEL_OPTIONS,
  ACTIVE_CLI_NAME_MAP,
  DEFAULT_ACTIVE_CLI,
  buildActiveModelOptions,
  normalizeModelForCli,
  sanitizeActiveCli,
  type ActiveCliId,
  type ActiveModelOption,
} from '@/lib/utils/cliOptions';

// No longer loading ProjectSettings (managed by global settings on main page)

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

const assistantBrandColors = ACTIVE_CLI_BRAND_COLORS;

const CLI_LABELS = ACTIVE_CLI_NAME_MAP;

const CLI_ORDER = ACTIVE_CLI_IDS;

const sanitizeCli = (cli?: string | null) => sanitizeActiveCli(cli, DEFAULT_ACTIVE_CLI);

const sanitizeModel = (cli: string, model?: string | null) => normalizeModelForCli(cli, model, DEFAULT_ACTIVE_CLI);

// Function to convert hex to CSS filter for tinting white images
// Since the original image is white (#FFFFFF), we can apply filters more accurately
const hexToFilter = (hex: string): string => {
  // For white source images, we need to invert and adjust
  const filters: { [key: string]: string } = {
    '#DE7356': 'brightness(0) saturate(100%) invert(52%) sepia(73%) saturate(562%) hue-rotate(336deg) brightness(95%) contrast(91%)',
    '#000000': 'brightness(0) saturate(100%)',
    '#11A97D': 'brightness(0) saturate(100%) invert(57%) sepia(30%) saturate(747%) hue-rotate(109deg) brightness(90%) contrast(92%)',
    '#1677FF': 'brightness(0) saturate(100%) invert(40%) sepia(86%) saturate(1806%) hue-rotate(201deg) brightness(98%) contrast(98%)',
  };
  return filters[hex] || filters['#DE7356'];
};

type Entry = { path: string; type: 'file'|'dir'; size?: number };
type ProjectStatus = 'initializing' | 'active' | 'failed';

type CliStatusSnapshot = {
  available?: boolean;
  configured?: boolean;
  models?: string[];
};

type ModelOption = Omit<ActiveModelOption, 'cli'> & { cli: string };

const buildModelOptions = (statuses: Record<string, CliStatusSnapshot>): ModelOption[] =>
  buildActiveModelOptions(statuses).map(option => ({
    ...option,
    cli: option.cli,
  }));

// TreeView component for VSCode-style file explorer
interface TreeViewProps {
  entries: Entry[];
  selectedFile: string;
  expandedFolders: Set<string>;
  folderContents: Map<string, Entry[]>;
  onToggleFolder: (path: string) => void;
  onSelectFile: (path: string) => void;
  onLoadFolder: (path: string) => Promise<void>;
  level: number;
  parentPath?: string;
  getFileIcon: (entry: Entry) => React.ReactElement;
}

function TreeView({ entries, selectedFile, expandedFolders, folderContents, onToggleFolder, onSelectFile, onLoadFolder, level, parentPath = '', getFileIcon }: TreeViewProps) {
  // Ensure entries is an array
  if (!entries || !Array.isArray(entries)) {
    return null;
  }
  
  // Group entries by directory
  const sortedEntries = [...entries].sort((a, b) => {
    // Directories first
    if (a.type === 'dir' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'dir') return 1;
    // Then alphabetical
    return a.path.localeCompare(b.path);
  });

  return (
    <>
      {sortedEntries.map((entry, index) => {
        // entry.path should already be the full path from API
        const fullPath = entry.path;
        let entryKey =
          fullPath && typeof fullPath === 'string' && fullPath.trim().length > 0
            ? fullPath.trim()
            : (entry as any)?.name && typeof (entry as any).name === 'string' && (entry as any).name.trim().length > 0
            ? `${parentPath || 'root'}::__named_${(entry as any).name.trim()}`
            : '';
        if (!entryKey || entryKey.trim().length === 0) {
          entryKey = `${parentPath || 'root'}::__entry_${level}_${index}_${entry.type}`;
        }
        const isExpanded = expandedFolders.has(fullPath);
        const indent = level * 8;
        
        return (
          <div key={entryKey}>
            <div
              className={`group flex items-center h-[22px] px-2 cursor-pointer ${
                selectedFile === fullPath 
                  ? 'bg-blue-100 ' 
                  : 'hover:bg-gray-100 '
              }`}
              style={{ paddingLeft: `${8 + indent}px` }}
              onClick={async () => {
                if (entry.type === 'dir') {
                  // Load folder contents if not already loaded
                  if (!folderContents.has(fullPath)) {
                    await onLoadFolder(fullPath);
                  }
                  onToggleFolder(fullPath);
                } else {
                  onSelectFile(fullPath);
                }
              }}
            >
              {/* Chevron for folders */}
              <div className="w-4 flex items-center justify-center mr-0.5">
                {entry.type === 'dir' && (
                  isExpanded ? 
                    <span className="w-2.5 h-2.5 text-gray-600 flex items-center justify-center"><FaChevronDown size={10} /></span> : 
                    <span className="w-2.5 h-2.5 text-gray-600 flex items-center justify-center"><FaChevronRight size={10} /></span>
                )}
              </div>
              
              {/* Icon */}
              <span className="w-4 h-4 flex items-center justify-center mr-1.5">
                {entry.type === 'dir' ? (
                  isExpanded ? 
                    <span className="text-amber-600 w-4 h-4 flex items-center justify-center"><FaFolderOpen size={16} /></span> : 
                    <span className="text-amber-600 w-4 h-4 flex items-center justify-center"><FaFolder size={16} /></span>
                ) : (
                  getFileIcon(entry)
                )}
              </span>
              
              {/* File/Folder name */}
              <span className={`text-[13px] leading-[22px] ${
                selectedFile === fullPath ? 'text-blue-700 ' : 'text-gray-700 '
              }`} style={{ fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
                {level === 0 ? (entry.path.split('/').pop() || entry.path) : (entry.path.split('/').pop() || entry.path)}
              </span>
            </div>
            
            {/* Render children if expanded */}
            {entry.type === 'dir' && isExpanded && folderContents.has(fullPath) && (
              <TreeView
                entries={folderContents.get(fullPath) || []}
                selectedFile={selectedFile}
                expandedFolders={expandedFolders}
                folderContents={folderContents}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
                onLoadFolder={onLoadFolder}
                level={level + 1}
                parentPath={fullPath}
                getFileIcon={getFileIcon}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

export default function ChatPage() {
  const params = useParams<{ project_id: string }>();
  const projectId = params?.project_id ?? '';
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // NEW: UserRequests state management
  const {
    hasActiveRequests,
    createRequest,
    startRequest,
    completeRequest
  } = useUserRequests({ projectId });
  
  const [projectName, setProjectName] = useState<string>('');
  const [projectDescription, setProjectDescription] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [tree, setTree] = useState<Entry[]>([]);
  const [content, setContent] = useState<string>('');
  const [editedContent, setEditedContent] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>('.');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']));
  const [folderContents, setFolderContents] = useState<Map<string, Entry[]>>(new Map());
  const [prompt, setPrompt] = useState('');

  // Ref to store add/remove message handlers from ChatLog
  const messageHandlersRef = useRef<{
    add: (message: any) => void;
    remove: (messageId: string) => void;
  } | null>(null);

  // Ref to track pending requests for deduplication
  const pendingRequestsRef = useRef<Set<string>>(new Set());

  // Stable message handlers to prevent reassignment issues
  const stableMessageHandlers = useRef<{
    add: (message: any) => void;
    remove: (messageId: string) => void;
  } | null>(null);

  // Track active optimistic messages by requestId
  const optimisticMessagesRef = useRef<Map<string, any>>(new Map());
  const [mode, setMode] = useState<'act' | 'chat'>('act');
  const [isRunning, setIsRunning] = useState(false);
  const [isSseFallbackActive, setIsSseFallbackActive] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [deviceMode, setDeviceMode] = useState<'desktop'|'mobile'>('desktop');
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<{name: string; url: string; base64?: string; path?: string}[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  // Initialize states with default values, will be loaded from localStorage in useEffect
  const [hasInitialPrompt, setHasInitialPrompt] = useState<boolean>(false);
  const [agentWorkComplete, setAgentWorkComplete] = useState<boolean>(false);
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>('initializing');
  const [initializationMessage, setInitializationMessage] = useState('Starting project initialization...');
  const [initialPromptSent, setInitialPromptSent] = useState(false);
  const initialPromptSentRef = useRef(false);
  const [showPublishPanel, setShowPublishPanel] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const [vercelConnected, setVercelConnected] = useState<boolean | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<'idle' | 'deploying' | 'ready' | 'error'>('idle');
  const deployPollRef = useRef<NodeJS.Timeout | null>(null);
  const [isStartingPreview, setIsStartingPreview] = useState(false);
  const [previewInitializationMessage, setPreviewInitializationMessage] = useState('Starting development server...');
  const [cliStatuses, setCliStatuses] = useState<Record<string, CliStatusSnapshot>>({});
  const [conversationId, setConversationId] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return '';
  });
  const [preferredCli, setPreferredCli] = useState<ActiveCliId>(DEFAULT_ACTIVE_CLI);
  const [selectedModel, setSelectedModel] = useState<string>(getDefaultModelForCli(DEFAULT_ACTIVE_CLI));
  const [usingGlobalDefaults, setUsingGlobalDefaults] = useState<boolean>(true);
  const [thinkingMode, setThinkingMode] = useState<boolean>(false);
  const [isUpdatingModel, setIsUpdatingModel] = useState<boolean>(false);
  const [currentRoute, setCurrentRoute] = useState<string>('/');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const lineNumberRef = useRef<HTMLDivElement>(null);
  const editedContentRef = useRef<string>('');
  const [isFileUpdating, setIsFileUpdating] = useState(false);
  const activeBrandColor =
    assistantBrandColors[preferredCli] || assistantBrandColors[DEFAULT_ACTIVE_CLI];
  const modelOptions = useMemo(() => buildModelOptions(cliStatuses), [cliStatuses]);
  const cliOptions = useMemo(
    () => CLI_ORDER.map(cli => ({
      id: cli,
      name: CLI_LABELS[cli] || cli,
      available: Boolean(cliStatuses[cli]?.available && cliStatuses[cli]?.configured)
    })),
    [cliStatuses]
  );

  const updatePreferredCli = useCallback((cli: string) => {
    const sanitized = sanitizeCli(cli);
    setPreferredCli(sanitized);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('selectedAssistant', sanitized);
    }
  }, []);

  const updateSelectedModel = useCallback((model: string, cliOverride?: string) => {
    const effectiveCli = cliOverride ? sanitizeCli(cliOverride) : preferredCli;
    const sanitized = sanitizeModel(effectiveCli, model);
    setSelectedModel(sanitized);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('selectedModel', sanitized);
    }
  }, [preferredCli]);

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  const sendInitialPrompt = useCallback(async (initialPrompt: string) => {
    if (initialPromptSent) {
      return;
    }

    setAgentWorkComplete(false);
    localStorage.setItem(`project_${projectId}_taskComplete`, 'false');

    const requestId = crypto.randomUUID();

    try {
      setIsRunning(true);
      setInitialPromptSent(true);

      const requestBody = {
        instruction: initialPrompt,
        images: [],
        isInitialPrompt: true,
        cliPreference: preferredCli,
        conversationId: conversationId || undefined,
        requestId,
        selectedModel,
      };

      const r = await fetch(`${API_BASE}/api/chat/${projectId}/act`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!r.ok) {
        const errorText = await r.text();
        console.error('❌ API Error:', errorText);
        setInitialPromptSent(false);
        return;
      }

      const result = await r.json();
      const returnedConversationId =
        typeof result?.conversationId === 'string'
          ? result.conversationId
          : typeof result?.conversation_id === 'string'
          ? result.conversation_id
          : undefined;
      if (returnedConversationId) {
        setConversationId(returnedConversationId);
      }

      const resolvedRequestId =
        typeof result?.requestId === 'string'
          ? result.requestId
          : typeof result?.request_id === 'string'
          ? result.request_id
          : requestId;
      const userMessageId =
        typeof result?.userMessageId === 'string'
          ? result.userMessageId
          : typeof result?.user_message_id === 'string'
          ? result.user_message_id
          : '';

      createRequest(resolvedRequestId, userMessageId, initialPrompt, 'act');
      setPrompt('');

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('initial_prompt');
      window.history.replaceState({}, '', newUrl.toString());
    } catch (error) {
      console.error('Error sending initial prompt:', error);
      setInitialPromptSent(false);
    } finally {
      setIsRunning(false);
    }
  }, [initialPromptSent, preferredCli, conversationId, projectId, selectedModel, createRequest]);

  // Guarded trigger that can be called from multiple places safely
  const triggerInitialPromptIfNeeded = useCallback(() => {
    const initialPromptFromUrl = searchParams?.get('initial_prompt');
    if (!initialPromptFromUrl) return;
    if (initialPromptSentRef.current) return;
    // Synchronously guard to prevent double ACT calls
    initialPromptSentRef.current = true;
    setInitialPromptSent(true);
    
    // Store the selected model and assistant in sessionStorage when returning
    const cliFromUrl = searchParams?.get('cli');
    const modelFromUrl = searchParams?.get('model');
    if (cliFromUrl) {
      const sanitizedCli = sanitizeCli(cliFromUrl);
      sessionStorage.setItem('selectedAssistant', sanitizedCli);
      if (modelFromUrl) {
        sessionStorage.setItem('selectedModel', sanitizeModel(sanitizedCli, modelFromUrl));
      }
    } else if (modelFromUrl) {
      sessionStorage.setItem('selectedModel', sanitizeModel(preferredCli, modelFromUrl));
    }
    
    // Don't show the initial prompt in the input field
    // setPrompt(initialPromptFromUrl);
    setTimeout(() => {
      sendInitialPrompt(initialPromptFromUrl);
    }, 300);
  }, [searchParams, sendInitialPrompt, preferredCli]);

const loadCliStatuses = useCallback(() => {
  const snapshot: Record<string, CliStatusSnapshot> = {};
  ACTIVE_CLI_IDS.forEach(id => {
    const models = ACTIVE_CLI_MODEL_OPTIONS[id]?.map(model => model.id) ?? [];
    snapshot[id] = {
      available: true,
      configured: true,
      models,
    };
  });
  setCliStatuses(snapshot);
}, []);

const persistProjectPreferences = useCallback(
  async (changes: { preferredCli?: string; selectedModel?: string }) => {
    if (!projectId) return;
    const payload: Record<string, unknown> = {};
    if (changes.preferredCli) {
      const sanitizedPreferredCli = sanitizeCli(changes.preferredCli);
      payload.preferredCli = sanitizedPreferredCli;
      payload.preferred_cli = sanitizedPreferredCli;
    }
    if (changes.selectedModel) {
      const targetCli = sanitizeCli(changes.preferredCli ?? preferredCli);
      const normalized = sanitizeModel(targetCli, changes.selectedModel);
      payload.selectedModel = normalized;
      payload.selected_model = normalized;
    }
    if (Object.keys(payload).length === 0) return;

    const response = await fetch(`${API_BASE}/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to update project preferences');
    }

    const result = await response.json().catch(() => null);
    return result?.data ?? result;
  },
  [projectId, preferredCli]
);

  const handleModelChange = useCallback(
    async (option: ModelOption, opts?: { skipCliUpdate?: boolean; overrideCli?: string }) => {
      if (!projectId || !option) return;

      const { skipCliUpdate = false, overrideCli } = opts || {};
      const targetCli = sanitizeCli(overrideCli ?? option.cli);
      const sanitizedModelId = sanitizeModel(targetCli, option.id);

      const previousCli = preferredCli;
      const previousModel = selectedModel;

      if (targetCli === previousCli && sanitizedModelId === previousModel) {
        return;
      }

      setUsingGlobalDefaults(false);
      updatePreferredCli(targetCli);
      updateSelectedModel(option.id, targetCli);

      setIsUpdatingModel(true);

      try {
        const preferenceChanges: { preferredCli?: string; selectedModel?: string } = {
          selectedModel: sanitizedModelId,
        };
        if (!skipCliUpdate && targetCli !== previousCli) {
          preferenceChanges.preferredCli = targetCli;
        }

        await persistProjectPreferences(preferenceChanges);

        const cliLabel = CLI_LABELS[targetCli] || targetCli;
        const modelLabel = getModelDisplayName(targetCli, sanitizedModelId);
        try {
          await fetch(`${API_BASE}/api/chat/${projectId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `Switched to ${cliLabel} (${modelLabel})`,
              role: 'system',
              message_type: 'info',
              cli_source: targetCli,
              conversation_id: conversationId || undefined,
            }),
          });
        } catch (messageError) {
          console.warn('Failed to record model switch message:', messageError);
        }

        loadCliStatuses();
      } catch (error) {
        console.error('Failed to update model preference:', error);
        updatePreferredCli(previousCli);
        updateSelectedModel(previousModel, previousCli);
        alert('Failed to update model. Please try again.');
      } finally {
        setIsUpdatingModel(false);
      }
    },
    [projectId, preferredCli, selectedModel, conversationId, loadCliStatuses, persistProjectPreferences, updatePreferredCli, updateSelectedModel]
  );

  useEffect(() => {
    loadCliStatuses();
  }, [loadCliStatuses]);

  const handleCliChange = useCallback(
    async (cliId: string) => {
      if (!projectId) return;
      if (cliId === preferredCli) return;

      setUsingGlobalDefaults(false);

      const candidateModels = modelOptions.filter(option => option.cli === cliId);
      const fallbackOption =
        candidateModels.find(option => option.id === selectedModel && option.available) ||
        candidateModels.find(option => option.available) ||
        candidateModels[0];

      if (fallbackOption) {
        await handleModelChange(fallbackOption, { overrideCli: cliId });
        return;
      }

      const previousCli = preferredCli;
      const previousModel = selectedModel;
      setIsUpdatingModel(true);

      try {
        updatePreferredCli(cliId);
        const defaultModel = getDefaultModelForCli(cliId);
        updateSelectedModel(defaultModel, cliId);
        await persistProjectPreferences({ preferredCli: cliId, selectedModel: defaultModel });
        loadCliStatuses();
      } catch (error) {
        console.error('Failed to update CLI preference:', error);
        updatePreferredCli(previousCli);
        updateSelectedModel(previousModel, previousCli);
        alert('Failed to update CLI. Please try again.');
      } finally {
        setIsUpdatingModel(false);
      }
    },
    [projectId, preferredCli, selectedModel, modelOptions, handleModelChange, loadCliStatuses, persistProjectPreferences, updatePreferredCli, updateSelectedModel]
  );

  useEffect(() => {
    if (!modelOptions.length) return;
    const hasSelected = modelOptions.some(option => option.cli === preferredCli && option.id === selectedModel);
    if (!hasSelected) {
      const fallbackOption = modelOptions.find(option => option.cli === preferredCli && option.available)
        || modelOptions.find(option => option.cli === preferredCli)
        || modelOptions.find(option => option.available)
        || modelOptions[0];
      if (fallbackOption) {
        void handleModelChange(fallbackOption);
      }
    }
  }, [modelOptions, preferredCli, selectedModel, handleModelChange]);

  const loadDeployStatus = useCallback(async () => {
    try {
      // Use the same API as ServiceSettings to check actual project service connections
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/services`);
      if (response.status === 404) {
        setGithubConnected(false);
        setVercelConnected(false);
        setPublishedUrl(null);
        setDeploymentStatus('idle');
        return;
      }

      if (response.ok) {
        const connections = await response.json();
        const githubConnection = connections.find((conn: any) => conn.provider === 'github');
        const vercelConnection = connections.find((conn: any) => conn.provider === 'vercel');
        
        // Check actual project connections (not just token existence)
        setGithubConnected(!!githubConnection);
        setVercelConnected(!!vercelConnection);
        
        // Set published URL only if actually deployed
        if (vercelConnection && vercelConnection.service_data) {
          const sd = vercelConnection.service_data;
          // Only use actual deployment URLs, not predicted ones
          const rawUrl = sd.last_deployment_url || null;
          const url = rawUrl ? (String(rawUrl).startsWith('http') ? String(rawUrl) : `https://${rawUrl}`) : null;
          setPublishedUrl(url || null);
          if (url) {
            setDeploymentStatus('ready');
          } else {
            setDeploymentStatus('idle');
          }
        } else {
          setPublishedUrl(null);
          setDeploymentStatus('idle');
        }
      } else {
        setGithubConnected(false);
        setVercelConnected(false);
        setPublishedUrl(null);
        setDeploymentStatus('idle');
      }

    } catch (e) {
      console.warn('Failed to load deploy status', e);
      setGithubConnected(false);
      setVercelConnected(false);
      setPublishedUrl(null);
      setDeploymentStatus('idle');
    }
  }, [projectId]);

  const startDeploymentPolling = useCallback((depId: string) => {
    if (deployPollRef.current) clearInterval(deployPollRef.current);
    setDeploymentStatus('deploying');
    setDeploymentId(depId);
    
    console.log('🔍 Monitoring deployment:', depId);
    
    deployPollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/projects/${projectId}/vercel/deployment/current`);
        if (r.status === 404) {
          setDeploymentStatus('idle');
          setDeploymentId(null);
          setPublishLoading(false);
          if (deployPollRef.current) {
            clearInterval(deployPollRef.current);
            deployPollRef.current = null;
          }
          return;
        }
        if (!r.ok) return;
        const data = await r.json();
        
        // Stop polling if no active deployment (completed)
        if (!data.has_deployment) {
          console.log('🔍 Deployment completed - no active deployment');

          // Set final deployment URL
          if (data.last_deployment_url) {
            const url = String(data.last_deployment_url).startsWith('http') ? data.last_deployment_url : `https://${data.last_deployment_url}`;
            console.log('🔍 Deployment complete! URL:', url);
            setPublishedUrl(url);
            setDeploymentStatus('ready');
          } else {
            setDeploymentStatus('idle');
          }
          
          // End publish loading state (important: release loading even if no deployment)
          setPublishLoading(false);
          
          if (deployPollRef.current) {
            clearInterval(deployPollRef.current);
            deployPollRef.current = null;
          }
          return;
        }
        
        // If there is an active deployment
        const status = data.status;
        
        // Log only status changes
        if (status && status !== 'QUEUED') {
          console.log('🔍 Deployment status:', status);
        }
        
        // Check if deployment is ready or failed
        const isReady = status === 'READY';
        const isBuilding = status === 'BUILDING' || status === 'QUEUED';
        const isError = status === 'ERROR';
        
        if (isError) {
          console.error('🔍 Deployment failed:', status);
          setDeploymentStatus('error');
          
          // End publish loading state
          setPublishLoading(false);
          
          // Close publish panel after error (with delay to show error message)
          setTimeout(() => {
            setShowPublishPanel(false);
          }, 3000); // Show error for 3 seconds before closing
          
          if (deployPollRef.current) {
            clearInterval(deployPollRef.current);
            deployPollRef.current = null;
          }
          return;
        }
        
        if (isReady && data.deployment_url) {
          const url = String(data.deployment_url).startsWith('http') ? data.deployment_url : `https://${data.deployment_url}`;
          console.log('🔍 Deployment complete! URL:', url);
          setPublishedUrl(url);
          setDeploymentStatus('ready');
          
          // End publish loading state
          setPublishLoading(false);
          
          // Keep panel open to show the published URL
          
          if (deployPollRef.current) {
            clearInterval(deployPollRef.current);
            deployPollRef.current = null;
          }
        } else if (isBuilding) {
          setDeploymentStatus('deploying');
        }
      } catch (error) {
        console.error('🔍 Polling error:', error);
      }
    }, 1000); // Changed to 1 second interval
  }, [projectId]);

  const checkCurrentDeployment = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/vercel/deployment/current`);
      if (response.status === 404) {
        return;
      }

      if (response.ok) {
        const data = await response.json();
        if (data.has_deployment) {
          setDeploymentId(data.deployment_id);
          setDeploymentStatus('deploying');
          setPublishLoading(false);
          setShowPublishPanel(true);
          startDeploymentPolling(data.deployment_id);
          console.log('🔍 Resuming deployment monitoring:', data.deployment_id);
        }
      }
    } catch (e) {
      console.warn('Failed to check current deployment', e);
    }
  }, [projectId, startDeploymentPolling]);

  const start = useCallback(async () => {
    try {
      setIsStartingPreview(true);
      setPreviewInitializationMessage('Starting development server...');
      
      // Simulate progress updates
      setTimeout(() => setPreviewInitializationMessage('Installing dependencies...'), 1000);
      setTimeout(() => setPreviewInitializationMessage('Building your application...'), 2500);
      
      const r = await fetch(`${API_BASE}/api/projects/${projectId}/preview/start`, { method: 'POST' });
      if (!r.ok) {
        console.error('Failed to start preview:', r.statusText);
        setPreviewInitializationMessage('Failed to start preview');
        setTimeout(() => setIsStartingPreview(false), 2000);
        return;
      }
      const payload = await r.json();
      const data = payload?.data ?? payload ?? {};

      setPreviewInitializationMessage('Preview ready!');
      setTimeout(() => {
        setPreviewUrl(typeof data.url === 'string' ? data.url : null);
        setIsStartingPreview(false);
        setCurrentRoute('/'); // Reset to root route when starting
      }, 1000);
    } catch (error) {
      console.error('Error starting preview:', error);
      setPreviewInitializationMessage('An error occurred');
      setTimeout(() => setIsStartingPreview(false), 2000);
    }
  }, [projectId]);

  // Navigate to specific route in iframe
  const navigateToRoute = (route: string) => {
    if (previewUrl && iframeRef.current) {
      const baseUrl = previewUrl.split('?')[0]; // Remove any query params
      // Ensure route starts with /
      const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
      const newUrl = `${baseUrl}${normalizedRoute}`;
      iframeRef.current.src = newUrl;
      setCurrentRoute(normalizedRoute);
    }
  };

  const refreshPreview = useCallback(() => {
    if (!previewUrl || !iframeRef.current) {
      return;
    }

    try {
      const normalizedRoute =
        currentRoute && currentRoute.startsWith('/')
          ? currentRoute
          : `/${currentRoute || ''}`;
      const baseUrl = previewUrl.split('?')[0] || previewUrl;
      const url = new URL(baseUrl + normalizedRoute);
      url.searchParams.set('_ts', Date.now().toString());
      iframeRef.current.src = url.toString();
    } catch (error) {
      console.warn('Failed to refresh preview iframe:', error);
    }
  }, [previewUrl, currentRoute]);


  const stop = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/projects/${projectId}/preview/stop`, { method: 'POST' });
      setPreviewUrl(null);
    } catch (error) {
      console.error('Error stopping preview:', error);
    }
  }, [projectId]);

  const loadSubdirectory = useCallback(async (dir: string): Promise<Entry[]> => {
    try {
      const r = await fetch(`${API_BASE}/api/repo/${projectId}/tree?dir=${encodeURIComponent(dir)}`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Failed to load subdirectory:', error);
      return [];
    }
  }, [projectId]);

  const loadTree = useCallback(async (dir = '.') => {
    try {
      const r = await fetch(`${API_BASE}/api/repo/${projectId}/tree?dir=${encodeURIComponent(dir)}`);
      const data = await r.json();
      
      // Ensure data is an array
      if (Array.isArray(data)) {
        setTree(data);
        
        // Load contents for all directories in the root
        const newFolderContents = new Map();
        
        // Process each directory
        for (const entry of data) {
          if (entry.type === 'dir') {
            try {
              const subContents = await loadSubdirectory(entry.path);
              newFolderContents.set(entry.path, subContents);
            } catch (err) {
              console.error(`Failed to load contents for ${entry.path}:`, err);
            }
          }
        }
        
        setFolderContents(newFolderContents);
      } else {
        console.error('Tree data is not an array:', data);
        setTree([]);
      }
      
      setCurrentPath(dir);
    } catch (error) {
      console.error('Failed to load tree:', error);
      setTree([]);
    }
  }, [projectId, loadSubdirectory]);

  // Load subdirectory contents

  // Load folder contents
  const handleLoadFolder = useCallback(async (path: string) => {
    const contents = await loadSubdirectory(path);
    setFolderContents(prev => {
      const newMap = new Map(prev);
      newMap.set(path, contents);
      
      // Also load nested directories
      for (const entry of contents) {
        if (entry.type === 'dir') {
          const fullPath = `${path}/${entry.path}`;
          // Don't load if already loaded
          if (!newMap.has(fullPath)) {
            loadSubdirectory(fullPath).then(subContents => {
              setFolderContents(prev2 => new Map(prev2).set(fullPath, subContents));
            });
          }
        }
      }
      
      return newMap;
    });
  }, [loadSubdirectory]);

  // Toggle folder expansion
  function toggleFolder(path: string) {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }

  // Build tree structure from flat list
  function buildTreeStructure(entries: Entry[]): Map<string, Entry[]> {
    const structure = new Map<string, Entry[]>();
    
    // Initialize with root
    structure.set('', []);
    
    entries.forEach(entry => {
      const parts = entry.path.split('/');
      const parentPath = parts.slice(0, -1).join('/');
      
      if (!structure.has(parentPath)) {
        structure.set(parentPath, []);
      }
      structure.get(parentPath)?.push(entry);
      
      // If it's a directory, ensure it exists in the structure
      if (entry.type === 'dir') {
        if (!structure.has(entry.path)) {
          structure.set(entry.path, []);
        }
      }
    });
    
    return structure;
  }

  const openFile = useCallback(async (path: string) => {
    try {
      if (hasUnsavedChanges && path !== selectedFile) {
        const shouldDiscard =
          typeof window !== 'undefined'
            ? window.confirm('You have unsaved changes. Discard them and open the new file?')
            : true;
        if (!shouldDiscard) {
          return;
        }
      }

      setSaveFeedback('idle');
      setSaveError(null);

      const r = await fetch(`${API_BASE}/api/repo/${projectId}/file?path=${encodeURIComponent(path)}`);
      
      if (!r.ok) {
        console.error('Failed to load file:', r.status, r.statusText);
        const fallback = '// Failed to load file content';
        setContent(fallback);
        setEditedContent(fallback);
        editedContentRef.current = fallback;
        setHasUnsavedChanges(false);
        setSelectedFile(path);
        return;
      }
      
      const data = await r.json();
      const fileContent = typeof data?.content === 'string' ? data.content : '';
      setContent(fileContent);
      setEditedContent(fileContent);
      editedContentRef.current = fileContent;
      setHasUnsavedChanges(false);
      setSelectedFile(path);
      setIsFileUpdating(false);

      requestAnimationFrame(() => {
        if (editorRef.current) {
          editorRef.current.scrollTop = 0;
          editorRef.current.scrollLeft = 0;
        }
        if (highlightRef.current) {
          highlightRef.current.scrollTop = 0;
          highlightRef.current.scrollLeft = 0;
        }
        if (lineNumberRef.current) {
          lineNumberRef.current.scrollTop = 0;
        }
      });
    } catch (error) {
      console.error('Error opening file:', error);
      const fallback = '// Error loading file';
      setContent(fallback);
      setEditedContent(fallback);
      editedContentRef.current = fallback;
      setHasUnsavedChanges(false);
      setSelectedFile(path);
    }
  }, [projectId, hasUnsavedChanges, selectedFile]);

  // Reload currently selected file
  const reloadCurrentFile = useCallback(async () => {
    if (selectedFile && !showPreview && !hasUnsavedChanges) {
      try {
        const r = await fetch(`${API_BASE}/api/repo/${projectId}/file?path=${encodeURIComponent(selectedFile)}`);
        if (r.ok) {
          const data = await r.json();
          const newContent = data.content || '';
          if (newContent !== content) {
            setIsFileUpdating(true);
            setContent(newContent);
            setEditedContent(newContent);
            editedContentRef.current = newContent;
            setHasUnsavedChanges(false);
            setSaveFeedback('idle');
            setSaveError(null);
            setTimeout(() => setIsFileUpdating(false), 500);
          }
        }
      } catch (error) {
        // Silently fail - this is a background refresh
      }
    }
  }, [projectId, selectedFile, showPreview, hasUnsavedChanges, content]);

  // Lazy load highlight.js only when needed
  const [hljs, setHljs] = useState<any>(null);
  
  useEffect(() => {
    if (selectedFile && !hljs) {
      import('highlight.js/lib/common').then(mod => {
        setHljs(mod.default);
        // Load highlight.js CSS dynamically
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css';
        document.head.appendChild(link);
      });
    }
  }, [selectedFile, hljs]);

  const highlightedCode = useMemo(() => {
    const code = editedContent ?? '';
    if (!code) {
      return '&nbsp;';
    }

    if (!hljs) {
      return escapeHtml(code);
    }

    const language = getFileLanguage(selectedFile);
    try {
      if (!language || language === 'plaintext') {
        return escapeHtml(code);
      }
      return hljs.highlight(code, { language }).value;
    } catch {
      try {
        return hljs.highlightAuto(code).value;
      } catch {
        return escapeHtml(code);
      }
    }
  }, [hljs, editedContent, selectedFile]);

  const onEditorChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setEditedContent(value);
    editedContentRef.current = value;
    setHasUnsavedChanges(value !== content);
    setSaveFeedback('idle');
    setSaveError(null);
    if (isFileUpdating) {
      setIsFileUpdating(false);
    }
  }, [content, isFileUpdating]);

  const handleEditorScroll = useCallback((event: UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = event.currentTarget;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = scrollTop;
      highlightRef.current.scrollLeft = scrollLeft;
    }
    if (lineNumberRef.current) {
      lineNumberRef.current.scrollTop = scrollTop;
    }
  }, []);

  const handleSaveFile = useCallback(async () => {
    if (!selectedFile || isSavingFile || !hasUnsavedChanges) {
      return;
    }

    const contentToSave = editedContentRef.current;
    setIsSavingFile(true);
    setSaveFeedback('idle');
    setSaveError(null);

    try {
      const response = await fetch(`${API_BASE}/api/repo/${projectId}/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile, content: contentToSave }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to save file';
        try {
          const data = await response.clone().json();
          errorMessage = data?.error || data?.message || errorMessage;
        } catch {
          const text = await response.text().catch(() => '');
          if (text) {
            errorMessage = text;
          }
        }
        throw new Error(errorMessage);
      }

      setContent(contentToSave);
      setSaveFeedback('success');

      if (editedContentRef.current === contentToSave) {
        setHasUnsavedChanges(false);
        setIsFileUpdating(true);
        setTimeout(() => setIsFileUpdating(false), 800);
      }

      refreshPreview();
    } catch (error) {
      console.error('Failed to save file:', error);
      setSaveFeedback('error');
      setSaveError(error instanceof Error ? error.message : 'Failed to save file');
    } finally {
      setIsSavingFile(false);
    }
  }, [selectedFile, isSavingFile, hasUnsavedChanges, projectId, refreshPreview]);

  const handleEditorKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      handleSaveFile();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      const el = event.currentTarget;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const indent = '  ';
      const value = editedContent;
      const newValue = value.slice(0, start) + indent + value.slice(end);

      setEditedContent(newValue);
      editedContentRef.current = newValue;
      setHasUnsavedChanges(newValue !== content);
      setSaveFeedback('idle');
      setSaveError(null);
      if (isFileUpdating) {
        setIsFileUpdating(false);
      }

      requestAnimationFrame(() => {
        const position = start + indent.length;
        el.selectionStart = position;
        el.selectionEnd = position;
        if (highlightRef.current) {
          highlightRef.current.scrollTop = el.scrollTop;
          highlightRef.current.scrollLeft = el.scrollLeft;
        }
        if (lineNumberRef.current) {
          lineNumberRef.current.scrollTop = el.scrollTop;
        }
      });
    }
  }, [handleSaveFile, editedContent, content, isFileUpdating]);

  useEffect(() => {
    if (saveFeedback === 'success') {
      const timer = setTimeout(() => setSaveFeedback('idle'), 1800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [saveFeedback]);

  useEffect(() => {
    if (editorRef.current && highlightRef.current && lineNumberRef.current) {
      const { scrollTop, scrollLeft } = editorRef.current;
      highlightRef.current.scrollTop = scrollTop;
      highlightRef.current.scrollLeft = scrollLeft;
      lineNumberRef.current.scrollTop = scrollTop;
    }
  }, [editedContent]);

  // Get file extension for syntax highlighting
  function getFileLanguage(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'tsx':
      case 'ts':
        return 'typescript';
      case 'jsx':
      case 'js':
      case 'mjs':
        return 'javascript';
      case 'css':
        return 'css';
      case 'scss':
      case 'sass':
        return 'scss';
      case 'html':
      case 'htm':
        return 'html';
      case 'json':
        return 'json';
      case 'md':
      case 'markdown':
        return 'markdown';
      case 'py':
        return 'python';
      case 'sh':
      case 'bash':
        return 'bash';
      case 'yaml':
      case 'yml':
        return 'yaml';
      case 'xml':
        return 'xml';
      case 'sql':
        return 'sql';
      case 'php':
        return 'php';
      case 'java':
        return 'java';
      case 'c':
        return 'c';
      case 'cpp':
      case 'cc':
      case 'cxx':
        return 'cpp';
      case 'rs':
        return 'rust';
      case 'go':
        return 'go';
      case 'rb':
        return 'ruby';
      case 'vue':
        return 'vue';
      case 'svelte':
        return 'svelte';
      case 'dockerfile':
        return 'dockerfile';
      case 'toml':
        return 'toml';
      case 'ini':
        return 'ini';
      case 'conf':
      case 'config':
        return 'nginx';
      default:
        return 'plaintext';
    }
  }

  function escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Get file icon based on type
  function getFileIcon(entry: Entry): React.ReactElement {
    if (entry.type === 'dir') {
      return <span className="text-blue-500"><FaFolder size={16} /></span>;
    }
    
    const ext = entry.path.split('.').pop()?.toLowerCase();
    const filename = entry.path.split('/').pop()?.toLowerCase();
    
    // Special files
    if (filename === 'package.json') return <span className="text-green-600"><VscJson size={16} /></span>;
    if (filename === 'dockerfile') return <span className="text-blue-400"><FaDocker size={16} /></span>;
    if (filename?.startsWith('.env')) return <span className="text-yellow-500"><FaLock size={16} /></span>;
    if (filename === 'readme.md') return <span className="text-gray-600"><FaMarkdown size={16} /></span>;
    if (filename?.includes('config')) return <span className="text-gray-500"><FaCog size={16} /></span>;
    
    switch (ext) {
      case 'tsx':
        return <span className="text-cyan-400"><FaReact size={16} /></span>;
      case 'ts':
        return <span className="text-blue-600"><SiTypescript size={16} /></span>;
      case 'jsx':
        return <span className="text-cyan-400"><FaReact size={16} /></span>;
      case 'js':
      case 'mjs':
        return <span className="text-yellow-400"><FaJs size={16} /></span>;
      case 'css':
        return <span className="text-blue-500"><FaCss3Alt size={16} /></span>;
      case 'scss':
      case 'sass':
        return <span className="text-pink-500"><FaCss3Alt size={16} /></span>;
      case 'html':
      case 'htm':
        return <span className="text-orange-500"><FaHtml5 size={16} /></span>;
      case 'json':
        return <span className="text-yellow-600"><VscJson size={16} /></span>;
      case 'md':
      case 'markdown':
        return <span className="text-gray-600"><FaMarkdown size={16} /></span>;
      case 'py':
        return <span className="text-blue-400"><FaPython size={16} /></span>;
      case 'sh':
      case 'bash':
        return <span className="text-green-500"><FaFileCode size={16} /></span>;
      case 'yaml':
      case 'yml':
        return <span className="text-red-500"><SiYaml size={16} /></span>;
      case 'xml':
        return <span className="text-orange-600"><FaFileCode size={16} /></span>;
      case 'sql':
        return <span className="text-blue-600"><FaDatabase size={16} /></span>;
      case 'php':
        return <span className="text-indigo-500"><FaPhp size={16} /></span>;
      case 'java':
        return <span className="text-red-600"><FaJava size={16} /></span>;
      case 'c':
        return <span className="text-blue-700"><FaFileCode size={16} /></span>;
      case 'cpp':
      case 'cc':
      case 'cxx':
        return <span className="text-blue-600"><SiCplusplus size={16} /></span>;
      case 'rs':
        return <span className="text-orange-700"><FaRust size={16} /></span>;
      case 'go':
        return <span className="text-cyan-500"><SiGo size={16} /></span>;
      case 'rb':
        return <span className="text-red-500"><SiRuby size={16} /></span>;
      case 'vue':
        return <span className="text-green-500"><FaVuejs size={16} /></span>;
      case 'svelte':
        return <span className="text-orange-600"><SiSvelte size={16} /></span>;
      case 'dockerfile':
        return <span className="text-blue-400"><FaDocker size={16} /></span>;
      case 'toml':
      case 'ini':
      case 'conf':
      case 'config':
        return <span className="text-gray-500"><FaCog size={16} /></span>;
      default:
        return <span className="text-gray-400"><FaFile size={16} /></span>;
    }
  }

  // Ensure we only trigger dependency installation once per page lifecycle
  const installTriggeredRef = useRef(false);

  const startDependencyInstallation = useCallback(async () => {
    if (installTriggeredRef.current) {
      return;
    }
    installTriggeredRef.current = true;
    try {
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/install-dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('⚠️ Failed to start dependency installation:', errorText);
        // allow retry on next attempt if initial trigger failed
        installTriggeredRef.current = false;
      }
    } catch (error) {
      console.error('❌ Error starting dependency installation:', error);
      // allow retry if network error
      installTriggeredRef.current = false;
    }
  }, [projectId]);

  const loadSettings = useCallback(async (projectSettings?: { cli?: string; model?: string }) => {
    try {
      console.log('🔧 loadSettings called with project settings:', projectSettings);

      const hasCliSet = projectSettings?.cli || preferredCli;
      const hasModelSet = projectSettings?.model || selectedModel;

      if (!hasCliSet || !hasModelSet) {
        console.log('⚠️ Missing CLI or model, loading global settings');
        const globalResponse = await fetch(`${API_BASE}/api/settings/global`);
        if (globalResponse.ok) {
          const globalSettings = await globalResponse.json();
          const defaultCli = sanitizeCli(globalSettings.default_cli || globalSettings.defaultCli);
          const cliToUse = sanitizeCli(hasCliSet || defaultCli);

          if (!hasCliSet) {
            console.log('🔄 Setting CLI from global:', cliToUse);
            updatePreferredCli(cliToUse);
          }

          if (!hasModelSet) {
            const cliSettings = globalSettings.cli_settings?.[cliToUse] || globalSettings.cliSettings?.[cliToUse];
            if (cliSettings?.model) {
              updateSelectedModel(cliSettings.model, cliToUse);
            } else {
              updateSelectedModel(getDefaultModelForCli(cliToUse), cliToUse);
            }
          }
        } else {
          const response = await fetch(`${API_BASE}/api/settings`);
          if (response.ok) {
            const settings = await response.json();
            if (!hasCliSet) updatePreferredCli(settings.preferred_cli || settings.default_cli || DEFAULT_ACTIVE_CLI);
            if (!hasModelSet) {
              const cli = sanitizeCli(settings.preferred_cli || settings.default_cli || preferredCli || DEFAULT_ACTIVE_CLI);
              updateSelectedModel(getDefaultModelForCli(cli), cli);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      const hasCliSet = projectSettings?.cli || preferredCli;
      const hasModelSet = projectSettings?.model || selectedModel;
      if (!hasCliSet) updatePreferredCli(DEFAULT_ACTIVE_CLI);
      if (!hasModelSet) updateSelectedModel(getDefaultModelForCli(DEFAULT_ACTIVE_CLI), DEFAULT_ACTIVE_CLI);
    }
  }, [preferredCli, selectedModel, updatePreferredCli, updateSelectedModel]);

  const loadProjectInfo = useCallback(async (): Promise<{ cli?: string; model?: string; status?: ProjectStatus }> => {
    try {
      const r = await fetch(`${API_BASE}/api/projects/${projectId}`);
      if (!r.ok) {
        setProjectName(`Project ${projectId.slice(0, 8)}`);
        setProjectDescription('');
        setHasInitialPrompt(false);
        localStorage.setItem(`project_${projectId}_hasInitialPrompt`, 'false');
        setProjectStatus('active');
        setIsInitializing(false);
        setUsingGlobalDefaults(true);
        return {};
      }

      const payload = await r.json();
      const project = payload?.data ?? payload;
      const rawPreferredCli =
        typeof project?.preferredCli === 'string'
          ? project.preferredCli
          : typeof project?.preferred_cli === 'string'
          ? project.preferred_cli
          : undefined;
      const rawSelectedModel =
        typeof project?.selectedModel === 'string'
          ? project.selectedModel
          : typeof project?.selected_model === 'string'
          ? project.selected_model
          : undefined;

      console.log('📋 Loading project info:', {
        preferredCli: rawPreferredCli,
        selectedModel: rawSelectedModel,
      });

      setProjectName(project.name || `Project ${projectId.slice(0, 8)}`);

      const projectCli = sanitizeCli(rawPreferredCli || preferredCli);
      if (rawPreferredCli) {
        updatePreferredCli(projectCli);
      }
      if (rawSelectedModel) {
        updateSelectedModel(rawSelectedModel, projectCli);
      } else {
        updateSelectedModel(getDefaultModelForCli(projectCli), projectCli);
      }

      const followGlobal = !rawPreferredCli && !rawSelectedModel;
      setUsingGlobalDefaults(followGlobal);
      setProjectDescription(project.description || '');

      if (project.initial_prompt) {
        setHasInitialPrompt(true);
        localStorage.setItem(`project_${projectId}_hasInitialPrompt`, 'true');
      } else {
        setHasInitialPrompt(false);
        localStorage.setItem(`project_${projectId}_hasInitialPrompt`, 'false');
      }

      if (project.status === 'initializing') {
        setProjectStatus('initializing');
        setIsInitializing(true);
      } else {
        setProjectStatus('active');
        setIsInitializing(false);
        startDependencyInstallation();
        triggerInitialPromptIfNeeded();
      }

      const normalizedModel = rawSelectedModel
        ? sanitizeModel(projectCli, rawSelectedModel)
        : getDefaultModelForCli(projectCli);

      return {
        cli: rawPreferredCli ? projectCli : undefined,
        model: normalizedModel,
        status: project.status as ProjectStatus | undefined,
      };
    } catch (error) {
      console.error('Failed to load project info:', error);
      setProjectName(`Project ${projectId.slice(0, 8)}`);
      setProjectDescription('');
      setHasInitialPrompt(false);
      localStorage.setItem(`project_${projectId}_hasInitialPrompt`, 'false');
      setProjectStatus('active');
      setIsInitializing(false);
      setUsingGlobalDefaults(true);
      return {};
    }
  }, [
    projectId,
    startDependencyInstallation,
    triggerInitialPromptIfNeeded,
    updatePreferredCli,
    updateSelectedModel,
    preferredCli,
  ]);

  const loadProjectInfoRef = useRef(loadProjectInfo);
  useEffect(() => {
    loadProjectInfoRef.current = loadProjectInfo;
  }, [loadProjectInfo]);

  useEffect(() => {
    if (!searchParams) return;
    const cliParam = searchParams.get('cli');
    const modelParam = searchParams.get('model');
    if (!cliParam && !modelParam) {
      return;
    }
    const sanitizedCli = cliParam ? sanitizeCli(cliParam) : preferredCli;
    if (cliParam) {
      setUsingGlobalDefaults(false);
      updatePreferredCli(sanitizedCli);
    }
    if (modelParam) {
      setUsingGlobalDefaults(false);
      updateSelectedModel(modelParam, sanitizedCli);
    }
  }, [searchParams, preferredCli, updatePreferredCli, updateSelectedModel, setUsingGlobalDefaults]);

  const loadSettingsRef = useRef(loadSettings);
  useEffect(() => {
    loadSettingsRef.current = loadSettings;
  }, [loadSettings]);

  const loadTreeRef = useRef(loadTree);
  useEffect(() => {
    loadTreeRef.current = loadTree;
  }, [loadTree]);

  const loadDeployStatusRef = useRef(loadDeployStatus);
  useEffect(() => {
    loadDeployStatusRef.current = loadDeployStatus;
  }, [loadDeployStatus]);

  const checkCurrentDeploymentRef = useRef(checkCurrentDeployment);
  useEffect(() => {
    checkCurrentDeploymentRef.current = checkCurrentDeployment;
  }, [checkCurrentDeployment]);

  // Stable message handlers with useCallback to prevent reassignment
  const createStableMessageHandlers = useCallback(() => {
    const addMessage = (message: any) => {
      console.log('🔄 [StableHandler] Adding message via stable handler:', {
        messageId: message.id,
        role: message.role,
        isOptimistic: message.isOptimistic,
        requestId: message.requestId
      });

      // Track optimistic messages by requestId
      if (message.isOptimistic && message.requestId) {
        optimisticMessagesRef.current.set(message.requestId, message);
        console.log('🔄 [StableHandler] Tracking optimistic message:', {
          requestId: message.requestId,
          tempId: message.id
        });
      }

      // Also call the current handlers if they exist
      if (messageHandlersRef.current) {
        messageHandlersRef.current.add(message);
      }
    };

    const removeMessage = (messageId: string) => {
      console.log('🔄 [StableHandler] Removing message via stable handler:', messageId);

      // Remove from optimistic messages tracking if it's an optimistic message
      const optimisticMessage = Array.from(optimisticMessagesRef.current.values())
        .find(msg => msg.id === messageId);
      if (optimisticMessage && optimisticMessage.requestId) {
        optimisticMessagesRef.current.delete(optimisticMessage.requestId);
        console.log('🔄 [StableHandler] Removed optimistic message tracking:', {
          requestId: optimisticMessage.requestId,
          tempId: messageId
        });
      }

      // Also call the current handlers if they exist
      if (messageHandlersRef.current) {
        messageHandlersRef.current.remove(messageId);
      }
    };

    return { add: addMessage, remove: removeMessage };
  }, []);

  // Initialize stable handlers once
  useEffect(() => {
    stableMessageHandlers.current = createStableMessageHandlers();
    const optimisticMessages = optimisticMessagesRef.current;

    return () => {
      stableMessageHandlers.current = null;
      optimisticMessages.clear();
    };
  }, [createStableMessageHandlers]);

  // Handle image upload with base64 conversion
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          
          // Convert to base64
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64 = e.target?.result as string;
            setUploadedImages(prev => [...prev, {
              name: file.name,
              url,
              base64
            }]);
          };
          reader.readAsDataURL(file);
        }
      });
    }
  };

  // Remove uploaded image
  const removeUploadedImage = (index: number) => {
    setUploadedImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].url);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  async function runAct(messageOverride?: string, externalImages?: any[]) {
    let finalMessage = messageOverride || prompt;
    const imagesToUse = externalImages || uploadedImages;

    if (!finalMessage.trim() && imagesToUse.length === 0) {
      alert('Please enter a task description or upload an image.');
      return;
    }

    // Add additional instructions in Chat Mode
    if (mode === 'chat') {
      finalMessage = finalMessage + "\n\nDo not modify code, only answer to the user's request.";
    }

    // Create request fingerprint for deduplication
    const requestFingerprint = JSON.stringify({
      message: finalMessage.trim(),
      imageCount: imagesToUse.length,
      cliPreference: preferredCli,
      model: selectedModel,
      mode
    });

    // Check for duplicate pending requests
    if (pendingRequestsRef.current.has(requestFingerprint)) {
      console.log('🔄 [DEBUG] Duplicate request detected, skipping:', requestFingerprint);
      return;
    }

    setIsRunning(true);
    const requestId = crypto.randomUUID();
    let tempUserMessageId: string | null = null;

    // Add to pending requests
    pendingRequestsRef.current.add(requestFingerprint);

    try {
      const uploadImageFromBase64 = async (img: { base64: string; name?: string }) => {
        const base64String = img.base64;
        const match = base64String.match(/^data:(.*?);base64,(.*)$/);
        const mimeType = match && match[1] ? match[1] : 'image/png';
        const base64Data = match && match[2] ? match[2] : base64String;

        const byteString = atob(base64Data);
        const buffer = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i += 1) {
          buffer[i] = byteString.charCodeAt(i);
        }

        const extension = (() => {
          if (mimeType.includes('png')) return 'png';
          if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
          if (mimeType.includes('gif')) return 'gif';
          if (mimeType.includes('webp')) return 'webp';
          if (mimeType.includes('svg')) return 'svg';
          return 'png';
        })();

        const inferredName = img.name && img.name.trim().length > 0 ? img.name.trim() : `image-${crypto.randomUUID()}.${extension}`;
        const hasExtension = /\.[a-zA-Z0-9]+$/.test(inferredName);
        const filename = hasExtension ? inferredName : `${inferredName}.${extension}`;

        const file = new File([buffer], filename, { type: mimeType });
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE}/api/assets/${projectId}/upload`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Upload failed');
        }

        const result = await response.json();
        return {
          name: result.filename || filename,
          path: result.absolute_path,
          url: `/api/assets/${projectId}/${result.filename}`,
          public_url: typeof result.public_url === 'string' ? result.public_url : undefined,
          publicUrl: typeof result.public_url === 'string' ? result.public_url : undefined,
        };
      };

      console.log('🖼️ Processing images in runAct:', {
          imageCount: imagesToUse.length,
          cli: preferredCli,
          requestId
        });
      const processedImages: { name: string; path: string; url?: string; public_url?: string; publicUrl?: string }[] = [];

      for (let i = 0; i < imagesToUse.length; i += 1) {
        const image = imagesToUse[i];
        console.log(`🖼️ Processing image ${i}:`, {
          id: image.id,
          filename: image.filename,
          hasPath: !!image.path,
          hasPublicUrl: !!image.publicUrl,
          hasAssetUrl: !!image.assetUrl
        });
        if (image?.path) {
          const name = image.filename || image.name || `Image ${i + 1}`;
          const candidateUrl = typeof image.assetUrl === 'string' ? image.assetUrl : undefined;
          const candidatePublicUrl = typeof image.publicUrl === 'string' ? image.publicUrl : undefined;
          const processedImage = {
            name,
            path: image.path,
            url: candidateUrl && candidateUrl.startsWith('/') ? candidateUrl : undefined,
            public_url: candidatePublicUrl,
            publicUrl: candidatePublicUrl,
          };
          console.log(`🖼️ Created processed image ${i}:`, processedImage);
          processedImages.push(processedImage);
          continue;
        }

        if (image?.base64) {
          try {
            const uploaded = await uploadImageFromBase64({ base64: image.base64, name: image.name });
            processedImages.push(uploaded);
          } catch (uploadError) {
            console.error('Image upload failed:', uploadError);
            alert('Failed to upload image. Please try again.');
            setIsRunning(false);
            // Remove from pending requests
            pendingRequestsRef.current.delete(requestFingerprint);
            return;
          }
        }
      }

      const requestBody = {
        instruction: finalMessage,
        images: processedImages,
        isInitialPrompt: false,
        cliPreference: preferredCli,
        conversationId: conversationId || undefined,
        requestId,
        selectedModel,
      };

      console.log('📸 Sending request to act API:', {
        messageLength: finalMessage.length,
        imageCount: processedImages.length,
        cli: preferredCli,
        requestId,
        images: processedImages.map(img => ({
          name: img.name,
          hasPath: !!img.path,
          hasUrl: !!img.url,
          hasPublicUrl: !!img.publicUrl
        }))
      });

      // Optimistically add user message to UI BEFORE API call for instant feedback
      tempUserMessageId = requestId + '-user-temp';
      if (messageHandlersRef.current) {
        const optimisticUserMessage = {
          id: tempUserMessageId,
          projectId: projectId,
          role: 'user' as const,
          messageType: 'chat' as const,
          content: finalMessage,
          conversationId: conversationId || null,
          requestId: requestId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isStreaming: false,
          isFinal: false,
          isOptimistic: true,
          metadata:
            processedImages.length > 0
              ? {
                  attachments: processedImages.map((img) => ({
                    name: img.name,
                    path: img.path,
                    url: img.url,
                    publicUrl: img.publicUrl ?? img.public_url,
                  })),
                }
              : undefined,
        };
        console.log('🔄 [Optimistic] Adding optimistic user message via stable handler:', {
          tempId: tempUserMessageId,
          requestId,
          content: finalMessage.substring(0, 50) + '...'
        });

        // Use stable handlers instead of direct messageHandlersRef to prevent reassignment issues
        if (stableMessageHandlers.current) {
          stableMessageHandlers.current.add(optimisticUserMessage);
        } else if (messageHandlersRef.current) {
          // Fallback to direct handlers if stable handlers aren't ready yet
          messageHandlersRef.current.add(optimisticUserMessage);
        }
      }

      // Add timeout to prevent indefinite waiting
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      let r: Response;
      try {
        r = await fetch(`${API_BASE}/api/chat/${projectId}/act`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!r.ok) {
          const errorText = await r.text();
          console.error('API Error:', errorText);

          if (tempUserMessageId) {
            console.log('🔄 [Optimistic] Removing optimistic user message due to API error via stable handler:', tempUserMessageId);
            if (stableMessageHandlers.current) {
              stableMessageHandlers.current.remove(tempUserMessageId);
            } else if (messageHandlersRef.current) {
              messageHandlersRef.current.remove(tempUserMessageId);
            }
          }

          alert(`Failed to send message: ${r.status} ${r.statusText}\n${errorText}`);
          return;
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          if (tempUserMessageId) {
            console.log('🔄 [Optimistic] Removing optimistic user message due to timeout via stable handler:', tempUserMessageId);
            if (stableMessageHandlers.current) {
              stableMessageHandlers.current.remove(tempUserMessageId);
            } else if (messageHandlersRef.current) {
              messageHandlersRef.current.remove(tempUserMessageId);
            }
          }

          alert('Request timed out after 60 seconds. Please check your connection and try again.');
          return;
        }
        throw fetchError;
      }

      const result = await r.json();

      console.log('📸 Act API response received:', {
        success: result.success,
        userMessageId: result.userMessageId,
        conversationId: result.conversationId,
        requestId: result.requestId,
        hasAttachments: processedImages.length > 0
      });

      const returnedConversationId =
        typeof result?.conversationId === 'string'
          ? result.conversationId
          : typeof result?.conversation_id === 'string'
          ? result.conversation_id
          : undefined;
      if (returnedConversationId) {
        setConversationId(returnedConversationId);
      }

      const resolvedRequestId =
        typeof result?.requestId === 'string'
          ? result.requestId
          : typeof result?.request_id === 'string'
          ? result.request_id
          : requestId;
      const userMessageId =
        typeof result?.userMessageId === 'string'
          ? result.userMessageId
          : typeof result?.user_message_id === 'string'
          ? result.user_message_id
          : '';

      createRequest(resolvedRequestId, userMessageId, finalMessage, mode);
      
      // Refresh data after completion
      await loadTree('.');

      // Reset prompt and uploaded images
      setPrompt('');
      // Clean up old format images if any
      if (uploadedImages && uploadedImages.length > 0) {
        uploadedImages.forEach(img => {
          if (img.url) URL.revokeObjectURL(img.url);
        });
        setUploadedImages([]);
      }
      
    } catch (error: any) {
      console.error('Act execution error:', error);

      if (tempUserMessageId) {
        console.log('🔄 [Optimistic] Removing optimistic user message due to execution error via stable handler:', tempUserMessageId);
        if (stableMessageHandlers.current) {
          stableMessageHandlers.current.remove(tempUserMessageId);
        } else if (messageHandlersRef.current) {
          messageHandlersRef.current.remove(tempUserMessageId);
        }
      }

      const errorMessage = error?.message || String(error);
      alert(`Failed to send message: ${errorMessage}\n\nPlease try again. If the problem persists, check the console for details.`);
    } finally {
      setIsRunning(false);
      // Remove from pending requests
      pendingRequestsRef.current.delete(requestFingerprint);
    }
  }


  // Handle project status updates via callback from ChatLog
  const handleProjectStatusUpdate = (status: string, message?: string) => {
    const previousStatus = projectStatus;
    
    // Ignore if status is the same (prevent duplicates)
    if (previousStatus === status) {
      return;
    }
    
    setProjectStatus(status as ProjectStatus);
    if (message) {
      setInitializationMessage(message);
    }
    
    // If project becomes active, stop showing loading UI
    if (status === 'active') {
      setIsInitializing(false);
      
      // Handle only when transitioning from initializing → active
      if (previousStatus === 'initializing') {

        // Start dependency installation
        startDependencyInstallation();
        loadTreeRef.current?.('.');
      }
      
      // Initial prompt: trigger once with shared guard (handles active-via-WS case)
      triggerInitialPromptIfNeeded();
    } else if (status === 'failed') {
      setIsInitializing(false);
    }
  };

  // Function to start dependency installation in background
  const handleRetryInitialization = async () => {
    setProjectStatus('initializing');
    setIsInitializing(true);
    setInitializationMessage('Retrying project initialization...');
    
    try {
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/retry-initialization`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to retry initialization');
      }
    } catch (error) {
      console.error('Failed to retry initialization:', error);
      setProjectStatus('failed');
      setInitializationMessage('Failed to retry initialization. Please try again.');
    }
  };

  // Load states from localStorage when projectId changes
  useEffect(() => {
    if (typeof window !== 'undefined' && projectId) {
      const storedHasInitialPrompt = localStorage.getItem(`project_${projectId}_hasInitialPrompt`);
      const storedTaskComplete = localStorage.getItem(`project_${projectId}_taskComplete`);
      
      if (storedHasInitialPrompt !== null) {
        setHasInitialPrompt(storedHasInitialPrompt === 'true');
      }
      if (storedTaskComplete !== null) {
        setAgentWorkComplete(storedTaskComplete === 'true');
      }
    }
  }, [projectId]);

  // NEW: Auto control preview server based on active request status
  const previousActiveState = useRef(false);
  
  useEffect(() => {
    if (!hasActiveRequests && !previewUrl && !isStartingPreview) {
      if (!previousActiveState.current) {
        console.log('🔄 Preview not running; auto-starting');
      } else {
        console.log('✅ Task completed, ensuring preview server is running');
      }
      start();
    }

    previousActiveState.current = hasActiveRequests;
  }, [hasActiveRequests, previewUrl, isStartingPreview, start]);

  // Poll for file changes in code view
  useEffect(() => {
    if (!showPreview && selectedFile && !hasUnsavedChanges) {
      const interval = setInterval(() => {
        reloadCurrentFile();
      }, 2000); // Check every 2 seconds

      return () => clearInterval(interval);
    }
  }, [showPreview, selectedFile, hasUnsavedChanges, reloadCurrentFile]);


  useEffect(() => {
    if (!projectId) {
      return;
    }

    let canceled = false;

    const initializeChat = async () => {
      try {
        const projectSettings = await loadProjectInfoRef.current?.();
        if (canceled) return;

        await loadSettingsRef.current?.(projectSettings);
        if (canceled) return;

        await loadTreeRef.current?.('.');
        if (canceled) return;

        await loadDeployStatusRef.current?.();
        if (canceled) return;

        checkCurrentDeploymentRef.current?.();
      } catch (error) {
        console.error('Failed to initialize chat view:', error);
      }
    };

    initializeChat();

    const handleServicesUpdate = () => {
      loadDeployStatusRef.current?.();
    };

    const handleBeforeUnload = () => {
      navigator.sendBeacon(`${API_BASE}/api/projects/${projectId}/preview/stop`);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('services-updated', handleServicesUpdate);

    return () => {
      canceled = true;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('services-updated', handleServicesUpdate);

      const currentPreview = previewUrlRef.current;
      if (currentPreview) {
        fetch(`${API_BASE}/api/projects/${projectId}/preview/stop`, { method: 'POST' }).catch(() => {});
      }
    };
  }, [projectId]);

  // Cleanup pending requests on unmount
  useEffect(() => {
    const pendingRequests = pendingRequestsRef.current;
    return () => {
      pendingRequests.clear();
    };
  }, []);

  // React to global settings changes when using global defaults
  const { settings: globalSettings } = useGlobalSettings();
  useEffect(() => {
    if (!usingGlobalDefaults) return;
    if (!globalSettings) return;

    const cli = sanitizeCli(globalSettings.default_cli);
    updatePreferredCli(cli);

    const modelFromGlobal = globalSettings.cli_settings?.[cli]?.model;
    if (modelFromGlobal) {
      updateSelectedModel(modelFromGlobal, cli);
    } else {
      updateSelectedModel(getDefaultModelForCli(cli), cli);
    }
  }, [globalSettings, usingGlobalDefaults, updatePreferredCli, updateSelectedModel]);


  // Show loading UI if project is initializing

  return (
    <>
      <style jsx global>{`
        /* Light theme syntax highlighting */
        .hljs {
          background: #f9fafb !important;
          color: #374151 !important;
        }
        
        .hljs-punctuation,
        .hljs-bracket,
        .hljs-operator {
          color: #1f2937 !important;
          font-weight: 600 !important;
        }
        
        .hljs-built_in,
        .hljs-keyword {
          color: #7c3aed !important;
          font-weight: 600 !important;
        }
        
        .hljs-string {
          color: #059669 !important;
        }
        
        .hljs-number {
          color: #dc2626 !important;
        }
        
        .hljs-comment {
          color: #6b7280 !important;
          font-style: italic;
        }
        
        .hljs-function,
        .hljs-title {
          color: #2563eb !important;
          font-weight: 600 !important;
        }
        
        .hljs-variable,
        .hljs-attr {
          color: #dc2626 !important;
        }
        
        .hljs-tag,
        .hljs-name {
          color: #059669 !important;
        }
        
        /* Make parentheses, brackets, and braces more visible */
        .hljs-punctuation:is([data-char="("], [data-char=")"], [data-char="["], [data-char="]"], [data-char="{"], [data-char="}"]) {
          color: #1f2937 !important;
          font-weight: bold !important;
          background: rgba(59, 130, 246, 0.1);
          border-radius: 2px;
          padding: 0 1px;
        }
        
      `}</style>

      <div className="h-screen bg-white flex relative overflow-hidden">
        <div className="h-full w-full flex">
          {/* Left: Chat window */}
          <div
            style={{ width: '30%' }}
            className="h-full border-r border-gray-200 flex flex-col"
          >
            {/* Chat header */}
            <div className="bg-white border-b border-gray-200 p-4 h-[73px] flex items-center">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => router.push('/')}
                  className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  title="Back to home"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900 ">{projectName || 'Loading...'}</h1>
                  {projectDescription && (
                    <p className="text-sm text-gray-500 ">
                      {projectDescription}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Chat log area */}
            <div className="flex-1 min-h-0">
              <ChatErrorBoundary>
                <ChatLog
                  projectId={projectId}
                  onAddUserMessage={(handlers) => {
                    console.log('🔄 [HandlerSetup] ChatLog provided new handlers, updating references');
                    messageHandlersRef.current = handlers;

                    // Also update stable handlers if they exist
                    if (stableMessageHandlers.current) {
                      console.log('🔄 [HandlerSetup] Updating stable handlers reference');
                      // Note: stableMessageHandlers.current already has its own add/remove logic
                      // We don't replace it completely, just keep the reference to handlers
                    }
                  }}
                  onSessionStatusChange={(isRunningValue) => {
                  console.log('🔍 [DEBUG] Session status change:', isRunningValue);
                  setIsRunning(isRunningValue);
                  // Track agent task completion and auto-start preview
                  if (!isRunningValue && hasInitialPrompt && !agentWorkComplete && !previewUrl) {
                    setAgentWorkComplete(true);
                    // Save to localStorage
                    localStorage.setItem(`project_${projectId}_taskComplete`, 'true');
                    // Auto-start preview server after initial prompt task completion
                    start();
                  }
                }}
                onSseFallbackActive={(active) => {
                  console.log('🔄 [SSE] Fallback status:', active);
                  setIsSseFallbackActive(active);
                }}
                onProjectStatusUpdate={handleProjectStatusUpdate}
                startRequest={startRequest}
                completeRequest={completeRequest}
              />
              </ChatErrorBoundary>
            </div>
            
            {/* Simple input area */}
            <div className="p-4 rounded-bl-2xl">
              <ChatInput
                onSendMessage={(message, images) => {
                  // Pass images to runAct
                  runAct(message, images);
                }}
                disabled={isRunning}
                placeholder={mode === 'act' ? "Ask Claudable..." : "Chat with Claudable..."}
                mode={mode}
                onModeChange={setMode}
                projectId={projectId}
                preferredCli={preferredCli}
                selectedModel={selectedModel}
                thinkingMode={thinkingMode}
                onThinkingModeChange={setThinkingMode}
                modelOptions={modelOptions}
                onModelChange={handleModelChange}
                modelChangeDisabled={isUpdatingModel}
                cliOptions={cliOptions}
                onCliChange={handleCliChange}
                cliChangeDisabled={isUpdatingModel}
              />
            </div>
          </div>

          {/* Right: Preview/Code area */}
          <div className="h-full flex flex-col bg-black" style={{ width: '70%' }}>
            {/* Content area */}
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Controls Bar */}
              <div className="bg-white border-b border-gray-200 px-4 h-[73px] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Toggle switch */}
                  <div className="flex items-center bg-gray-100 rounded-lg p-1">
                    <button
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        showPreview 
                          ? 'bg-white text-gray-900 ' 
                          : 'text-gray-600 hover:text-gray-900 '
                      }`}
                      onClick={() => setShowPreview(true)}
                    >
                      <span className="w-4 h-4 flex items-center justify-center"><FaDesktop size={16} /></span>
                    </button>
                    <button
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        !showPreview 
                          ? 'bg-white text-gray-900 ' 
                          : 'text-gray-600 hover:text-gray-900 '
                      }`}
                      onClick={() => setShowPreview(false)}
                    >
                      <span className="w-4 h-4 flex items-center justify-center"><FaCode size={16} /></span>
                    </button>
                  </div>
                  
                  {/* Center Controls */}
                  {showPreview && previewUrl && (
                    <div className="flex items-center gap-3">
                      {/* Route Navigation */}
                      <div className="h-9 flex items-center bg-gray-100 rounded-lg px-3 border border-gray-200 ">
                        <span className="text-gray-400 mr-2">
                          <FaHome size={12} />
                        </span>
                        <span className="text-sm text-gray-500 mr-1">/</span>
                        <input
                          type="text"
                          value={currentRoute.startsWith('/') ? currentRoute.slice(1) : currentRoute}
                          onChange={(e) => {
                            const value = e.target.value;
                            setCurrentRoute(value ? `/${value}` : '/');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              navigateToRoute(currentRoute);
                            }
                          }}
                          className="bg-transparent text-sm text-gray-700 outline-none w-40"
                          placeholder="route"
                        />
                        <button
                          onClick={() => navigateToRoute(currentRoute)}
                          className="ml-2 text-gray-500 hover:text-gray-700 "
                        >
                          <FaArrowRight size={12} />
                        </button>
                      </div>
                      
                      {/* Action Buttons Group */}
                      <div className="flex items-center gap-1.5">
                        <button 
                          className="h-9 w-9 flex items-center justify-center bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                          onClick={() => {
                            const iframe = document.querySelector('iframe');
                            if (iframe) {
                              iframe.src = iframe.src;
                            }
                          }}
                          title="Refresh preview"
                        >
                          <FaRedo size={14} />
                        </button>
                        
                        {/* Device Mode Toggle */}
                        <div className="h-9 flex items-center gap-1 bg-gray-100 rounded-lg px-1 border border-gray-200 ">
                          <button
                            aria-label="Desktop preview"
                            className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${
                              deviceMode === 'desktop' 
                                ? 'text-blue-600 bg-blue-50 ' 
                                : 'text-gray-400 hover:text-gray-600 '
                            }`}
                            onClick={() => setDeviceMode('desktop')}
                          >
                            <FaDesktop size={14} />
                          </button>
                          <button
                            aria-label="Mobile preview"
                            className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${
                              deviceMode === 'mobile' 
                                ? 'text-blue-600 bg-blue-50 ' 
                                : 'text-gray-400 hover:text-gray-600 '
                            }`}
                            onClick={() => setDeviceMode('mobile')}
                          >
                            <FaMobileAlt size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Settings Button */}
                  <button 
                    onClick={() => setShowGlobalSettings(true)}
                    className="h-9 w-9 flex items-center justify-center bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Settings"
                  >
                    <FaCog size={16} />
                  </button>
                  
                  {/* Stop Button */}
                  {showPreview && previewUrl && (
                    <button 
                      className="h-9 px-3 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                      onClick={stop}
                    >
                      <FaStop size={12} />
                      Stop
                    </button>
                  )}
                  
                  {/* Publish/Update */}
                  {showPreview && previewUrl && (
                    <div className="relative">
                    <button
                      className="h-9 flex items-center gap-2 px-3 bg-black text-white rounded-lg text-sm font-medium transition-colors hover:bg-gray-900 border border-black/10 shadow-sm"
                      onClick={() => setShowPublishPanel(true)}
                    >
                      <FaRocket size={14} />
                      Publish
                      {deploymentStatus === 'deploying' && (
                        <span className="ml-2 inline-block w-2 h-2 rounded-full bg-amber-400"></span>
                      )}
                      {deploymentStatus === 'ready' && (
                        <span className="ml-2 inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
                      )}
                    </button>
                    {false && showPublishPanel && (
                      <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-5">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Publish Project</h3>
                        
                        {/* Deployment Status Display */}
                        {deploymentStatus === 'deploying' && (
                          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200 ">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                              <p className="text-sm font-medium text-blue-700 ">Deployment in progress...</p>
                            </div>
                            <p className="text-xs text-blue-600 ">Building and deploying your project. This may take a few minutes.</p>
                          </div>
                        )}
                        
                        {deploymentStatus === 'ready' && publishedUrl && (
                          <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200 ">
                            <p className="text-sm font-medium text-green-700 mb-2">Currently published at:</p>
                            <a 
                              href={publishedUrl ?? undefined} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-sm text-green-600 font-mono hover:underline break-all"
                            >
                              {publishedUrl}
                            </a>
                          </div>
                        )}
                        
                        {deploymentStatus === 'error' && (
                          <div className="mb-4 p-4 bg-red-50 rounded-lg border border-red-200 ">
                            <p className="text-sm font-medium text-red-700 mb-2">Deployment failed</p>
                            <p className="text-xs text-red-600 ">There was an error during deployment. Please try again.</p>
                          </div>
                        )}
                        
                        <div className="space-y-4">
                          {!githubConnected || !vercelConnected ? (
                            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 ">
                              <p className="text-sm font-medium text-gray-900 mb-3">To publish, connect the following services:</p>
                              <div className="space-y-2">
                                {!githubConnected && (
                                  <div className="flex items-center gap-2 text-amber-700 ">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-sm">GitHub repository not connected</span>
                                  </div>
                                )}
                                {!vercelConnected && (
                                  <div className="flex items-center gap-2 text-amber-700 ">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-sm">Vercel project not connected</span>
                                  </div>
                                )}
                              </div>
                              <p className="mt-3 text-sm text-gray-600 ">
                                Go to 
                                <button
                                  onClick={() => {
                                    setShowPublishPanel(false);
                                    setShowGlobalSettings(true);
                                  }}
                                  className="text-indigo-600 hover:text-indigo-500 underline font-medium mx-1"
                                >
                                  Settings → Service Integrations
                                </button>
                                to connect.
                              </p>
                            </div>
                          ) : null}
                          
                          <button
                            disabled={publishLoading || deploymentStatus === 'deploying' || !githubConnected || !vercelConnected}
                            onClick={async () => {
                              console.log('🚀 Publish started');
                              
                              setPublishLoading(true);
                              try {
                                // Push to GitHub
                                console.log('🚀 Pushing to GitHub...');
                                const pushRes = await fetch(`${API_BASE}/api/projects/${projectId}/github/push`, { method: 'POST' });
                                if (!pushRes.ok) {
                                  const errorText = await pushRes.text();
                                  console.error('🚀 GitHub push failed:', errorText);
                                  throw new Error(errorText);
                                }
                                
                                // Deploy to Vercel
                                console.log('🚀 Deploying to Vercel...');
                                const deployUrl = `${API_BASE}/api/projects/${projectId}/vercel/deploy`;
                                
                                const vercelRes = await fetch(deployUrl, {
                                  method: 'POST'
                                });
                                if (!vercelRes.ok) {
                                  const responseText = await vercelRes.text();
                                  console.error('🚀 Vercel deploy failed:', responseText);
                                }
                                if (vercelRes.ok) {
                                  const data = await vercelRes.json();
                                  console.log('🚀 Deployment started, polling for status...');
                                  
                                  // Set deploying status BEFORE ending publishLoading to prevent gap
                                  setDeploymentStatus('deploying');
                                  
                                  if (data.deployment_id) {
                                    startDeploymentPolling(data.deployment_id);
                                  }
                                  
                                  // Only set URL if deployment is already ready
                                  if (data.status === 'READY' && data.deployment_url) {
                                    const url = data.deployment_url.startsWith('http') ? data.deployment_url : `https://${data.deployment_url}`;
                                    setPublishedUrl(url);
                                    setDeploymentStatus('ready');
                                  }
                                } else {
                                  const errorText = await vercelRes.text();
                                  console.error('🚀 Vercel deploy failed:', vercelRes.status, errorText);
                                  // if Vercel not connected, just close
                                  setDeploymentStatus('idle');
                                  setPublishLoading(false); // Stop loading even on Vercel deployment failure
                                }
                                // Keep panel open to show deployment progress
                              } catch (e) {
                                console.error('🚀 Publish failed:', e);
                                alert('Publish failed. Check Settings and tokens.');
                                setDeploymentStatus('idle');
                                setPublishLoading(false); // Stop loading on error
                                // Close panel after error
                                setTimeout(() => {
                                  setShowPublishPanel(false);
                                }, 1000);
                              } finally {
                                loadDeployStatus();
                              }
                            }}
                            className={`w-full px-4 py-3 rounded-lg font-medium text-white transition-colors ${
                              publishLoading || deploymentStatus === 'deploying' || !githubConnected || !vercelConnected 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-indigo-600 hover:bg-indigo-700 '
                            }`}
                          >
                            {publishLoading 
                              ? 'Publishing...' 
                              : deploymentStatus === 'deploying'
                              ? 'Deploying...'
                              : !githubConnected || !vercelConnected 
                              ? 'Connect Services First' 
                              : deploymentStatus === 'ready' && publishedUrl ? 'Update' : 'Publish'
                            }
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              </div>
              
              {/* Content Area */}
              <div className="flex-1 relative bg-black overflow-hidden">
                <AnimatePresence initial={false}>
                  {showPreview ? (
                  <MotionDiv
                    key="preview"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ height: '100%' }}
                  >
                {previewUrl ? (
                  <div className="relative w-full h-full bg-gray-100 flex items-center justify-center">
                    <div 
                      className={`bg-white ${
                        deviceMode === 'mobile' 
                          ? 'w-[375px] h-[667px] rounded-[25px] border-8 border-gray-800 shadow-2xl' 
                          : 'w-full h-full'
                      } overflow-hidden`}
                    >
                      <iframe 
                        ref={iframeRef}
                        className="w-full h-full border-none bg-white "
                        src={previewUrl}
                        onError={() => {
                          // Show error overlay
                          const overlay = document.getElementById('iframe-error-overlay');
                          if (overlay) overlay.style.display = 'flex';
                        }}
                        onLoad={() => {
                          // Hide error overlay when loaded successfully
                          const overlay = document.getElementById('iframe-error-overlay');
                          if (overlay) overlay.style.display = 'none';
                        }}
                      />
                      
                      {/* Error overlay */}
                    <div 
                      id="iframe-error-overlay"
                      className="absolute inset-0 bg-gray-50 flex items-center justify-center z-10"
                      style={{ display: 'none' }}
                    >
                      <div className="text-center max-w-md mx-auto p-6">
                        <div className="text-4xl mb-4">🔄</div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">
                          Connection Issue
                        </h3>
                        <p className="text-gray-600 mb-4">
                          The preview couldn&apos;t load properly. Try clicking the refresh button to reload the page.
                        </p>
                        <button
                          className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                          onClick={() => {
                            const iframe = document.querySelector('iframe');
                            if (iframe) {
                              iframe.src = iframe.src;
                            }
                            const overlay = document.getElementById('iframe-error-overlay');
                            if (overlay) overlay.style.display = 'none';
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 4v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Refresh Now
                        </button>
                      </div>
                    </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gray-50 relative">
                    {/* Gradient background similar to main page */}
                    <div className="absolute inset-0">
                      <div className="absolute inset-0 bg-white " />
                      <div 
                        className="absolute inset-0 hidden transition-all duration-1000 ease-in-out"
                        style={{
                          background: `radial-gradient(circle at 50% 100%, 
                            ${activeBrandColor}66 0%, 
                            ${activeBrandColor}4D 25%, 
                            ${activeBrandColor}33 50%, 
                            transparent 70%)`
                        }}
                      />
                      {/* Light mode gradient - subtle */}
                      <div 
                        className="absolute inset-0 block transition-all duration-1000 ease-in-out"
                        style={{
                          background: `radial-gradient(circle at 50% 100%, 
                            ${activeBrandColor}40 0%, 
                            ${activeBrandColor}26 25%, 
                            transparent 50%)`
                        }}
                      />
                    </div>
                    
                    {/* Content with z-index to be above gradient */}
                    <div className="relative z-10 w-full h-full flex items-center justify-center">
                    {isStartingPreview ? (
                      <MotionDiv 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center"
                      >
                        {/* Claudable Symbol with loading spinner */}
                        <div className="w-40 h-40 mx-auto mb-6 relative">
                          <div 
                            className="w-full h-full"
                            style={{
                              backgroundColor: activeBrandColor,
                              mask: 'url(/Symbol_white.png) no-repeat center/contain',
                              WebkitMask: 'url(/Symbol_white.png) no-repeat center/contain',
                              opacity: 0.9
                            }}
                          />
                          
                          {/* Loading spinner in center */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div 
                              className="w-14 h-14 border-4 rounded-full animate-spin"
                              style={{
                                borderTopColor: 'transparent',
                                borderRightColor: activeBrandColor,
                                borderBottomColor: activeBrandColor,
                                borderLeftColor: activeBrandColor,
                              }}
                            />
                          </div>
                        </div>
                        
                        {/* Content */}
                        <h3 className="text-xl font-semibold text-gray-900 mb-3">
                          Starting Preview Server
                        </h3>
                        
                        <div className="flex items-center justify-center gap-1 text-gray-600 ">
                          <span>{previewInitializationMessage}</span>
                          <MotionDiv
                            className="flex gap-1 ml-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          >
                            <MotionDiv
                              animate={{ opacity: [0, 1, 0] }}
                              transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                              className="w-1 h-1 bg-gray-600 rounded-full"
                            />
                            <MotionDiv
                              animate={{ opacity: [0, 1, 0] }}
                              transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                              className="w-1 h-1 bg-gray-600 rounded-full"
                            />
                            <MotionDiv
                              animate={{ opacity: [0, 1, 0] }}
                              transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
                              className="w-1 h-1 bg-gray-600 rounded-full"
                            />
                          </MotionDiv>
                        </div>
                      </MotionDiv>
                    ) : (
                    <div className="text-center">
                      <MotionDiv
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      >
                        {/* Claudable Symbol */}
                        {hasActiveRequests ? (
                          <>
                            <div className="w-40 h-40 mx-auto mb-6 relative">
                              <MotionDiv
                                animate={{ rotate: 360 }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                style={{ transformOrigin: "center center" }}
                                className="w-full h-full"
                              >
                          <div 
                            className="w-full h-full"
                            style={{
                              backgroundColor: activeBrandColor,
                              mask: 'url(/Symbol_white.png) no-repeat center/contain',
                              WebkitMask: 'url(/Symbol_white.png) no-repeat center/contain',
                              opacity: 0.9
                            }}
                          />
                              </MotionDiv>
                            </div>
                            
                            <h3 className="text-2xl font-bold mb-3 relative overflow-hidden inline-block">
                              <span 
                                className="relative"
                                style={{
                                  background: `linear-gradient(90deg, 
                                    #6b7280 0%, 
                                    #6b7280 30%, 
                                    #ffffff 50%, 
                                    #6b7280 70%, 
                                    #6b7280 100%)`,
                                  backgroundSize: '200% 100%',
                                  WebkitBackgroundClip: 'text',
                                  backgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                  animation: 'shimmerText 5s linear infinite'
                                }}
                              >
                                Building...
                              </span>
                              <style>{`
                                @keyframes shimmerText {
                                  0% {
                                    background-position: 200% center;
                                  }
                                  100% {
                                    background-position: -200% center;
                                  }
                                }
                              `}</style>
                            </h3>
                          </>
                        ) : (
                          <>
                            <div
                              onClick={!isRunning && !isStartingPreview ? start : undefined}
                              className={`w-40 h-40 mx-auto mb-6 relative ${!isRunning && !isStartingPreview ? 'cursor-pointer group' : ''}`}
                            >
                              {/* Claudable Symbol with rotating animation when starting */}
                              <MotionDiv
                                className="w-full h-full"
                                animate={isStartingPreview ? { rotate: 360 } : {}}
                                transition={{ duration: 6, repeat: isStartingPreview ? Infinity : 0, ease: "linear" }}
                              >
                                <div 
                                  className="w-full h-full"
                                  style={{
                                    backgroundColor: activeBrandColor,
                                    mask: 'url(/Symbol_white.png) no-repeat center/contain',
                                    WebkitMask: 'url(/Symbol_white.png) no-repeat center/contain',
                                    opacity: 0.9
                                  }}
                                />
                              </MotionDiv>
                              
                              {/* Icon in Center - Play or Loading */}
                              <div className="absolute inset-0 flex items-center justify-center">
                                {isStartingPreview ? (
                                  <div 
                                    className="w-14 h-14 border-4 rounded-full animate-spin"
                                    style={{
                                      borderTopColor: 'transparent',
                                      borderRightColor: activeBrandColor,
                                      borderBottomColor: activeBrandColor,
                                      borderLeftColor: activeBrandColor,
                                    }}
                                  />
                                ) : (
                                  <MotionDiv
                                    className="flex items-center justify-center"
                                    whileHover={{ scale: 1.2 }}
                                    whileTap={{ scale: 0.9 }}
                                  >
                                    <FaPlay 
                                      size={32}
                                    />
                                  </MotionDiv>
                                )}
                              </div>
                            </div>
                            
                            <h3 className="text-2xl font-bold text-gray-900 mb-3">
                              Preview Not Running
                            </h3>
                            
                            <p className="text-gray-600 max-w-lg mx-auto">
                              Start your development server to see live changes
                            </p>
                          </>
                        )}
                      </MotionDiv>
                    </div>
                    )}
                    </div>
                  </div>
                )}
                  </MotionDiv>
                ) : (
              <MotionDiv
                key="code"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex bg-white "
              >
                {/* Left Sidebar - File Explorer (VS Code style) */}
                <div className="w-64 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col">
                  {/* File Tree */}
                  <div className="flex-1 overflow-y-auto bg-gray-50 custom-scrollbar">
                    {!tree || tree.length === 0 ? (
                      <div className="px-3 py-8 text-center text-[11px] text-gray-600 select-none">
                        No files found
                      </div>
                    ) : (
                      <TreeView 
                        entries={tree || []}
                        selectedFile={selectedFile}
                        expandedFolders={expandedFolders}
                        folderContents={folderContents}
                        onToggleFolder={toggleFolder}
                        onSelectFile={openFile}
                        onLoadFolder={handleLoadFolder}
                        level={0}
                        parentPath=""
                        getFileIcon={getFileIcon}
                      />
                    )}
                  </div>
                </div>

                {/* Right Editor Area */}
                <div className="flex-1 flex flex-col bg-white min-w-0">
                  {selectedFile ? (
                    <>
                      {/* File Tab */}
                      <div className="flex-shrink-0 bg-gray-100 ">
                        <div className="flex items-center gap-3 bg-white px-3 py-1.5 border-t-2 border-t-blue-500 ">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-4 h-4 flex items-center justify-center">
                              {getFileIcon(tree.find(e => e.path === selectedFile) || { path: selectedFile, type: 'file' })}
                            </span>
                            <span className="truncate text-[13px] text-gray-700 " style={{ fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
                              {selectedFile.split('/').pop()}
                            </span>
                          </div>
                          {hasUnsavedChanges && (
                            <span className="text-[11px] text-amber-600 ">
                              • Unsaved changes
                            </span>
                          )}
                          {!hasUnsavedChanges && saveFeedback === 'success' && (
                            <span className="text-[11px] text-green-600 ">
                              Saved
                            </span>
                          )}
                          {saveFeedback === 'error' && (
                            <span
                              className="text-[11px] text-red-600 truncate max-w-[160px]"
                              title={saveError ?? 'Failed to save file'}
                            >
                              Save error
                            </span>
                          )}
                          {!hasUnsavedChanges && saveFeedback !== 'success' && isFileUpdating && (
                            <span className="text-[11px] text-green-600 ">
                              Updated
                            </span>
                          )}
                          <div className="ml-auto flex items-center gap-2">
                            <button
                              className="px-3 py-1 text-xs font-medium rounded bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed "
                              onClick={handleSaveFile}
                              disabled={!hasUnsavedChanges || isSavingFile}
                              title="Save (Ctrl+S)"
                            >
                              {isSavingFile ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              className="text-gray-700 hover:bg-gray-200 px-1 rounded"
                              onClick={() => {
                                if (hasUnsavedChanges) {
                                  const confirmClose =
                                    typeof window !== 'undefined'
                                      ? window.confirm('You have unsaved changes. Close without saving?')
                                      : true;
                                  if (!confirmClose) {
                                    return;
                                  }
                                }
                                setSelectedFile('');
                                setContent('');
                                setEditedContent('');
                                editedContentRef.current = '';
                                setHasUnsavedChanges(false);
                                setSaveFeedback('idle');
                                setSaveError(null);
                                setIsFileUpdating(false);
                              }}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Code Editor */}
                      <div className="flex-1 overflow-hidden">
                        <div className="w-full h-full flex bg-white overflow-hidden">
                          {/* Line Numbers */}
                          <div
                            ref={lineNumberRef}
                            className="bg-gray-50 px-3 py-4 select-none flex-shrink-0 overflow-y-auto overflow-x-hidden custom-scrollbar pointer-events-none"
                            aria-hidden="true"
                          >
                            <div className="text-[13px] font-mono text-gray-500 leading-[19px]">
                              {(editedContent || '').split('\n').map((_, index) => (
                                <div key={index} className="text-right pr-2">
                                  {index + 1}
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Code Content */}
                          <div className="relative flex-1">
                            <pre
                              ref={highlightRef}
                              aria-hidden="true"
                              className="absolute inset-0 m-0 p-4 overflow-hidden text-[13px] leading-[19px] font-mono text-gray-800 whitespace-pre pointer-events-none"
                              style={{ fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace" }}
                            >
                              <code
                                className={`language-${getFileLanguage(selectedFile)}`}
                                dangerouslySetInnerHTML={{ __html: highlightedCode }}
                              />
                              <span className="block h-full min-h-[1px]" />
                            </pre>
                            <textarea
                              ref={editorRef}
                              value={editedContent}
                              onChange={onEditorChange}
                              onScroll={handleEditorScroll}
                              onKeyDown={handleEditorKeyDown}
                              spellCheck={false}
                              autoCorrect="off"
                              autoCapitalize="none"
                              autoComplete="off"
                              wrap="off"
                              aria-label="Code editor"
                              className="absolute inset-0 w-full h-full resize-none bg-transparent text-transparent caret-gray-800 outline-none font-mono text-[13px] leading-[19px] p-4 whitespace-pre overflow-auto custom-scrollbar"
                              style={{ fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace" }}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Welcome Screen */
                    <div className="flex-1 flex items-center justify-center bg-white ">
                      <div className="text-center">
                        <span className="w-16 h-16 mb-4 opacity-10 text-gray-400 mx-auto flex items-center justify-center"><FaCode size={64} /></span>
                        <h3 className="text-lg font-medium text-gray-700 mb-2">
                          Welcome to Code Editor
                        </h3>
                        <p className="text-sm text-gray-500 ">
                          Select a file from the explorer to start viewing code
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </MotionDiv>
                )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
      

      {/* Publish Modal */}
      {showPublishPanel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPublishPanel(false)} />
          <div className="relative w-full max-w-lg bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/60 ">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-black border border-black/10 ">
                  <FaRocket size={14} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 ">Publish Project</h3>
                  <p className="text-xs text-gray-600 ">Deploy with Vercel, linked to your GitHub repo</p>
                </div>
              </div>
              <button onClick={() => setShowPublishPanel(false)} className="text-gray-400 hover:text-gray-600 ">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {deploymentStatus === 'deploying' && (
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 ">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-medium text-blue-700 ">Deployment in progress…</p>
                  </div>
                  <p className="text-xs text-blue-700/80 ">Building and deploying your project. This may take a few minutes.</p>
                </div>
              )}

              {deploymentStatus === 'ready' && publishedUrl && (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 ">
                  <p className="text-sm font-medium text-emerald-700 mb-2">Published successfully</p>
                  <div className="flex items-center gap-2">
                    <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-mono text-emerald-700 underline break-all flex-1">
                      {publishedUrl}
                    </a>
                    <button
                      onClick={() => navigator.clipboard?.writeText(publishedUrl)}
                      className="px-2 py-1 text-xs rounded-lg border border-emerald-300/80 text-emerald-700 hover:bg-emerald-100 "
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              {deploymentStatus === 'error' && (
                <div className="p-4 rounded-xl border border-red-200 bg-red-50 ">
                  <p className="text-sm font-medium text-red-700 ">Deployment failed. Please try again.</p>
                </div>
              )}

              {!githubConnected || !vercelConnected ? (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 ">
                  <p className="text-sm font-medium text-gray-900 mb-2">Connect the following services:</p>
                  <div className="space-y-1 text-amber-700 text-sm">
                    {!githubConnected && (<div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"/>GitHub repository not connected</div>)}
                    {!vercelConnected && (<div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"/>Vercel project not connected</div>)}
                  </div>
                  <button
                    className="mt-3 w-full px-4 py-2 rounded-xl border border-gray-200 text-gray-800 hover:bg-gray-50 "
                    onClick={() => { setShowPublishPanel(false); setShowGlobalSettings(true); }}
                  >
                    Open Settings → Services
                  </button>
                </div>
              ) : null}

              <button
                disabled={publishLoading || deploymentStatus === 'deploying' || !githubConnected || !vercelConnected}
                onClick={async () => {
                  try {
                    setPublishLoading(true);
                    setDeploymentStatus('deploying');
                    // 1) Push to GitHub to ensure branch/commit exists
                    try {
                      const pushRes = await fetch(`${API_BASE}/api/projects/${projectId}/github/push`, { method: 'POST' });
                      if (!pushRes.ok) {
                        const err = await pushRes.text();
                        console.error('🚀 GitHub push failed:', err);
                        throw new Error(err);
                      }
                    } catch (e) {
                      console.error('🚀 GitHub push step failed', e);
                      throw e;
                    }
                    // Small grace period to let GitHub update default branch
                    await new Promise(r => setTimeout(r, 800));
                    // 2) Deploy to Vercel (branch auto-resolved on server)
                    const deployUrl = `${API_BASE}/api/projects/${projectId}/vercel/deploy`;
                    const vercelRes = await fetch(deployUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ branch: 'main' })
                    });
                    if (vercelRes.ok) {
                      const data = await vercelRes.json();
                      setDeploymentStatus('deploying');
                      if (data.deployment_id) startDeploymentPolling(data.deployment_id);
                      if (data.ready && data.deployment_url) {
                        const url = data.deployment_url.startsWith('http') ? data.deployment_url : `https://${data.deployment_url}`;
                        setPublishedUrl(url);
                        setDeploymentStatus('ready');
                      }
                    } else {
                      const errorText = await vercelRes.text();
                      console.error('🚀 Vercel deploy failed:', vercelRes.status, errorText);
                      setDeploymentStatus('idle');
                      setPublishLoading(false);
                    }
                  } catch (e) {
                    console.error('🚀 Publish failed:', e);
                    alert('Publish failed. Check Settings and tokens.');
                    setDeploymentStatus('idle');
                    setPublishLoading(false);
                    setTimeout(() => setShowPublishPanel(false), 1000);
                  } finally {
                    loadDeployStatus();
                  }
                }}
                className={`w-full px-4 py-3 rounded-xl font-medium text-white transition ${
                  publishLoading || deploymentStatus === 'deploying' || !githubConnected || !vercelConnected
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-black hover:bg-gray-900'
                }`}
              >
                {publishLoading ? 'Publishing…' : deploymentStatus === 'deploying' ? 'Deploying…' : (!githubConnected || !vercelConnected) ? 'Connect Services First' : (deploymentStatus === 'ready' && publishedUrl ? 'Update' : 'Publish')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Settings Modal */}
      <ProjectSettings
        isOpen={showGlobalSettings}
        onClose={() => setShowGlobalSettings(false)}
        projectId={projectId}
        projectName={projectName}
        projectDescription={projectDescription}
        initialTab="services"
        onProjectUpdated={({ name, description }) => {
          setProjectName(name);
          setProjectDescription(description ?? '');
        }}
      />
    </>
  );
}
