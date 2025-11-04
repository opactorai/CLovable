'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Image as ImageIcon,
  Pencil,
  ArrowUp,
  Loader2,
  Eye,
  EyeOff,
  Key,
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Square,
  Brain,
  Clock,
  Link,
  Link2,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';
import type { ChatSession, Message } from '@/lib/chat';
import { preprocessCodexMarkdown } from '@/lib/chat/formatters/codexFormatter';
import {
  ASSISTANT_OPTIONS,
  AssistantKey,
} from '@/lib/assistant-options';
import { OptionsModal } from './OptionsModal';
import { UsageLimitModal } from './UsageLimitModal';
import { TurnCompleteNotification } from './TurnCompleteNotification';
import type { StreamingState } from '@/types/streaming';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { ToolIcon } from '@/components/ToolIcon';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { SessionDropdown } from './SessionDropdown';
import { useTheme } from '@/contexts/BuildThemeContext';
import type { IFrameError } from './ErrorCard';
import { ErrorSummaryCard } from './ErrorSummaryCard';

function formatToolInput(input: any): string {
  if (!input) return '';
  if (typeof input === 'string') return input;
  if (input.file_path) return input.file_path;
  if (input.command) return input.command;
  if (input.query) return input.query;
  return JSON.stringify(input);
}

// Map tool names for display
function getDisplayName(name: string): string {
  if (['Write', 'Edit', 'MultiEdit'].includes(name)) return 'Edit';
  if (['Bash', 'Run', 'Task'].includes(name)) return 'Run';
  return name;
}


const ELLIPSIS_FRAMES = ['.', '..', '...'] as const;

const AnimatedEllipsis = ({ className = '' }: { className?: string }) => {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % ELLIPSIS_FRAMES.length);
    }, 320);
    return () => window.clearInterval(interval);
  }, []);
  ;
  return (
    <span className={`font-mono text-xs text-tertiary ${className}`}>
      {ELLIPSIS_FRAMES[frameIndex]}
    </span>
  );
};

const ThinkingIndicator = ({ startedAt }: { startedAt: Date }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000)),
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000)),
      );
    }, 1000);

    return () => window.clearInterval(interval);
  }, [startedAt]);

  return (
    <span className="relative inline-block font-semibold text-secondary thinking-shiny-wrapper">
      Thinking {elapsedSeconds}s
    </span>
  );
};

// Progress Ring component for usage indicator (standalone, clickable)
const ProgressRing = ({
  percent,
  size = 16,
  strokeWidth = 2,
  isGray = false,
  onClick,
}: {
  percent: number | null;
  size?: number;
  strokeWidth?: number;
  isGray?: boolean;
  onClick?: () => void;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = percent !== null ? circumference - (percent / 100) * circumference : 0;

  // Color based on usage
  const getStrokeColor = () => {
    if (isGray || percent === null) {
      return 'rgb(156, 163, 175)'; // gray-400
    }
    if (percent >= 90) {
      return 'rgb(239, 68, 68)'; // red-500
    }
    if (percent >= 70) {
      return 'rgb(251, 146, 60)'; // orange-400
    }
    return 'rgb(34, 197, 94)'; // green-500
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
      title="View usage limits"
    >
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isGray ? 'rgb(156, 163, 175)' : 'rgb(229, 231, 235)'}
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        {!isGray && percent !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={getStrokeColor()}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
        )}
      </svg>
    </button>
  );
};

interface SecretField {
  key: string;
  label: string;
  required?: boolean;
  placeholder?: string;
}

interface SecretInputInlineProps {
  secrets: SecretField[];
  sessionId: string;
  projectId: string;
  message: string;
  requestId?: string;
}

