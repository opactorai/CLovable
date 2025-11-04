'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, ScreenShare, ChartLine, Square, RotateCcw, Monitor, Settings, CodeXml, Loader2, ExternalLink, RefreshCw, Maximize2, Minimize2, Smartphone, Tablet, Rocket, List, Terminal as TerminalIcon } from 'lucide-react';
import { CodePanel, CodePanelProps } from './CodePanel';
import { PreviewRefreshIndicator } from './PreviewRefreshIndicator';
import PublishModal, { PublishState } from './PublishModal';
import AnalyticsTab from '@/components/settings/tabs/AnalyticsTab';
import type { StreamingState } from '@/types/streaming';
import { useBuildTheme } from '@/contexts/BuildThemeContext';
import type { IFrameError } from './ErrorCard';

const SupabaseIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 109 113"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627H99.1935C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z"
      fill="url(#supabase-gradient-a)"
    />
    <path
      d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627H99.1935C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z"
      fill="url(#supabase-gradient-b)"
      fillOpacity="0.2"
    />
    <path
      d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z"
      fill="#3ECF8E"
    />
    <defs>
      <linearGradient
        id="supabase-gradient-a"
        x1="53.9738"
        y1="54.974"
        x2="94.1635"
        y2="71.8295"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#249361" />
        <stop offset="1" stopColor="#3ECF8E" />
      </linearGradient>
      <linearGradient
        id="supabase-gradient-b"
        x1="36.1558"
        y1="30.578"
        x2="54.4844"
        y2="65.0806"
        gradientUnits="userSpaceOnUse"
      >
        <stop />
        <stop offset="1" stopOpacity="0" />
      </linearGradient>
    </defs>
  </svg>
);

type ViewportSize = 'desktop' | 'tablet' | 'mobile';

const VIEWPORT_SIZES = {
  desktop: { width: '100%', label: 'Desktop' },
  tablet: { width: '768px', label: 'Tablet' },
  mobile: { width: '375px', label: 'Mobile' },
};

const GithubIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

interface PreviewPanelProps {
  previewUrl: string | null;
  projectType?: 'base' | 'dev';
  productionUrl?: string | null;
  railwayProjectId?: string | null;
  railwayServiceId?: string | null;
  expectedDomain?: string;
  railwayDeploymentStatus?: 'PENDING' | 'BUILDING' | 'SUCCESS' | 'FAILED' | null;
  railwayMessage?: string;
  railwayUrl?: string | null;
  railwayErrorLogs?: string | null;
  onCheckRailwayStatus?: () => Promise<void>;
  previewNonce?: number;
  isPreviewLoading: boolean;
  isPreviewRunning: boolean;
  projectStatus?: 'creating' | 'active' | 'failed' | 'stopped' | 'archived' | 'starting';
  onStartPreview: () => void;
  onStopPreview: () => void;
  onPublishButtonClick: () => void;
  onPublishPanelClose: () => void;
  isPublishPanelOpen: boolean;
  publishState: PublishState;
  userPlan?: 'free' | 'pro' | 'full';
  publishDomain: string;
  subdomainName: string;
  currentSubdomain: string | null;
  onSubdomainChange: (subdomain: string) => void;
  onUpdatePublish: () => void;
  onUnpublish: () => void;
  canUpdate: boolean;
  canUnpublish: boolean;
  publishError?: string | null;
  onOpenGithub?: () => void;
  onOpenSupabase?: () => void;
  onOpenSettings?: () => void;
  onOpenCustomDomain?: () => void;
  onOpenAnalytics?: () => void;
  activeView: 'preview' | 'code' | 'analytics' | 'terminal';
  onViewChange: (view: 'preview' | 'code' | 'analytics' | 'terminal') => void;
  codePanelProps?: CodePanelProps;
  streamingState?: StreamingState;
  sandboxId?: string | null;
  projectId: string;
  domainSuffix?: string;
  appRoutes: string[];
  supabaseConnected?: boolean;
  supabaseProjectRef?: string | null;
  serverRestartStatus?: {
    status: 'restarting' | 'completed' | 'failed' | null;
    message: string;
  };
  onSendPromptToAgent?: (prompt: string) => void;
  onRailwayUnpublishSuccess?: () => Promise<void>;
  onRailwayDeploySuccess?: () => Promise<void>;
  onIFrameError?: (error: IFrameError) => void;
  onIFrameConsole?: (log: IFrameError) => void;
  onIFrameSuccess?: () => void;
  iframeErrors?: IFrameError[];
  onOpenErrorDetail?: () => void;
  onFixError?: () => void;
}