function SecretInputInline({
  secrets,
  sessionId,
  projectId,
  message,
  requestId,
}: SecretInputInlineProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate required fields
    for (const secret of secrets) {
      if (secret.required && !values[secret.key]?.trim()) {
        setError(`${secret.label} is required`);
        return;
      }
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await apiClient.request(
        `/api/chat/${projectId}/submit-secrets`,
        {
          method: 'POST',
          body: {
            secrets: values,
            requestId,
          },
        }
      );

      setSuccess(true);
      toast.success('Secrets submitted successfully');
    } catch (err: any) {
      console.error('Secret submission error:', err);
      setError(err.message || 'Failed to submit secrets');
      toast.error('Failed to submit secrets');
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPassword(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (success) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
        <span className="text-xs text-green-700 dark:text-green-400">Secrets submitted successfully!</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-center gap-2 mb-6 mt-6">
        <Key className="w-4 h-4 text-primary dark:text-primary" />
        <span className="text-xs font-medium text-primary dark:text-primary">{message}</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {secrets.map((secret) => (
          <div key={secret.key}>
            <label className="block text-xs font-medium text-secondary dark:text-secondary mb-1">
              {secret.label}
              {secret.required && <span className="text-red-500 dark:text-red-400 ml-0.5">*</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword[secret.key] ? 'text' : 'password'}
                value={values[secret.key] || ''}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    [secret.key]: e.target.value,
                  }))
                }
                required={secret.required}
                placeholder={secret.placeholder || `Enter ${secret.label}`}
                className="w-full px-2 py-1.5 pr-8 text-xs border border-primary focus:outline-none rounded-lg bg-secondary dark:bg-secondary font-mono text-primary dark:text-primary dark:border-primary"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility(secret.key)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-interactive-hover rounded"
                disabled={isSubmitting}
              >
                {showPassword[secret.key] ? (
                  <EyeOff className="w-3 h-3 text-primary dark:text-primary" />
                ) : (
                  <Eye className="w-3 h-3 text-primary dark:text-primary" />
                )}
              </button>
            </div>
          </div>
        ))}

        {error && (
          <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span className="text-xs text-red-700 dark:text-red-400">{error}</span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-3 py-1.5 text-xs bg-secondary dark:bg-secondary text-primary dark:text-white rounded-lg hover:bg-interactive-hover dark:hover:bg-elevated transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 border-bg-elevated dark:border-primary"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

interface UploadedImage {
  file: File;
  metadata?: {
    url: string;
    filename: string;
    originalName: string;
    size: number;
    mimeType: string;
    uploadedAt: string;
  };
  uploading?: boolean;
  error?: string;
}

interface ChatSidebarProps {
  projectName: string;
  projectId: string;
  projectStatus?: string;
  messages: Message[];
  allMessages: Message[];
  sessions: ChatSession[];
  activeChatRoomId: number | null;
  canEdit?: boolean;
  roomsReady?: boolean;
  isLoading: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  uploadedImages: UploadedImage[];
  onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  selectedCli: AssistantKey;
  onAssistantTabSelect: (cli: AssistantKey) => void;
  selectedModel: string;
  onModelChange: (value: string) => void;
  selectedEffort: 'low' | 'medium' | 'high';
  onEffortChange: (value: 'low' | 'medium' | 'high') => void;
  onNavigateHome: () => void;
  onSessionSwitch: (chatRoomId: number) => void | Promise<void>;
  onNewSession: () => void;
  onRenameSession: (chatRoomId: number, name: string) => void | Promise<void>;
  onCloseSession: (chatRoomId: number) => void | Promise<void>;
  streamingState?: StreamingState;
  previewReady?: boolean;
  onFileClick?: (filePath: string, lineNumber?: number) => void;
  isResuming?: boolean;
  resumeError?: string | null;
  onCancel?: () => void | Promise<void>;
  onResumeEditing?: () => void | Promise<void>;
  onOpenIntegration?: (integration: 'supabase' | 'github' | 'other-apps') => void;
  projectType?: string;
  importedRepoUrl?: string | null;
  onOpenDiff?: (turnDiff: any) => void;
  onRestoreDiff?: (turnDiff: any) => void;
  onConfirmRestore?: (turnDiff: any) => void;
  onCancelRestore?: (turnDiff: any) => void;
  restoreState?: Record<string, 'idle' | 'loading' | 'confirming'>;
  isInitialPromptRunning?: boolean;
  iframeErrors?: IFrameError[];
  hideErrorsUntil?: number;
  onOpenErrorDetail?: () => void;
  onFixError?: () => void;
  isFixingErrors?: boolean;
}

export const ChatSidebar = ({
  projectName,
  projectId,
  projectStatus,
  messages,
  allMessages,
  sessions,
  activeChatRoomId,
  canEdit = true,
  roomsReady = false,
  isLoading,
  input,
  onInputChange,
  onSubmit,
  uploadedImages,
  onImageUpload,
  onRemoveImage,
  selectedCli,
  onAssistantTabSelect,
  selectedModel,
  onModelChange,
  selectedEffort,
  onEffortChange,
  onNavigateHome,
  onSessionSwitch,
  onNewSession,
  onRenameSession,
  onCloseSession,
  streamingState,
  previewReady = true,
  onFileClick,
  isResuming = false,
  resumeError = null,
  onCancel,
  onOpenIntegration,
  projectType,
  importedRepoUrl,
  onOpenDiff,
  onRestoreDiff,
  onConfirmRestore,
  onCancelRestore,
  restoreState = {},
  isInitialPromptRunning = false,
  onResumeEditing,
  iframeErrors = [],
  hideErrorsUntil = 0,
  onOpenErrorDetail,
  onFixError,
  isFixingErrors = false,
}: ChatSidebarProps) => {
  const { theme } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Use a stable key that only changes on intentional room switches
  const containerKeyRef = useRef<string>(`session-${Date.now()}`);
  const lastRoomIdRef = useRef<number | null>(activeChatRoomId);
  
  // Only change key when user explicitly switches rooms (both old and new are non-null)
  if (lastRoomIdRef.current !== null && activeChatRoomId !== null && lastRoomIdRef.current !== activeChatRoomId) {
    containerKeyRef.current = `room-${activeChatRoomId}`;
  }
  lastRoomIdRef.current = activeChatRoomId;
  
  // Track which messages have already animated to prevent re-animation on re-renders
  const animatedMessagesRef = useRef(new Set<string>());
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, forceUpdate] = useState({});

  // Force re-render when hideErrorsUntil expires
  useEffect(() => {
    if (hideErrorsUntil > Date.now()) {
      const timeUntilExpiry = hideErrorsUntil - Date.now();
      const timer = setTimeout(() => {
        forceUpdate({});
      }, timeUntilExpiry);
      return () => clearTimeout(timer);
    }
  }, [hideErrorsUntil]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [isDropupOpen, setIsDropupOpen] = useState(false);
  const dropupRef = useRef<HTMLDivElement>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const [usageLimitModal, setUsageLimitModal] = useState<{
    isOpen: boolean;
    data: any;
    isLoading: boolean;
  }>({ isOpen: false, data: null, isLoading: false });
  const [usagePercent, setUsagePercent] = useState<number | null>(null);
  const [turnStats, setTurnStats] = useState(streamingState?.turnStats || null);
  const [turnStartTime, setTurnStartTime] = useState<number>(() => {
    // Restore from localStorage on mount
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`turnStartTime_${projectId}`);
      return saved ? parseInt(saved, 10) : Date.now();
    }
    return Date.now();
  });
  const [showTurnSummary, setShowTurnSummary] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [expandedToolMessages, setExpandedToolMessages] = useState<Record<string, boolean>>({});
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const isUserScrollingRef = useRef(false);
  useEffect(() => {
    if (streamingState?.turnComplete && streamingState?.turnStats) {
      setTurnStats(streamingState.turnStats);
      setShowTurnSummary(true);
      // Auto-hide summary after 10 seconds
      const timer = setTimeout(() => setShowTurnSummary(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [streamingState?.turnComplete, streamingState?.turnStats]);

  // Track turn start time and save to localStorage
  useEffect(() => {
    if (isLoading && !streamingState?.turnComplete) {
      const now = Date.now();
      setTurnStartTime(now);
      setShowTurnSummary(false);
      setElapsedSeconds(0);
      // Save to localStorage
      localStorage.setItem(`turnStartTime_${projectId}`, now.toString());
    } else if (!isLoading) {
      // Clear from localStorage when not loading
      localStorage.removeItem(`turnStartTime_${projectId}`);
    }
  }, [isLoading, streamingState?.turnComplete, projectId]);

  // Update elapsed time every second while loading
  useEffect(() => {
    if (!isLoading) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - turnStartTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading, turnStartTime]);

  // Handle scroll behavior - only auto-scroll when user is near bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      // Consider "near bottom" if within 150px
      const isNearBottom = distanceFromBottom < 150;

      // If user scrolled up, mark as user scrolling
      if (!isNearBottom) {
        isUserScrollingRef.current = true;
        setShouldAutoScroll(false);
      } else {
        // If user scrolled back to bottom, re-enable auto scroll
        isUserScrollingRef.current = false;
        setShouldAutoScroll(true);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to bottom when new messages arrive (only if should auto scroll)
  useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, shouldAutoScroll]);

  // Close dropup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropupRef.current && !dropupRef.current.contains(event.target as Node)) {
        setIsDropupOpen(false);
      }
    };

    if (isDropupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropupOpen]);

  // Close model dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };

    if (isModelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModelDropdownOpen]);

  // Handle clipboard paste for images
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        // Create a synthetic event to pass to onImageUpload
        const syntheticEvent = {
          target: {
            files: files,
          },
        } as unknown as ChangeEvent<HTMLInputElement>;

        onImageUpload(syntheticEvent);
      }
    };

    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [onImageUpload]);

  // Handle ESC key to close image modal
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && selectedImageUrl) {
        setSelectedImageUrl(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedImageUrl]);

  // Re-focus textarea when loading completes
  useEffect(() => {
    if (!isLoading && !isResuming && textareaRef.current) {
      // Use a small timeout to ensure DOM has updated
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isResuming]);

  // Fetch usage limit periodically for Codex
  useEffect(() => {
    if (selectedCli !== 'codex') {
      setUsagePercent(null);
      return;
    }

    const fetchUsage = async () => {
      try {
        const data = await apiClient.getUsageLimit(projectId, 'codex');
        if (data.success && data.data?.primary) {
          setUsagePercent(data.data.primary.usedPercent);
        }
      } catch (error) {
        console.error('Failed to fetch usage limit:', error);
      }
    };

    // Fetch immediately
    void fetchUsage();

    // Fetch every 30 seconds
    const interval = setInterval(() => {
      void fetchUsage();
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedCli, projectId]);

  // Handler for opening usage limit modal
  const handleUsageLimitClick = useCallback(async () => {
    setUsageLimitModal({ isOpen: true, data: null, isLoading: false });

    // Claude, Gemini, and Z.ai don't need API call
    if (selectedCli === 'claude' || selectedCli === 'gemini' || selectedCli === 'glm') {
      return;
    }

    // Codex: fetch usage data
    setUsageLimitModal(prev => ({ ...prev, isLoading: true }));

    try {
      const data = await apiClient.getUsageLimit(projectId, selectedCli);
      setUsageLimitModal(prev => ({ ...prev, data, isLoading: false }));
    } catch (error: any) {
      console.error('Failed to fetch usage limit:', error);
      setUsageLimitModal(prev => ({
        ...prev,
        data: {
          success: false,
          cli: selectedCli,
          error: error.message || 'Failed to fetch usage limit',
        },
        isLoading: false,
      }));
    }
  }, [projectId, selectedCli]);

  const filteredMessages = useMemo(
    () => {
      // Filter out empty messages
      const filtered = messages.filter((message) => {
        const hasContent = !!message.content?.trim();
        const hasTitle = !!message.title?.trim();

        // Tool messages need content or title to be kept
        if (message.variant === 'tool') {
          return hasContent || hasTitle;
        }

        const isSpecialVariant = ['reasoning', 'secrets_request', 'system'].includes(message.variant ?? '');
        const isAssistantMessage = message.role === 'assistant' && (message.variant === 'message' || !message.variant);
        const shouldKeep = hasContent || isSpecialVariant || isAssistantMessage;
        return shouldKeep;
      });

      // Deduplicate by message ID
      const seenIds = new Set<string>();
      const deduplicated = filtered.filter((message) => {
        if (seenIds.has(message.id)) {
          return false;
        }
        seenIds.add(message.id);
        return true;
      });
      
      return deduplicated;
    },
    [messages],
  );

  // Group messages by consecutive assistant messages
  const groupedMessages = useMemo(() => {
    const groups: Array<{ type: 'user' | 'assistant'; messages: Message[] }> = [];

    filteredMessages.forEach((message, idx) => {
      const isUser = message.role === 'user';
      const lastGroup = groups[groups.length - 1];

      if (!lastGroup || lastGroup.type !== (isUser ? 'user' : 'assistant')) {
        groups.push({
          type: isUser ? 'user' : 'assistant',
          messages: [message],
        });
      } else {
        lastGroup.messages.push(message);
      }
    });
    
    return groups;
  }, [filteredMessages]);

  // Memoize markdown components to prevent recreation on every render
  const markdownComponents = useMemo(() => ({
    p: ({ children }: any) => <p className="mb-1.5 last:mb-0 whitespace-normal text-xs text-primary">{children}</p>,
    h1: ({ children }: any) => <h1 className="text-sm font-bold mb-1.5 mt-3 text-primary">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-sm font-bold mb-1.5 mt-2.5 text-primary">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-xs font-bold mb-1.5 mt-2 text-primary">{children}</h3>,
    h4: ({ children }: any) => <h4 className="text-xs font-bold mb-1 mt-1.5 text-primary">{children}</h4>,
    h5: ({ children }: any) => <h5 className="text-xs font-semibold mb-1 mt-1 text-primary">{children}</h5>,
    h6: ({ children }: any) => <h6 className="text-xs font-semibold mb-0.5 text-primary">{children}</h6>,
    strong: ({ children }: any) => <strong className="font-semibold text-xs text-primary">{children}</strong>,
    em: ({ children }: any) => <em className="italic text-xs text-secondary">{children}</em>,
    code: ({ children }: any) => {
      const text = String(children).trim();

      // Exclude if contains spaces (likely a command like "npm run build")
      const hasSpaces = /\s/.test(text);

      // Check if it looks like a file path:
      // - Contains / and ends with known extension, OR
      // - Ends with known extension and optional line number
      const hasFileExtension = /\.(tsx?|jsx?|css|html|json|md|py|go|rs|java|kt|swift|yml|yaml|toml|sh|env|lock|txt|xml|svg|png|jpg|jpeg|gif|webp)(:?\d+)?$/i.test(text);
      const looksLikeFilePath = text.includes('/') && (hasFileExtension || text.split('/').length > 1);

      // Only treat as file path if it has no spaces AND looks like a file path
      const isFilePath = !hasSpaces && (looksLikeFilePath || hasFileExtension);

      if (isFilePath && onFileClick) {
        // Parse file path and line number
        const match = text.match(/^(.+?)(?::(\d+))?$/);
        const filePath = match ? match[1] : text;
        const lineNumber = match && match[2] ? parseInt(match[2], 10) : undefined;

        return (
          <code
            className="inline-flex items-center align-middle rounded-md border border-primary bg-interactive-secondary px-1 py-0.25 font-mono text-[0.6rem] font-semibold leading-tight text-primary shadow-[0_1px_1.5px_rgba(15,23,42,0.12)] dark:shadow-[0_1px_1.5px_rgba(0,0,0,0.35)] cursor-pointer hover:bg-blue-100 hover:border-blue-400 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:border-blue-600 dark:hover:text-gray-400 transition-colors"
            onClick={() => onFileClick(filePath, lineNumber)}
          >
            {children}
          </code>
        );
      }

      // Provider-specific inline code styling
      const getInlineCodeStyle = () => {
        switch (selectedCli) {
          case 'codex':
            // Codex: Very subtle, blend into text more
            return "inline font-mono text-[0.65rem] font-normal text-secondary/90";
          case 'claude':
            // Claude: Original prominent style
            return "inline-flex items-center align-middle rounded-md border border-primary bg-interactive-secondary px-1 py-0.25 font-mono text-[0.6rem] font-semibold leading-tight text-primary shadow-[0_1px_1.5px_rgba(15,23,42,0.12)] dark:shadow-[0_1px_1.5px_rgba(0,0,0,0.35)]";
          case 'gemini':
          case 'glm':
          default:
            // Default: Same as Claude
            return "inline-flex items-center align-middle rounded-md border border-primary bg-interactive-secondary px-1 py-0.25 font-mono text-[0.6rem] font-semibold leading-tight text-primary shadow-[0_1px_1.5px_rgba(15,23,42,0.12)] dark:shadow-[0_1px_1.5px_rgba(0,0,0,0.35)]";
        }
      };

      return (
        <code className={getInlineCodeStyle()}>
          {children}
        </code>
      );
    },
    pre: ({ children }: any) => (
      <pre className="my-1.5 overflow-x-auto rounded bg-interactive-secondary p-2 text-xs text-primary">
        {children}
      </pre>
    ),
    ul: ({ children }: any) => (
      <ul className="mb-1.5 mt-0 list-disc list-inside space-y-3 text-xs">
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol className="mb-1.5 mt-0 list-decimal space-y-3 text-xs pl-4">
        {children}
      </ol>
    ),
    li: ({ children }: any) => <li className="text-xs text-primary leading-relaxed">{children}</li>,
    a: ({ children, href }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline dark:text-blue-400 text-xs"
      >
        {children}
      </a>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="my-1.5 border-l-4 border-primary py-0.5 pl-3 italic text-xs text-secondary">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-3 border-primary" />,
    table: ({ children }: any) => (
      <div className="my-1.5 overflow-x-auto">
        <table className="min-w-full border border-primary text-xs">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: any) => <thead className="bg-interactive-secondary">{children}</thead>,
    tbody: ({ children }: any) => <tbody>{children}</tbody>,
    tr: ({ children }: any) => <tr className="border-b border-primary">{children}</tr>,
    th: ({ children }: any) => <th className="px-3 py-1.5 text-left font-semibold text-xs">{children}</th>,
    td: ({ children }: any) => <td className="px-3 py-1.5 text-xs">{children}</td>,
  }), [onFileClick]);

  // Memoize renderMessageBody function
  const renderMessageBody = useCallback((message: Message): ReactNode => {
    const variant = message.variant ?? 'message';

    if (variant === 'message') {
      // First, clean up the content by removing empty bullet points
      let cleanedContent = message.content
        // Remove standalone bullet markers (•, -, *) that have no content
        .replace(/^\s*[•\-\*]\s*$/gm, '')
        // Clean up multiple consecutive blank lines
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      // Normalize content: replace single newlines with spaces, but preserve list formatting
      let normalizedContent = cleanedContent
        .split('\n\n')
        .map(paragraph => {
          // Check if paragraph contains numbered list items (e.g., "1. ", "2. ", etc.)
          const hasNumberedList = /^\s*\d+\.\s+/m.test(paragraph);
          
          // Check if paragraph contains bullet list items (e.g., "- ", "* ", "• ")
          const hasBulletList = /^\s*[-\*•]\s+/m.test(paragraph);

          // If it's a list (numbered or bulleted), preserve newlines between items
          if (hasNumberedList || hasBulletList) {
            return paragraph;
          }

          // Otherwise, replace single newlines with spaces
          return paragraph.replace(/\n/g, ' ');
        })
        .join('\n\n');

      // Detect inline numbered lists like "Next: 1) Item 2) Item" and convert to proper markdown
      // Only apply if the list clearly starts with "1) " to avoid matching file references like (file.css:12-42)
      // Must start with "1) " either at beginning or after ": "
      const hasNumberedListStart = /(?:^|:\s+)1\)\s+/.test(normalizedContent);
      const numberListPattern = /\b(\d+)\)\s+/g;
      
      if (hasNumberedListStart && numberListPattern.test(normalizedContent)) {
        // Reset regex
        numberListPattern.lastIndex = 0;

        // Check if there's a prefix before the list (like "Next:")
        const prefixMatch = normalizedContent.match(/^(.*?:)\s*1\)/);
        const prefix = prefixMatch ? prefixMatch[1] : null;

        // Split the content into list items
        const parts = normalizedContent.split(numberListPattern);

        if (parts.length > 2) {
          let result = '';

          // If there's a prefix, add it first
          if (prefix) {
            result = prefix + '\n\n';
            // Remove prefix from first part
            parts[0] = parts[0].replace(prefix, '').trim();
          }

          // Reconstruct as markdown list
          for (let i = 1; i < parts.length; i += 2) {
            const number = parts[i];
            const text = parts[i + 1] ? parts[i + 1].trim() : '';
            if (text) {
              result += `${number}. ${text}\n`;
            }
          }

          normalizedContent = result.trim() + '\n';
        }
      }

      // Detect inline markdown lists where list items are separated by spaces instead of newlines
      // Pattern: "- item   - item   - item" becomes proper multi-line list
      // Only apply if: starts with "- " AND has multiple "   - " patterns (2+ spaces before dash)
      if (normalizedContent.startsWith('- ')) {
        const inlineListPattern = /\s{2,}-\s+/g;
        const matches = normalizedContent.match(inlineListPattern);
        // Only apply if we find at least one occurrence of "  - " (multiple spaces before dash)
        if (matches && matches.length >= 1) {
          // Replace "   - " with newline + "- " to split items onto separate lines
          normalizedContent = normalizedContent.replace(/\s{2,}-\s+/g, '\n- ');
        }
      }

      // Detect Claude's pattern: "**Bold** description - **Bold** description"
      // Convert to proper bulleted list
      const claudeBoldPattern = /\*\*[^*]+\*\*[^-]+-\s*\*\*[^*]+\*\*/;
      if (claudeBoldPattern.test(normalizedContent)) {
        // Split by " - " when followed by "**" (bold marker)
        const items = normalizedContent.split(/\s+-\s+(?=\*\*)/).map(item => item.trim()).filter(Boolean);
        if (items.length > 1) {
          normalizedContent = items.map(item => `- ${item}`).join('\n') + '\n';
        }
      }

      // Detect inline bullet lists with various separators and convert to proper markdown
      // This handles patterns like "text - text - text" or "text; text; text" or even "text  text  text" (multiple spaces)
      if (!normalizedContent.includes('\n-') && !normalizedContent.includes('\n•')) {
        // Try dash-separated (" - ")
        if (normalizedContent.includes(' - ')) {
          const dashCount = (normalizedContent.match(/ - /g) || []).length;
          if (dashCount >= 2) {
            const items = normalizedContent.split(' - ').map(item => item.trim()).filter(Boolean);
            if (items.length > 1) {
              normalizedContent = items.map(item => `- ${item}`).join('\n') + '\n';
            }
          }
        }
        // Try semicolon-separated (";")
        else if (normalizedContent.includes(';')) {
          const semicolonCount = (normalizedContent.match(/;/g) || []).length;
          if (semicolonCount >= 2) {
            const items = normalizedContent.split(';').map(item => item.trim()).filter(Boolean);
            if (items.length > 1) {
              normalizedContent = items.map(item => `- ${item}`).join('\n') + '\n';
            }
          }
        }
        // Try bullet point (•)
        else if (normalizedContent.includes('•')) {
          const bulletCount = (normalizedContent.match(/•/g) || []).length;
          if (bulletCount >= 2) {
            const items = normalizedContent.split('•').map(item => item.trim()).filter(Boolean);
            if (items.length > 1) {
              normalizedContent = items.map(item => `- ${item}`).join('\n') + '\n';
            }
          }
        }
      }

      // Apply provider-specific preprocessing
      let finalContent = normalizedContent;
      if (selectedCli === 'codex') {
        finalContent = preprocessCodexMarkdown(normalizedContent);
      }

      return (
        <div className="text-primary text-xs leading-relaxed break-words overflow-wrap-anywhere whitespace-normal">
          <ReactMarkdown components={markdownComponents}>
            {finalContent}
          </ReactMarkdown>
        </div>
      );
    }

    if (variant === 'tool') {
      const rawTitle = message.title?.trim();
      const rawContent = message.content?.trim();
      const toolDetails = message.toolDetails;
      const isRunning = message.status === 'running';

      let toolName = message.toolName?.trim();
      let arg: string | undefined;

      const parseCandidates = [rawContent, rawTitle];
      for (const candidate of parseCandidates) {
        if (!candidate) continue;
        const bracketMatch = candidate.match(/^\[([^\]]+)\]\s*(.*)$/);
        if (bracketMatch) {
          toolName = toolName ?? bracketMatch[1];
          arg = bracketMatch[2]?.trim() || arg;
          break;
        }

        const runMatch = candidate.match(/^Run\s+(.+)$/);
        if (runMatch) {
          toolName = 'Run';
          arg = runMatch[1].trim();
          break;
        }
      }

      if (!toolName && toolDetails?.label) {
        toolName = toolDetails.label;
      }

      if (toolName && /^Ran command$/i.test(toolName)) {
        toolName = 'Run';
      }

      if (!arg && toolDetails?.details) {
        arg = toolDetails.details;
      }

      const displayName = getDisplayName(toolName ?? 'Tool');
      const iconToolName = toolName ?? 'Tool';
      const fallbackContent = rawTitle || rawContent || toolDetails?.label || 'Tool';

      const clickableTools = new Set(['Read', 'Write', 'Edit', 'MultiEdit', 'Delete']);
      const allowFileClick = toolName ? clickableTools.has(toolName) : false;
      const hasArg = typeof arg === 'string' && arg.length > 0;
      const expanded = expandedToolMessages[message.id] ?? false;

      const trimmedArg = hasArg && arg ? arg.trim() : '';
      const previewSource = trimmedArg.replace(/\s+/g, ' ');
      const maxPreviewLength = 50;
      const shouldTruncate = !allowFileClick && previewSource.length > maxPreviewLength;
      const truncatedArg = shouldTruncate
        ? `${previewSource.slice(0, maxPreviewLength)}…`
        : previewSource;
      // For running tools with file paths, check if arg looks incomplete
      // Hide if: running AND (ends with slash OR has no extension)
      const looksIncomplete = isRunning && arg && (arg.endsWith('/') || (!arg.includes('.') && arg.length < 50));

      const displayArg = looksIncomplete
        ? ''  // Don't show incomplete path
        : allowFileClick
        ? (arg ?? '')
        : expanded || !shouldTruncate
        ? (arg ?? '')
        : truncatedArg;
      const codeBaseClass = 'inline-flex items-center align-middle rounded-md border border-primary bg-interactive-secondary text-secondary px-1.5 py-0.25 font-mono text-[0.65rem] font-bold leading-tight shadow-[0_1px_2px_rgba(15,23,42,0.16)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.45)]';
      const interactiveClass = 'cursor-pointer hover:bg-interactive-hover hover:border-primary hover:text-gray-700 dark:hover:bg-interactive-secondary dark:hover:border-primary dark:hover:text-gray-400 transition-colors';
      const passiveClass = 'cursor-text transition-colors';
      const allowToggle = shouldTruncate && hasArg && !looksIncomplete;
      const codeClassName = `${codeBaseClass} ${allowFileClick || allowToggle ? interactiveClass : passiveClass}`;

      if (!toolName && !hasArg) {
        return (
          <div className="text-xs text-tertiary">
            {fallbackContent}
          </div>
        );
      }

      const handleToggle = () => {
        if (!allowToggle || !hasArg) return;
        setExpandedToolMessages((prev) => ({
          ...prev,
          [message.id]: !expanded,
        }));
      };

      const handleToggleKey = (event: KeyboardEvent<HTMLElement>) => {
        if (!allowToggle || !hasArg) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleToggle();
        }
      };

      const handleFileNavigation = () => {
        if (!allowFileClick || !hasArg || !arg) return;
        const match = arg.match(/^(.+?)(?::(\d+))?$/);
        const filePath = match ? match[1] : arg;
        const lineNumber = match && match[2] ? parseInt(match[2], 10) : undefined;
        if (onFileClick) {
          onFileClick(filePath, lineNumber);
        }
      };

      return (
        <div className="relative flex items-start gap-2 text-xs text-secondary max-w-full overflow-hidden">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-interactive-secondary px-1.5 py-0.25 align-middle text-[0.65rem] font-semibold text-secondary flex-shrink-0">
            <ToolIcon
              toolName={iconToolName}
              className={`h-3 w-3 text-tertiary ${isRunning ? 'tool-shiny-wrapper' : ''}`}
            />
            <span className={`tracking-tight ${isRunning ? 'tool-shiny-wrapper' : ''}`}>{displayName}</span>
          </div>
          {hasArg && !looksIncomplete && (
            <code
              className={`${codeClassName} ${allowFileClick ? 'break-all' : expanded ? 'whitespace-pre-wrap break-words' : 'truncate'}`}
              onClick={allowFileClick ? handleFileNavigation : allowToggle ? handleToggle : undefined}
              onKeyDown={!allowFileClick && allowToggle ? handleToggleKey : undefined}
              role={!allowFileClick && allowToggle ? 'button' : undefined}
              tabIndex={!allowFileClick && allowToggle ? 0 : undefined}
              title={!allowFileClick && !expanded && shouldTruncate && arg ? arg : undefined}
            >
              <span className={isRunning ? 'tool-shiny-wrapper' : ''}>{displayArg}</span>
            </code>
          )}
          {!allowFileClick && allowToggle && (
            <button
              type="button"
              onClick={handleToggle}
              onKeyDown={handleToggleKey}
              className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-secondary hover:text-primary focus:outline-none flex-shrink-0"
              aria-label={expanded ? 'Collapse tool argument' : 'Expand tool argument'}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>
      );
    }

    if (variant === 'secrets_request' && message.secretsData) {
      return (
        <SecretInputInline
          secrets={message.secretsData.secrets}
          sessionId={message.secretsData.sessionId}
          projectId={projectId}
          message={message.content}
          requestId={message.secretsData.requestId}
        />
      );
    }

    if (variant === 'integration_prompt' && message.actionData) {
      return (
        <div className="space-y-3">
          <div className="text-xs text-primary leading-relaxed break-words overflow-wrap-anywhere whitespace-normal">
            {message.content}
          </div>
          <button
            onClick={() => onOpenIntegration?.(message.actionData!.integration)}
            className="px-4 py-2 rounded-lg font-poppins transition-colors text-xs bg-interactive-secondary dark:bg-secondary text-primary dark:text-white hover:bg-interactive-hover dark:hover:bg-elevated border border-primary"
          >
            {message.actionData.buttonText || 'Connect Integration'}
          </button>
        </div>
      );
    }

    if (variant === 'system') {
      const meta = (message.metadata || {}) as any;
      if (meta?.systemType === 'turn_diff' && meta?.turnDiff) {
        const diff = meta.turnDiff;
        const files = Array.isArray(diff.files) ? diff.files : [];
        const totals = files.reduce(
          (acc: { add: number; del: number }, f: any) => ({
            add: acc.add + (Number(f.additions || 0)),
            del: acc.del + (Number(f.deletions || 0)),
          }),
          { add: 0, del: 0 },
        );
        const currentState = restoreState?.[diff.commitHash] || 'idle';
        const restoreDisabled = !canEdit; // read-only 세션에선 복구 동작 비활성화

        return (
          <div className="rounded-lg border border-primary bg-secondary dark:bg-secondary px-3 py-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onOpenDiff?.(diff)}
              className="flex-1 min-w-0 text-left hover:opacity-70 transition-opacity"
            >
              <div className="text-xs font-medium text-primary truncate">{message.title || 'Git Changes'}</div>
              <div className="text-[10px] text-tertiary">
                {files.length} {files.length === 1 ? 'file' : 'files'} changed · <span className="text-green-600 dark:text-green-500">+{totals.add}</span> <span className="text-red-600 dark:text-red-500">−{totals.del}</span>
              </div>
            </button>
            <div className="flex items-center gap-2 flex-shrink-0">
              {currentState === 'idle' && (
                <button
                  type="button"
                  onClick={(e) => {
                    if (restoreDisabled) return;
                    e.stopPropagation();
                    onRestoreDiff?.(diff);
                  }}
                  disabled={restoreDisabled}
                  title={restoreDisabled ? 'Activate this chat to restore' : 'Restore'}
                  className="px-2.5 py-1 text-[11px] rounded-md bg-interactive-secondary hover:bg-interactive-hover disabled:opacity-50 disabled:cursor-not-allowed text-primary border border-primary whitespace-nowrap"
                >
                  Restore
                </button>
              )}
              {currentState === 'loading' && (
                <span className="px-2.5 py-1 text-[11px] text-tertiary">Restoring...</span>
              )}
              {currentState === 'confirming' && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      if (restoreDisabled) return;
                      e.stopPropagation();
                      onConfirmRestore?.(diff);
                    }}
                    disabled={restoreDisabled}
                    title={restoreDisabled ? 'Activate this chat to restore' : 'Confirm restore'}
                    className="px-2.5 py-1 text-[11px] rounded-md bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white border border-green-600 whitespace-nowrap"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      if (restoreDisabled) return;
                      e.stopPropagation();
                      onCancelRestore?.(diff);
                    }}
                    disabled={restoreDisabled}
                    title={restoreDisabled ? 'Activate this chat to restore' : 'Cancel'}
                    className="px-2.5 py-1 text-[11px] rounded-md bg-interactive-secondary hover:bg-interactive-hover disabled:opacity-50 disabled:cursor-not-allowed text-primary border border-primary whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        );
      }
      if (meta?.systemType === 'restore') {
        return (
          <div className="rounded-lg border border-green-600/50 dark:border-green-700/50 bg-green-50 dark:bg-green-900/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-500" />
              <div className="text-xs font-medium text-green-700 dark:text-green-300">
                {message.title || 'Restore'}
                {message.content && (
                  <>
                    <span className="mx-1.5">-</span>
                    <span className="font-normal">{message.content}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      }
      return (
        <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-line">{message.content}</div>
      );
    }

    return (
      <div className="text-xs text-tertiary">
        {message.content}
      </div>
    );
  }, [expandedToolMessages, markdownComponents, onFileClick, projectId]);

  return (
    <div
      style={{ width: '30%' }}
      className="h-full flex flex-col bg-primary"
    >
      <div className="bg-primary p-4 h-[46px] flex items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateHome}
            className="flex items-center justify-center w-8 h-8 text-tertiary hover:text-secondary hover:bg-interactive-hover rounded-full transition-colors liquid"
            title="Back to home"
          >
            <img src="/assets/logo_svg/clink_symbol_black.svg" alt="Back to home" className="w-4 h-4 dark:invert" />
          </button>
          <SessionDropdown
            sessions={sessions}
            activeChatRoomId={activeChatRoomId}
            onSessionSwitch={onSessionSwitch}
            onNewSession={onNewSession}
            onRenameSession={onRenameSession}
            onCloseSession={onCloseSession}
            isLoading={isLoading}
            messages={allMessages}
            projectName={projectName}
          />
        </div>
      </div>

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3 messages-container bg-primary">
        <AnimatePresence mode="wait">
          <motion.div
            key={containerKeyRef.current}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* Resume Error Indicator */}
            {resumeError && (
              <div className="mb-4">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-900 dark:text-red-400">Workspace Resume Failed</p>
                      <p className="text-xs text-red-700 dark:text-red-400 mt-1">{resumeError}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
          {groupedMessages.map((group, groupIndex) => {
            if (group.type === 'user') {
              // Check if this is the first user message group and IMPORT project
              const isFirstUserMessage = groupIndex === 0;
              const isImportProject = projectType === 'dev';
              const showRepoHeader = isFirstUserMessage && isImportProject && importedRepoUrl;

              // Extract repo name from GitHub URL (e.g., "OPACTOR-DEV/splice" from "https://github.com/OPACTOR-DEV/splice")
              const repoName = importedRepoUrl ? importedRepoUrl.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '') : '';

              // Render user messages as before
              return group.messages.map((message) => {
                const hasUserMsgAnimated = animatedMessagesRef.current.has(`user-${message.id}`);
                if (!hasUserMsgAnimated) {
                  animatedMessagesRef.current.add(`user-${message.id}`);
                }

                return (
                <div className="flex flex-col items-end mb-4" key={message.id}>
                  {showRepoHeader && (
                    <div className="flex items-center gap-1.5 mb-2 text-tertiary text-[11px]">
                      <svg
                        className="w-3 h-3"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                      <span className="font-medium">{repoName} imported</span>
                    </div>
                  )}
                  <motion.div
                    initial={hasUserMsgAnimated ? false : { opacity: 0, y: 15, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="max-w-[80%]"
                  >
                    <div className="bg-interactive-secondary text-primary text-xs rounded-2xl px-3 py-2 shadow-sm border border-primary">
                      {/* Local files preview */}
                      {message.localFiles && message.localFiles.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          {message.localFiles.filter(file => file instanceof File).map((file, index) => (
                            <div key={index} className="w-20 h-20 overflow-hidden rounded-md border border-primary bg-primary cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setSelectedImageUrl(URL.createObjectURL(file))}>
                              <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Server images */}
                      {message.images && message.images.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          {message.images.map((img, index) => (
                            <div key={index} className="w-16 h-16 overflow-hidden rounded-md border border-primary bg-primary cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setSelectedImageUrl(img.url)}>
                              <img
                                src={img.url}
                                alt={img.originalName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="prose prose-xs max-w-none break-words text-xs">
                        {message.content}
                      </div>
                    </div>
                  </motion.div>
                </div>
              );
              });
            } else {
              // Check if this is the last assistant group and we're loading
              const isLastGroup = groupIndex === groupedMessages.length - 1;

              // Only show loading dots if loading AND no messages have arrived yet
              // Hide dots as soon as any message (content, reasoning, or tool) arrives
              const hasAnyMessage = group.messages.length > 0 && group.messages.some((msg) => {
                const variant = msg.variant ?? 'message';
                // Check for any non-empty message: content, reasoning, or tool
                if (variant === 'message' && msg.content?.trim().length > 0) return true;
                if (variant === 'reasoning') return true;
                if (variant === 'tool') return true;
                return false;
              });
              const showLoadingDots = isLoading && isLastGroup && !hasAnyMessage;

              // Render assistant group with Clink header for every assistant group
              return (
                <div className="mb-4" key={`group-${groupIndex}`}>
                  {/* Clink header - render for all assistant groups, keep it stable (no animation) */}
                  <div className="flex items-center gap-2 mb-3">
                    <img
                      src="/assets/logo_svg/clink_app_icon.svg"
                      alt="Clink"
                      className="w-4 h-4 dark:hidden"
                    />
                    <img
                      src="/assets/logo_svg/clink_app_icon_white.svg"
                      alt="Clink"
                      className="w-4 h-4 hidden dark:block"
                    />
                    <span className="text-base font-semibold text-sm text-primary tracking-tight font-poppins">
                      Clink
                    </span>
                    {showLoadingDots && (
                      <AnimatedEllipsis className="text-tertiary ml-1" />
                    )}
                  </div>

                  {/* Assistant messages */}
                  <div className="space-y-3 pl-[1.5rem]">
                    {(() => {
                      const items: ReactNode[] = [];

                      group.messages.forEach((message) => {
                        const variant = message.variant ?? 'message';
                        const isReasoningMessage = variant === 'reasoning';
                        const isSystemMessage = variant === 'system';

                        // Skip empty system messages that don't have metadata
                        // (System messages with metadata like turn_diff are rendered specially)
                        if (isSystemMessage && !message.content?.trim() && !message.metadata) {
                          return;
                        }

                        if (isReasoningMessage) {
                          if (message.isStreaming) {
                            const startedAt =
                              message.timestamp instanceof Date
                                ? message.timestamp
                                : new Date(
                                    typeof message.timestamp === 'string'
                                      ? message.timestamp
                                      : Date.now(),
                                  );

                            const thinkingKey = `${message.id}-thinking`;
                            const hasThinkingAnimated = animatedMessagesRef.current.has(thinkingKey);
                            if (!hasThinkingAnimated) {
                              animatedMessagesRef.current.add(thinkingKey);
                            }
                            
                            items.push(
                              <motion.div
                                key={thinkingKey}
                                initial={hasThinkingAnimated ? false : { opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <div className="flex items-start gap-2 text-xs text-tertiary">
                                  <span className="pt-0.5 animate-pulse text-tertiary">
                                    <Brain className="h-3.5 w-3.5" />
                                  </span>
                                  <ThinkingIndicator startedAt={startedAt} />
                                </div>
                              </motion.div>
                            );
                          }
                          return;
                        }

                        const hasAnimated = animatedMessagesRef.current.has(message.id);
                        if (!hasAnimated) {
                          animatedMessagesRef.current.add(message.id);
                        }
                        
                        items.push(
                          <motion.div
                            key={message.id}
                            initial={hasAnimated ? false : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            {renderMessageBody(message)}
                          </motion.div>
                        );
                      });

                      return items;
                    })()}
                  </div>
                </div>
              );
            }
          })}

          {/* Show Clink logo when loading and last group is user (waiting for assistant response) */}
          {isLoading && groupedMessages.length > 0 && groupedMessages[groupedMessages.length - 1]?.type === 'user' && (
            <div className="mb-4" key="assistant-loading">
              <div className="flex items-center gap-2 mb-3">
                <img
                  src="/assets/logo_svg/clink_app_icon.svg"
                  alt="Clink"
                  className="w-4 h-4 dark:hidden"
                />
                <img
                  src="/assets/logo_svg/clink_app_icon_white.svg"
                  alt="Clink"
                  className="w-4 h-4 hidden dark:block"
                />
                <span className="text-base font-semibold text-sm text-primary tracking-tight font-poppins">
                  Clink
                </span>
                <AnimatedEllipsis className="text-tertiary ml-1" />
              </div>
            </div>
          )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <div className="pb-4 px-4 bg-primary">
        {/* IFrame Errors - show above input (Vite, Runtime, Promise only) */}
        {/* Hide during streaming, loading, fixing errors, or waiting for rebuild */}
        {iframeErrors.length > 0 &&
         !(isLoading && !streamingState?.turnComplete) &&
         !isFixingErrors &&
         Date.now() >= hideErrorsUntil && (
          <ErrorSummaryCard
            errors={iframeErrors}
            onOpenDetail={onOpenErrorDetail}
            onFix={onFixError}
          />
        )}

        {projectStatus === 'archived' && !isResuming && !isLoading ? (
          <div className="rounded-2xl border border-primary bg-secondary p-4 shadow-sm">
            <div className="flex items-center gap-2 text-tertiary">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-xs">This project has been archived. Chat is no longer available.</p>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!isLoading && !isResuming && canEdit) {
                void onSubmit();
              }
            }}
            className="flex flex-col gap-3 rounded-2xl border border-primary bg-secondary p-3 shadow-sm"
          >
          {/* Read-only 안내문은 입력 영역 내부에서만 표기 (중복 방지) */}
          {/* Image previews inside input */}
          {uploadedImages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-2">
              {uploadedImages.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={URL.createObjectURL(image.file)}
                    alt="attachment"
                    className="w-12 h-12 object-cover rounded-md border border-primary cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setSelectedImageUrl(URL.createObjectURL(image.file))}
                  />
                  {image.uploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center pointer-events-none">
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    </div>
                  )}
                  {image.error && (
                    <div className="absolute inset-0 bg-red-500/80 rounded-md flex items-center justify-center pointer-events-none">
                      <AlertCircle className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveImage(index)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-interactive-primary hover:bg-interactive-hover text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div data-state="closed" style={{ cursor: (isLoading || isResuming || !canEdit) ? 'not-allowed' : 'text' }}>
            <div className="relative flex flex-1 items-center justify-center">
              {(isLoading || isResuming) ? (
                <div className="inline-flex items-center gap-2 py-2">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-foreground dark:bg-foreground"
                          animate={{
                            scale: [1, 1.4, 1],
                            opacity: [0.4, 1, 0.4],
                          }}
                          transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            delay: i * 0.15,
                            ease: 'easeInOut',
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-primary font-medium">
                      {isResuming ? 'Setting up workspace...' : 'Clink is working...'}
                    </span>
                </div>
              ) : (
                canEdit ? (
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(event) => onInputChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        // Check for composing state (IME input like Korean, Japanese, Chinese)
                        if (event.nativeEvent.isComposing || event.keyCode === 229) {
                          return;
                        }
                        event.preventDefault();
                        if (!isResuming && canEdit) {
                          void onSubmit();
                        }
                      }
                    }}
                    className="flex w-full resize-none bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-xs leading-relaxed overflow-y-auto p-0 border-0"
                    id="chatinput"
                    placeholder={'Ask Clink...'}
                    style={{ minHeight: '40px', height: '40px', maxHeight: '40px' }}
                  />
                ) : (
                  <div className="w-full py-2 text-center text-xs text-secondary">This session is read-only.</div>
                )
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <div className="flex items-center gap-3 relative" ref={dropupRef}>
              <button
                type="button"
                className={`flex items-center justify-center w-7 h-7 text-tertiary rounded-full transition-all liquid ${
                  (isLoading || isResuming || !canEdit) ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:bg-interactive-hover'
                }`}
                title={(isLoading || isResuming || !canEdit) ? 'Disabled' : 'Add content'}
                onClick={() => !(isLoading || isResuming || !canEdit) && setIsDropupOpen(!isDropupOpen)}
                disabled={isLoading || isResuming || !canEdit}
              >
                <motion.div
                  animate={{ rotate: isDropupOpen ? 45 : 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                >
                  <Plus className="h-4 w-4 text-primary dark:text-primary" />
                </motion.div>
              </button>
              <span className="text-[11px] uppercase tracking-wide text-tertiary">{projectType === 'dev' ? 'DEV' : 'BASE'}</span>

              {/* Dropup menu */}
              <AnimatePresence>
                {isDropupOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-0 mb-2 bg-primary rounded-lg shadow-lg border border-primary p-1 min-w-[160px] z-50"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        fileInputRef.current?.click();
                        setIsDropupOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-secondary hover:bg-interactive-hover flex items-center gap-2 transition-colors rounded-md"
                    >
                      <ImageIcon className="h-4 w-4 text-tertiary" />
                      Image Assets
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                onChange={onImageUpload}
                className="hidden"
                disabled={isLoading || isResuming || !canEdit}
              />
            </div>

            <div className="ml-auto flex items-center gap-2">
              {(isLoading || isResuming) ? (
                <>
                  {!isResuming && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <ProgressRing
                          percent={selectedCli === 'codex' ? usagePercent : null}
                          size={16}
                          strokeWidth={2}
                          isGray={selectedCli !== 'codex'}
                          onClick={handleUsageLimitClick}
                        />
                        {selectedCli === 'glm' ? (
                          <Image
                            src={theme === 'dark' ? '/assets/agents/zai_light.png' : '/assets/agents/zai_dark.png'}
                            alt={ASSISTANT_OPTIONS[selectedCli].label}
                            width={16}
                            height={16}
                            className="w-4 h-4 rounded-sm"
                          />
                        ) : (
                          <img
                            src={`/assets/provider/${selectedCli === 'codex' ? 'openai' : selectedCli}.png`}
                            alt={ASSISTANT_OPTIONS[selectedCli].label}
                            className="w-4 h-4 rounded-sm"
                          />
                        )}
                        <span className="text-xs text-tertiary">
                          {ASSISTANT_OPTIONS[selectedCli].models.find((m) => m.value === selectedModel)?.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1">
                        <Clock className="w-3.5 h-3.5 text-tertiary" />
                        <span className="text-xs text-secondary font-medium tabular-nums">
                          {elapsedSeconds}s
                        </span>
                      </div>
                      {onCancel && isLoading && !isInitialPromptRunning && (
                        <button
                          type="button"
                          aria-label="Cancel streaming"
                          title="Cancel"
                          className="flex liquid w-7 h-7 items-center justify-center rounded-full transition-all duration-150 ease-out bg-interactive-secondary hover:bg-interactive-hover cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={isCancelling}
                          onClick={async () => {
                            if (isCancelling) return;
                            try {
                              setIsCancelling(true);
                              await onCancel();
                            } catch (err) {
                              try {
                                const msg = err instanceof Error && err.message ? err.message : '취소에 실패했어요. 다시 시도해 주세요.';
                                toast.error(msg);
                              } catch {}
                            } finally {
                              setIsCancelling(false);
                            }
                          }}
                        >
                          {isCancelling ? (
                            <Loader2 className="h-4 w-4 text-primary animate-spin" />
                          ) : (
                            <Square className="h-4 w-4 text-primary" />
                          )}
                        </button>
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="relative flex items-center gap-1.5" ref={modelDropdownRef}>
                    <ProgressRing
                      percent={selectedCli === 'codex' ? usagePercent : null}
                      size={16}
                      strokeWidth={2}
                      isGray={selectedCli !== 'codex'}
                      onClick={handleUsageLimitClick}
                    />
                    {selectedCli === 'glm' ? (
                      <Image
                        src={theme === 'dark' ? '/assets/agents/zai_light.png' : '/assets/agents/zai_dark.png'}
                        alt={ASSISTANT_OPTIONS[selectedCli].label}
                        width={16}
                        height={16}
                        className="w-4 h-4 rounded-sm"
                      />
                    ) : (
                      <img
                        src={`/assets/provider/${selectedCli === 'codex' ? 'openai' : selectedCli}.png`}
                        alt={ASSISTANT_OPTIONS[selectedCli].label}
                        className="w-4 h-4 rounded-sm"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                      className="flex items-center gap-1.5 text-xs text-primary dark:text-primary hover:text-secondary dark:hover:text-secondary transition-colors cursor-pointer"
                    >
                      <span className="leading-[1] -translate-y-[1.5px]">{ASSISTANT_OPTIONS[selectedCli].models.find((m) => m.value === selectedModel)?.label}</span>
                      <ChevronUp className={`h-3 w-3 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Model Dropdown */}
                    <AnimatePresence>
                      {isModelDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute bottom-full left-0 right-0 mb-2 bg-primary rounded-lg shadow-lg border border-primary p-1 z-50"
                        >
                          {ASSISTANT_OPTIONS[selectedCli].models.map((model) => (
                            <button
                              key={model.value}
                              type="button"
                              onClick={() => {
                                onModelChange(model.value);
                                setIsModelDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-left text-xs transition-colors rounded-md ${
                                selectedModel === model.value
                                  ? 'text-primary font-medium bg-interactive-hover'
                                  : 'text-secondary hover:bg-interactive-hover hover:text-primary'
                              }`}
                            >
                              {model.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button
                    type="submit"
                    className="flex liquid w-7 h-7 items-center justify-center rounded-full transition-all duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-30 bg-interactive-secondary hover:bg-interactive-hover"
                    disabled={isLoading || !canEdit || (!input.trim() && uploadedImages.length === 0)}
                  >
                    <ArrowUp className="h-4 w-4 text-primary" />
                  </button>
                </>
              )}
            </div>
          </div>
        </form>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={onImageUpload}
        disabled={!canEdit || isLoading || isResuming}
      />

      <OptionsModal
        isOpen={isOptionsModalOpen}
        onClose={() => setIsOptionsModalOpen(false)}
        selectedCli={selectedCli}
        onAssistantTabSelect={onAssistantTabSelect}
        selectedModel={selectedModel}
        onModelChange={onModelChange}
        selectedEffort={selectedEffort}
        onEffortChange={onEffortChange}
      />

      <UsageLimitModal
        isOpen={usageLimitModal.isOpen}
        onClose={() => setUsageLimitModal({ isOpen: false, data: null, isLoading: false })}
        cli={selectedCli}
        data={usageLimitModal.data}
        isLoading={usageLimitModal.isLoading}
      />

      {/* Image Modal */}
      {selectedImageUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedImageUrl(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedImageUrl(null)}
              className="absolute -top-10 right-0 w-8 h-8 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={selectedImageUrl}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
};