export const PreviewPanel = ({
  previewUrl,
  projectType,
  productionUrl,
  railwayProjectId,
  railwayServiceId,
  expectedDomain,
  railwayDeploymentStatus,
  railwayMessage,
  railwayUrl,
  railwayErrorLogs,
  onCheckRailwayStatus,
  previewNonce,
  isPreviewLoading,
  isPreviewRunning,
  projectStatus,
  onStartPreview,
  onStopPreview,
  onPublishButtonClick,
  onPublishPanelClose,
  isPublishPanelOpen,
  publishState,
  userPlan = 'free',
  publishDomain,
  subdomainName,
  currentSubdomain,
  onSubdomainChange,
  onUpdatePublish,
  onUnpublish,
  canUpdate,
  canUnpublish,
  publishError,
  onOpenGithub,
  onOpenSupabase,
  onOpenSettings,
  onOpenCustomDomain,
  onOpenAnalytics,
  activeView,
  onViewChange,
  codePanelProps,
  streamingState,
  sandboxId,
  projectId,
  domainSuffix,
  appRoutes,
  supabaseConnected,
  supabaseProjectRef,
  serverRestartStatus,
  onSendPromptToAgent,
  onRailwayUnpublishSuccess,
  onRailwayDeploySuccess,
  onIFrameError,
  onIFrameConsole,
  onIFrameSuccess,
  iframeErrors = [],
  onOpenErrorDetail,
  onFixError,
}: PreviewPanelProps) => {
  const { theme } = useBuildTheme();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const routesButtonRef = useRef<HTMLButtonElement | null>(null);
  const routesDropdownRef = useRef<HTMLDivElement | null>(null);
  const supabaseButtonRef = useRef<HTMLButtonElement | null>(null);
  const supabaseDropdownRef = useRef<HTMLDivElement | null>(null);
  const [isSupabaseDropdownOpen, setIsSupabaseDropdownOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [editablePathValue, setEditablePathValue] = useState('/');
  const [viewportSize, setViewportSize] = useState<ViewportSize>('desktop');
  const [isRoutesDropdownOpen, setIsRoutesDropdownOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Terminal states
  const [terminalLogs, setTerminalLogs] = useState<string>('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const terminalContentRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledToBottomRef = useRef(false);
  const [isRestarting, setIsRestarting] = useState(false);

  // Restart dev server
  const handleRestartServer = async () => {
    if (projectType !== 'dev') return;

    setIsRestarting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const token = localStorage.getItem('token');

      if (!token) {
        setTerminalLogs((prev) => prev + '\nError: Not authenticated. Please login.');
        return;
      }

      setTerminalLogs((prev) => prev + '\n[System] Restarting server...');

      const response = await fetch(`${apiUrl}/api/projects/${projectId}/restart-server`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        setTerminalLogs((prev) => prev + `\n[Error] Failed to restart server: ${error.message || response.statusText}`);
        return;
      }

      const data = await response.json();
      setTerminalLogs((prev) => prev + `\n[System] ${data.message || 'Server restarted successfully'}`);

      // Refresh logs after restart
      setTimeout(() => fetchLogs(), 1000);
    } catch (error) {
      setTerminalLogs((prev) => prev + `\n[Error] ${error instanceof Error ? error.message : 'Failed to restart server'}`);
    } finally {
      setIsRestarting(false);
    }
  };

  // Fetch server logs from sandbox via backend API
  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const token = localStorage.getItem('token');

      if (!token) {
        setTerminalLogs('Error: Not authenticated. Please login.');
        return;
      }

      const response = await fetch(`${apiUrl}/api/projects/${projectId}/logs?lines=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        setTerminalLogs(`Error: HTTP ${response.status}\n${error.message || response.statusText}`);
        return;
      }

      const data = await response.json();

      if (data.success) {
        setTerminalLogs(data.logs || 'No logs available');
      } else {
        setTerminalLogs(`Error: ${data.message || 'Failed to fetch logs'}\n${data.error || ''}`);
      }
    } catch (error) {
      setTerminalLogs(`Error: ${error instanceof Error ? error.message : 'Failed to fetch logs'}\n\nCheck browser console for details.`);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Poll logs every 2 seconds when terminal view is active
  useEffect(() => {
    if (activeView !== 'terminal') return;

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);

    return () => clearInterval(interval);
  }, [activeView, projectId]);

  // Auto-scroll to bottom on first access
  useEffect(() => {
    if (activeView === 'terminal' && !hasScrolledToBottomRef.current && terminalContentRef.current) {
      terminalContentRef.current.scrollTop = terminalContentRef.current.scrollHeight;
      hasScrolledToBottomRef.current = true;
    }

    // Reset flag when leaving terminal view
    if (activeView !== 'terminal') {
      hasScrolledToBottomRef.current = false;
    }
  }, [activeView, terminalLogs]);

  // Extract path from previewUrl
  useEffect(() => {
    if (previewUrl) {
      try {
        const url = new URL(previewUrl);
        const path = url.pathname || '/';
        setCurrentPath(path);
        setEditablePathValue(path);
      } catch (e) {
        setCurrentPath('/');
        setEditablePathValue('/');
      }
    }
  }, [previewUrl]);

  // Track iframe load
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      setIsRefreshing(false);
    };

    iframe.addEventListener('load', handleLoad);

    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, []);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Send theme to iframe when it loads or theme changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const sendTheme = () => {
      try {
        iframe.contentWindow?.postMessage(
          { type: 'theme-change', theme },
          '*'
        );
      } catch (error) {
        console.error('Failed to send theme to iframe:', error);
      }
    };

    // Send immediately
    sendTheme();

    // Send after iframe loads
    iframe.addEventListener('load', sendTheme);

    return () => {
      iframe.removeEventListener('load', sendTheme);
    };
  }, [theme]);

  // Listen for iframe messages (errors, console, success)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: Only accept messages from iframe origin
      if (!previewUrl) return;

      try {
        const iframeOrigin = new URL(previewUrl).origin;
        if (event.origin !== iframeOrigin) return;
      } catch (e) {
        return;
      }

      const { type, error, level, args, message } = event.data;

      if (type === 'iframe-error' && error && onIFrameError) {
        const iframeError: IFrameError = {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          type: error.source === 'vite-overlay' ? 'vite' : error.source === 'promise' ? 'promise' : 'runtime',
          message: error.message || error.raw || 'Unknown error',
          stack: error.stack,
          filename: error.filename,
          lineno: error.lineno,
          colno: error.colno,
          raw: error.raw,
          html: error.html,
        };
        onIFrameError(iframeError);
      } else if (type === 'iframe-console' && onIFrameConsole) {
        const consoleLog: IFrameError = {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          type: 'console',
          level: level as 'log' | 'warn' | 'error' | 'info',
          message: args?.[0] || message || '',
          args: args || [],
        };
        onIFrameConsole(consoleLog);
      } else if (type === 'iframe-success') {
        // Clear errors on successful load
        if (onIFrameSuccess) {
          onIFrameSuccess();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [previewUrl, onIFrameError, onIFrameConsole, onIFrameSuccess]);

  useEffect(() => {
    if (!isPublishPanelOpen) {
      return;
    }

    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        (!panelRef.current || !panelRef.current.contains(target)) &&
        (!buttonRef.current || !buttonRef.current.contains(target))
      ) {
        onPublishPanelClose();
      }
    };

    document.addEventListener('mousedown', handleClickAway);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
    };
  }, [isPublishPanelOpen, onPublishPanelClose]);

  // Close routes dropdown when clicking outside
  useEffect(() => {
    if (!isRoutesDropdownOpen) {
      return;
    }

    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        (!routesDropdownRef.current || !routesDropdownRef.current.contains(target)) &&
        (!routesButtonRef.current || !routesButtonRef.current.contains(target))
      ) {
        setIsRoutesDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickAway);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
    };
  }, [isRoutesDropdownOpen]);

  // Close Supabase dropdown when clicking outside
  useEffect(() => {
    if (!isSupabaseDropdownOpen) {
      return;
    }

    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        (!supabaseDropdownRef.current || !supabaseDropdownRef.current.contains(target)) &&
        (!supabaseButtonRef.current || !supabaseButtonRef.current.contains(target))
      ) {
        setIsSupabaseDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickAway);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
    };
  }, [isSupabaseDropdownOpen]);

  const handlePathEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditablePathValue(e.target.value);
  };

  const handlePathKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      navigateToPath(editablePathValue);
      setIsEditingPath(false);
    } else if (e.key === 'Escape') {
      setEditablePathValue(currentPath);
      setIsEditingPath(false);
    }
  };

  const navigateToPath = (path: string) => {
    if (!previewUrl || !iframeRef.current) return;
    
    try {
      const baseUrl = new URL(previewUrl);
      // Ensure path starts with /
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const newUrl = `${baseUrl.origin}${normalizedPath}`;
      
      // Navigate the iframe
      if (iframeRef.current.contentWindow) {
        iframeRef.current.src = newUrl;
        setCurrentPath(normalizedPath);
      }
    } catch (e) {
      console.error('Failed to navigate:', e);
    }
  };

  const handlePathClick = () => {
    setIsEditingPath(true);
  };

  const handleRouteClick = (route: string) => {
    navigateToPath(route);
    setIsRoutesDropdownOpen(false);
  };

  const toggleRoutesDropdown = () => {
    setIsRoutesDropdownOpen((prev) => !prev);
  };

  const cycleViewport = () => {
    const viewports: ViewportSize[] = ['desktop', 'tablet', 'mobile'];
    const currentIndex = viewports.indexOf(viewportSize);
    const nextIndex = (currentIndex + 1) % viewports.length;
    setViewportSize(viewports[nextIndex]);
  };

  const getViewportIcon = () => {
    switch (viewportSize) {
      case 'desktop':
        return <Monitor className="w-4 h-4 text-gray-500 flex-shrink-0" />;
      case 'tablet':
        return <Tablet className="w-4 h-4 text-gray-500 flex-shrink-0" />;
      case 'mobile':
        return <Smartphone className="w-4 h-4 text-gray-500 flex-shrink-0" />;
    }
  };

  const renderPublishBadge = () => null;

  const isPreviewReady = projectStatus === 'active' && Boolean(previewUrl);
  const isProvisioning = projectStatus === 'creating' || projectStatus === 'starting';
  const shouldShowLoading =
    (isProvisioning || isPreviewLoading) && activeView !== 'code';

  return (
    <div className="h-full flex flex-col bg-primary" style={{ width: '70%' }}>
        <div className="h-[46px] flex items-center justify-between gap-4 px-2">
            {/* Left Section */}
            <div className="flex items-center gap-[20px]">
              <div className="relative inline-flex items-center px-1 py-1 bg-interactive-secondary rounded-full">
                <div
                  className={`absolute inset-y-1 left-1 w-[calc(33.333%-0.25rem)] rounded-full bg-primary shadow-sm transition-transform duration-300 ease-out ${
                    activeView === 'preview' ? 'translate-x-0' :
                    activeView === 'code' ? 'translate-x-[calc(100%+0.1rem)]' :
                    (activeView === 'analytics' || activeView === 'terminal') ? 'translate-x-[calc(200%+0.1rem)]' :
                    'translate-x-[calc(200%+0.1rem)]'
                  }`}
                />
                <button
                  className={`relative z-10 flex-1 flex items-center gap-1 py-1 px-3 text-xs font-medium transition-colors justify-center ${
                    activeView === 'preview' ? 'text-primary' : 'text-tertiary'
                  }`}
                  onClick={() => onViewChange('preview')}
                  type="button"
                  aria-pressed={activeView === 'preview'}
                >
                  <ScreenShare className="w-4 h-4" strokeWidth={1.8} />
                </button>
                <button
                  className={`relative z-10 flex-1 flex items-center gap-1 py-1 px-3 text-xs font-medium transition-colors justify-center ${
                    activeView === 'code' ? 'text-primary' : 'text-tertiary'
                  }`}
                  onClick={() => onViewChange('code')}
                  type="button"
                  aria-pressed={activeView === 'code'}
                >
                  <CodeXml className="w-4 h-4" strokeWidth={1.8} />
                </button>
                {projectType === 'dev' ? (
                  <button
                    className={`relative z-10 flex-1 flex items-center gap-1 py-1 px-3 text-xs font-medium transition-colors justify-center ${
                      activeView === 'terminal' ? 'text-primary' : 'text-tertiary'
                    }`}
                    onClick={() => onViewChange('terminal')}
                    type="button"
                    aria-pressed={activeView === 'terminal'}
                  >
                    <TerminalIcon className="w-4 h-4" strokeWidth={1.8} />
                  </button>
                ) : (
                  <button
                    className={`relative z-10 flex-1 flex items-center gap-1 py-1 px-3 text-xs font-medium transition-colors justify-center ${
                      activeView === 'analytics' ? 'text-primary' : 'text-tertiary'
                    }`}
                    onClick={() => onViewChange('analytics')}
                    type="button"
                    aria-pressed={activeView === 'analytics'}
                  >
                    <ChartLine className="w-4 h-4" strokeWidth={1.8} />
                  </button>
                )}
              </div>

            </div>

            {/* Center Section - URL Bar or View Title */}
            {activeView === 'preview' ? (
              <div className="flex-1 flex items-center gap-3 justify-center">
                <div className="flex-1 max-w-sm relative">
                  <div className="flex items-center gap-2 px-3 py-1 bg-primary rounded-2xl border border-primary">
                    <div className="group relative">
                      <button
                        onClick={cycleViewport}
                        className="hover:bg-interactive-hover rounded-lg p-1 transition-colors"
                      >
                        {getViewportIcon()}
                      </button>
                      <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap pointer-events-none z-50">
                        {VIEWPORT_SIZES[viewportSize].label}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                    {isEditingPath ? (
                      <input
                        type="text"
                        value={editablePathValue}
                        onChange={handlePathEdit}
                        onKeyDown={handlePathKeyDown}
                        onBlur={() => {
                          setIsEditingPath(false);
                          setEditablePathValue(currentPath);
                        }}
                        autoFocus
                        className="flex-1 text-sm bg-transparent text-primary outline-none border-none px-1"
                        style={{
                          fontFamily: 'Arial, sans-serif',
                          letterSpacing: '0.3px'
                        }}
                        placeholder="/"
                      />
                    ) : (
                      <button
                        onClick={handlePathClick}
                        className="flex-1 text-left text-sm truncate transition-colors px-1 text-secondary hover:text-primary"
                        style={{
                          fontFamily: 'Arial, sans-serif',
                          letterSpacing: '0.3px'
                        }}
                        title="Click to edit path"
                      >
                        {currentPath === 'blank' || !currentPath ? '/' : currentPath}
                      </button>
                    )}
                    <div className="flex items-center gap-1">
                      <div className="group relative">
                        <button
                          ref={routesButtonRef}
                          onClick={toggleRoutesDropdown}
                          className="p-1 hover:bg-interactive-hover rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={!isPreviewRunning || appRoutes.length === 0}
                        >
                          <List className="w-4 h-4 text-secondary" />
                        </button>
                        <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap pointer-events-none z-50">
                          Show routes
                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                      <div className="group relative">
                        <button
                          onClick={() => {
                            if (isFullscreen) {
                              document.exitFullscreen();
                            } else if (previewUrl && iframeRef.current) {
                              iframeRef.current.requestFullscreen();
                            }
                          }}
                          className="p-1 hover:bg-interactive-hover rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={!previewUrl}
                        >
                          {isFullscreen ? (
                            <Minimize2 className="w-4 h-4 text-secondary" />
                          ) : (
                            <Maximize2 className="w-4 h-4 text-secondary" />
                          )}
                        </button>
                        <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap pointer-events-none z-50">
                          {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                      {isPreviewRunning ? (
                        <div className="group relative">
                          <button
                            onClick={() => {
                              if (iframeRef.current) {
                                setIsRefreshing(true);
                                const currentSrc = iframeRef.current.src;
                                iframeRef.current.src = '';
                                setTimeout(() => {
                                  if (iframeRef.current) {
                                    iframeRef.current.src = currentSrc;
                                  }
                                }, 10);
                                // Fallback: remove spinner after 3 seconds
                                setTimeout(() => setIsRefreshing(false), 3000);
                              }
                            }}
                            className="p-1 hover:bg-interactive-hover rounded-lg transition-colors"
                          >
                            <RotateCcw className="w-4 h-4 text-secondary" />
                          </button>
                          <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap pointer-events-none z-50">
                            Refresh
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      ) : (
                        <div className="group relative">
                          <button
                            onClick={onStartPreview}
                            className="p-1 hover:bg-interactive-hover rounded-lg transition-colors"
                          >
                            <Play className="w-4 h-4 text-secondary" />
                          </button>
                          <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap pointer-events-none z-50">
                            Start preview
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {isRoutesDropdownOpen && appRoutes.length > 0 && (
                    <div
                      ref={routesDropdownRef}
                      className="absolute top-full left-0 right-0 mt-2 bg-primary rounded-lg z-50 overflow-hidden border border-primary"
                    >
                      <div className="px-3 py-2 border-b border-primary">
                        <span className="text-xs text-tertiary font-medium">
                          Available pages
                        </span>
                      </div>
                      <div className="py-1 overflow-y-auto max-h-[240px]">
                        {appRoutes.map((route, index) => (
                          <button
                            key={index}
                            onClick={() => handleRouteClick(route)}
                            className="w-full text-left px-4 py-2 text-sm transition-colors text-primary hover:bg-interactive-hover"
                            style={{
                              fontFamily: 'Arial, sans-serif',
                              letterSpacing: '0.3px'
                            }}
                          >
                            {route.replace(/\*/g, '')}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">
                  {activeView === 'code' ? 'Code' : activeView === 'terminal' ? 'Terminal' : 'Analytics'}
                </span>
              </div>
            )}

            {/* Right Section */}
            <div className="flex items-center gap-[8px]">
            <div className="group relative">
              <button
                onClick={() => onOpenSettings?.()}
                className="flex items-center gap-2 w-[28px] h-[28px] rounded-lg border border-primary text-secondary hover:bg-interactive-hover transition-colors justify-center"
              >
                <Settings className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap pointer-events-none z-50">
                Settings
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
            <div className="group relative">
              <button
                onClick={() => onOpenGithub?.()}
                className="flex items-center gap-2 w-[28px] h-[28px] rounded-lg border border-primary text-secondary hover:bg-interactive-hover transition-colors justify-center"
              >
                <GithubIcon className="w-4 h-4" />
              </button>
              <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap pointer-events-none z-50">
                GitHub
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
            {projectType !== 'dev' && (
              <div className="group relative">
                <button
                  ref={supabaseButtonRef}
                  onClick={() => {
                    if (supabaseConnected && supabaseProjectRef) {
                      setIsSupabaseDropdownOpen((prev) => !prev);
                    } else {
                      onOpenSupabase?.();
                    }
                  }}
                  className="flex items-center gap-2 w-[28px] h-[28px] rounded-lg border border-primary text-secondary hover:bg-interactive-hover transition-colors justify-center"
                >
                  <SupabaseIcon className="w-4 h-4" />
                </button>
                <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap pointer-events-none z-50">
                  Supabase
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                </div>
                {isSupabaseDropdownOpen && supabaseConnected && supabaseProjectRef && (
                  <div
                    ref={supabaseDropdownRef}
                    className="absolute top-full right-0 mt-2 w-48 bg-primary rounded-lg border border-primary z-50 overflow-hidden shadow-lg"
                  >
                    <div className="px-3 py-2 border-b border-primary">
                      <span className="text-xs text-tertiary font-medium">
                        Supabase Dashboard
                      </span>
                    </div>
                    <div className="py-1">
                      <a
                        href={`https://supabase.com/dashboard/project/${supabaseProjectRef}/functions`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-left px-4 py-2 text-sm transition-colors text-primary hover:bg-interactive-hover flex items-center gap-2"
                        onClick={() => setIsSupabaseDropdownOpen(false)}
                      >
                        <CodeXml className="w-4 h-4" />
                        Edge Functions
                      </a>
                      <a
                        href={`https://supabase.com/dashboard/project/${supabaseProjectRef}/editor`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-left px-4 py-2 text-sm transition-colors text-primary hover:bg-interactive-hover flex items-center gap-2"
                        onClick={() => setIsSupabaseDropdownOpen(false)}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <line x1="3" y1="9" x2="21" y2="9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <line x1="9" y1="21" x2="9" y2="9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Database
                      </a>
                      <a
                        href={`https://supabase.com/dashboard/project/${supabaseProjectRef}/storage/buckets`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-left px-4 py-2 text-sm transition-colors text-primary hover:bg-interactive-hover flex items-center gap-2"
                        onClick={() => setIsSupabaseDropdownOpen(false)}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Storage
                      </a>
                      <a
                        href={`https://supabase.com/dashboard/project/${supabaseProjectRef}/auth/users`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-left px-4 py-2 text-sm transition-colors text-primary hover:bg-interactive-hover flex items-center gap-2"
                        onClick={() => setIsSupabaseDropdownOpen(false)}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="12" cy="7" r="4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Authentication
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="relative">
              {isPublishPanelOpen && (
                <div
                  className="fixed inset-0 z-30"
                  onClick={onPublishPanelClose}
                />
              )}
              <button
                ref={buttonRef}
                onClick={onPublishButtonClick}
                className="flex items-center gap-2 px-3 py-1 dark:bg-interactive-primary hover:bg-interactive-primary dark:hover:bg-interactive-hover text-white bg-foreground dark:text-white rounded-lg transition-all duration-200 justify-center"
                title="Publish project to deployment"
              >
                <Rocket className="w-4 h-4" />
                <span className="text-sm font-medium">Publish</span>
                {renderPublishBadge()}
              </button>
              <PublishModal
                isOpen={isPublishPanelOpen}
                onClose={onPublishPanelClose}
                state={publishState}
                websiteAddress={publishDomain}
                subdomainName={subdomainName}
                onSubdomainChange={onSubdomainChange}
                onUpdateClick={onUpdatePublish}
                onUnpublishClick={onUnpublish}
                canUpdate={canUpdate}
                canUnpublish={canUnpublish}
                errorMessage={publishError}
                panelRef={panelRef}
                onOpenCustomDomain={onOpenCustomDomain}
                onOpenAnalytics={onOpenAnalytics}
                currentSubdomain={currentSubdomain}
                domainSuffix={domainSuffix}
                projectId={projectId}
                projectType={projectType}
                productionUrl={productionUrl}
                railwayProjectId={railwayProjectId}
                railwayServiceId={railwayServiceId}
                expectedDomain={expectedDomain}
                railwayDeploymentStatus={railwayDeploymentStatus}
                railwayMessage={railwayMessage}
                railwayUrl={railwayUrl}
                railwayErrorLogs={railwayErrorLogs}
                onCheckRailwayStatus={onCheckRailwayStatus}
                onSendPromptToAgent={onSendPromptToAgent}
                onRailwayUnpublishSuccess={onRailwayUnpublishSuccess}
                onRailwayDeploySuccess={onRailwayDeploySuccess}
                userPlan={userPlan}
              />
            </div>
            </div>
        </div>
    <div className="flex-1 bg-secondary min-h-0 border border-primary rounded-2xl mx-2 mb-2 mt-0 relative flex flex-col overflow-hidden">
          {streamingState?.previewRefreshing && (
            <PreviewRefreshIndicator
              isRefreshing={streamingState.previewRefreshing}
              changedFiles={streamingState.changedFiles}
            />
          )}
          {serverRestartStatus?.status && (
            <div className="absolute inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center gap-4 z-50 rounded-2xl">
              {serverRestartStatus.status === 'restarting' && (
                <>
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                  <div className="text-sm text-gray-400">Restarting server</div>
                </>
              )}
              {serverRestartStatus.status === 'completed' && (
                <>
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="text-sm text-gray-400">Server restarted</div>
                </>
              )}
              {serverRestartStatus.status === 'failed' && (
                <>
                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div className="text-sm text-gray-400">Restart failed</div>
                </>
              )}
            </div>
          )}
          {activeView === 'terminal' ? (
            <div className="flex-1 min-h-0 overflow-hidden rounded-2xl">
              <div className="h-full flex flex-col bg-secondary">
                {/* Terminal Header */}
                <div className="flex items-center justify-between px-4 border-b border-primary bg-primary h-10 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <TerminalIcon className="w-4 h-4 text-green-500 dark:text-green-400" />
                    <h3 className="text-sm font-medium text-primary">Server Logs</h3>
                    {(isLoadingLogs || isRestarting) && <Loader2 className="w-3 h-3 text-tertiary animate-spin" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRestartServer}
                      disabled={isRestarting}
                      className={`p-1 rounded hover:bg-interactive-hover transition-colors text-tertiary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed ${
                        isRestarting ? 'animate-spin' : ''
                      }`}
                      title="Restart server"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={fetchLogs}
                      disabled={isLoadingLogs}
                      className={`p-1 rounded hover:bg-interactive-hover transition-colors text-tertiary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed ${
                        isLoadingLogs ? 'animate-spin' : ''
                      }`}
                      title="Refresh logs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {/* Terminal Content */}
                <div
                  ref={terminalContentRef}
                  className="terminal-scrollbar flex-1 overflow-auto p-4 font-mono text-xs text-green-600 dark:text-green-400 bg-white dark:bg-black"
                >
                  <pre className="whitespace-pre-wrap">{terminalLogs || 'Loading logs...'}</pre>
                </div>
                {/* Terminal Footer */}
                <div className="px-4 py-2 border-t border-primary bg-primary">
                  <span className="text-xs text-tertiary">
                    Auto-refreshing every 2 seconds
                  </span>
                </div>
              </div>
            </div>
          ) : activeView === 'analytics' ? (
            <div className="flex-1 min-h-0 overflow-auto bg-white rounded-2xl">
              <AnalyticsTab projectId={projectId} />
            </div>
          ) : activeView === 'code' && codePanelProps ? (
            <div className="flex-1 min-h-0 overflow-hidden rounded-2xl">
              <CodePanel {...codePanelProps} />
            </div>
          ) : isPreviewReady ? (
            <div className={`absolute inset-0 flex items-center justify-center ${viewportSize !== 'desktop' ? 'p-4 bg-gray-100' : 'bg-white'}`}>
              {isRefreshing && (
                <div className="absolute inset-0 bg-white flex items-center justify-center z-10">
                  <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                </div>
              )}
              {(() => {
                if (!previewUrl) {
                  return null;
                }
                const bust = previewNonce ? `__v=${previewNonce}` : '';
                const sep = previewUrl.includes('?') ? '&' : '?';
                const src = bust ? `${previewUrl}${sep}${bust}` : previewUrl;
                const viewportWidth = VIEWPORT_SIZES[viewportSize].width;

                return (
                  <div
                    className="transition-all duration-300 ease-out relative"
                    style={{
                      width: viewportWidth,
                      maxWidth: '100%',
                      height: viewportSize === 'desktop' ? '100%' : 'auto',
                      aspectRatio: viewportSize === 'tablet' ? '4 / 3' : viewportSize === 'mobile' ? '9 / 16' : undefined,
                    }}
                  >
                    <iframe
                      ref={iframeRef}
                      key={src}
                      src={src}
                      className="w-full h-full border-0 bg-white"
                      style={{
                        boxShadow: viewportSize !== 'desktop' ? '0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)' : 'none',
                        borderRadius: viewportSize !== 'desktop' ? '1rem' : '0',
                        display: 'block',
                      }}
                    />

                    {/* Error blur overlay on iframe */}
                    {iframeErrors.length > 0 && (
                      <div className="absolute inset-0 bg-black/30 backdrop-blur-md rounded-2xl" />
                    )}
                  </div>
                );
              })()}
            </div>
          ) : shouldShowLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black rounded-2xl">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black rounded-2xl">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          )}
    </div>
    </div>
  );
};
