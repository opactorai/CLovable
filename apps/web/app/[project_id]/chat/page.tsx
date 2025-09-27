"use client";
import { useEffect, useState, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MotionDiv, MotionH3, MotionP, MotionButton } from '../../../lib/motion';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { FaCode, FaDesktop, FaMobileAlt, FaPlay, FaStop, FaSync, FaCog, FaRocket, FaFolder, FaFolderOpen, FaFile, FaFileCode, FaCss3Alt, FaHtml5, FaJs, FaReact, FaPython, FaDocker, FaGitAlt, FaMarkdown, FaDatabase, FaPhp, FaJava, FaRust, FaVuejs, FaLock, FaHome, FaChevronUp, FaChevronRight, FaChevronDown, FaArrowLeft, FaArrowRight, FaRedo } from 'react-icons/fa';
import { SiTypescript, SiGo, SiRuby, SiSvelte, SiJson, SiYaml, SiCplusplus } from 'react-icons/si';
import { VscJson } from 'react-icons/vsc';
import ChatLog from '../../../components/ChatLog';
import { ProjectSettings } from '../../../components/settings/ProjectSettings';
import ChatInput from '../../../components/chat/ChatInput';
import { useUserRequests } from '../../../hooks/useUserRequests';
import { useGlobalSettings } from '@/contexts/GlobalSettingsContext';

// 더 이상 ProjectSettings을 로드하지 않음 (메인 페이지에서 글로벌 설정으로 관리)

const API_BASE = '';

// Define assistant brand colors
const assistantBrandColors: { [key: string]: string } = {
  claude: '#DE7356',
  cursor: '#6B7280',
  qwen: '#A855F7',
  gemini: '#4285F4',
  codex: '#000000'
};

// Function to convert hex to CSS filter for tinting white images
// Since the original image is white (#FFFFFF), we can apply filters more accurately
const hexToFilter = (hex: string): string => {
  // For white source images, we need to invert and adjust
  const filters: { [key: string]: string } = {
    '#DE7356': 'brightness(0) saturate(100%) invert(52%) sepia(73%) saturate(562%) hue-rotate(336deg) brightness(95%) contrast(91%)',  // Orange for Claude
    '#6B7280': 'brightness(0) saturate(100%) invert(47%) sepia(7%) saturate(625%) hue-rotate(174deg) brightness(92%) contrast(82%)',  // Gray for Cursor  
    '#A855F7': 'brightness(0) saturate(100%) invert(48%) sepia(79%) saturate(1532%) hue-rotate(256deg) brightness(95%) contrast(101%)',  // Purple for Qwen
    '#4285F4': 'brightness(0) saturate(100%) invert(40%) sepia(97%) saturate(1449%) hue-rotate(198deg) brightness(97%) contrast(101%)',  // Blue for Gemini
    '#000000': 'brightness(0) saturate(100%)'  // Black for Codex
  };
  return filters[hex] || '';
};

type Entry = { path: string; type: 'file'|'dir'; size?: number };
type Params = { params: { project_id: string } };
type ProjectStatus = 'initializing' | 'active' | 'failed';

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
      {sortedEntries.map((entry) => {
        // entry.path should already be the full path from API
        const fullPath = entry.path;
        const isExpanded = expandedFolders.has(fullPath);
        const indent = level * 8;
        
        return (
          <div key={fullPath}>
            <div
              className={`group flex items-center h-[22px] px-2 cursor-pointer ${
                selectedFile === fullPath 
                  ? 'bg-blue-100 dark:bg-[#094771]' 
                  : 'hover:bg-gray-100 dark:hover:bg-[#1a1a1a]'
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
                    <span className="w-2.5 h-2.5 text-gray-600 dark:text-[#8b8b8b] flex items-center justify-center"><FaChevronDown size={10} /></span> : 
                    <span className="w-2.5 h-2.5 text-gray-600 dark:text-[#8b8b8b] flex items-center justify-center"><FaChevronRight size={10} /></span>
                )}
              </div>
              
              {/* Icon */}
              <span className="w-4 h-4 flex items-center justify-center mr-1.5">
                {entry.type === 'dir' ? (
                  isExpanded ? 
                    <span className="text-amber-600 dark:text-[#c09553] w-4 h-4 flex items-center justify-center"><FaFolderOpen size={16} /></span> : 
                    <span className="text-amber-600 dark:text-[#c09553] w-4 h-4 flex items-center justify-center"><FaFolder size={16} /></span>
                ) : (
                  getFileIcon(entry)
                )}
              </span>
              
              {/* File/Folder name */}
              <span className={`text-[13px] leading-[22px] ${
                selectedFile === fullPath ? 'text-blue-700 dark:text-white' : 'text-gray-700 dark:text-[#cccccc]'
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

export default function ChatPage({ params }: Params) {
  const projectId = params.project_id;
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // ★ NEW: UserRequests 상태 관리
  const {
    hasActiveRequests,
    createRequest,
    startRequest,
    completeRequest
  } = useUserRequests({ projectId });
  
  const [projectName, setProjectName] = useState<string>('');
  const [projectDescription, setProjectDescription] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tree, setTree] = useState<Entry[]>([]);
  const [content, setContent] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>('.');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']));
  const [folderContents, setFolderContents] = useState<Map<string, Entry[]>>(new Map());
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'act' | 'chat'>('act');
  const [isRunning, setIsRunning] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [deviceMode, setDeviceMode] = useState<'desktop'|'mobile'>('desktop');
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<{name: string, url: string, base64: string}[]>([]);
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
  const [preferredCli, setPreferredCli] = useState<string>('claude');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [usingGlobalDefaults, setUsingGlobalDefaults] = useState<boolean>(true);
  const [thinkingMode, setThinkingMode] = useState<boolean>(false);
  const [currentRoute, setCurrentRoute] = useState<string>('/');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFileUpdating, setIsFileUpdating] = useState(false);

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
      sessionStorage.setItem('selectedAssistant', cliFromUrl);
    }
    if (modelFromUrl) {
      sessionStorage.setItem('selectedModel', modelFromUrl);
    }
    
    // Don't show the initial prompt in the input field
    // setPrompt(initialPromptFromUrl);
    setTimeout(() => {
      sendInitialPrompt(initialPromptFromUrl);
    }, 300);
  }, [searchParams]);

  const loadDeployStatus = useCallback(async () => {
    try {
      // Use the same API as ServiceSettings to check actual project service connections
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/services`);
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

  const checkCurrentDeployment = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/vercel/deployment/current`);
      if (response.ok) {
        const data = await response.json();
        if (data.has_deployment) {
          // 진행 중인 배포가 있으면 상태 설정 및 폴링 시작
          setDeploymentId(data.deployment_id);
          setDeploymentStatus('deploying');
          setPublishLoading(false); // publishLoading은 해제하되 deploymentStatus로 UI 제어
          setShowPublishPanel(true); // 패널 열어서 진행 상황 표시
          startDeploymentPolling(data.deployment_id);
          console.log('🔍 Resuming deployment monitoring:', data.deployment_id);
        }
      }
    } catch (e) {
      console.warn('Failed to check current deployment', e);
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
        if (!r.ok) return;
        const data = await r.json();
        
        // 진행 중인 배포가 없으면 폴링 중단 (완료됨)
        if (!data.has_deployment) {
          console.log('🔍 Deployment completed - no active deployment');
          
          // 최종 배포 URL 설정
          if (data.last_deployment_url) {
            const url = String(data.last_deployment_url).startsWith('http') ? data.last_deployment_url : `https://${data.last_deployment_url}`;
            console.log('🔍 Deployment complete! URL:', url);
            setPublishedUrl(url);
            setDeploymentStatus('ready');
          } else {
            setDeploymentStatus('idle');
          }
          
          // End publish loading state (중요: 배포가 없어도 loading 해제)
          setPublishLoading(false);
          
          if (deployPollRef.current) {
            clearInterval(deployPollRef.current);
            deployPollRef.current = null;
          }
          return;
        }
        
        // 진행 중인 배포가 있는 경우
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
    }, 1000); // 1초 간격으로 변경
  }, [projectId]);

  async function start() {
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
      const data = await r.json();
      
      setPreviewInitializationMessage('Preview ready!');
      setTimeout(() => {
        setPreviewUrl(data.url);
        setIsStartingPreview(false);
        setCurrentRoute('/'); // Reset to root route when starting
      }, 1000);
    } catch (error) {
      console.error('Error starting preview:', error);
      setPreviewInitializationMessage('An error occurred');
      setTimeout(() => setIsStartingPreview(false), 2000);
    }
  }

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


  async function stop() {
    try {
      await fetch(`${API_BASE}/api/projects/${projectId}/preview/stop`, { method: 'POST' });
      setPreviewUrl(null);
    } catch (error) {
      console.error('Error stopping preview:', error);
    }
  }

  async function loadTree(dir = '.') {
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
  }

  // Load subdirectory contents
  async function loadSubdirectory(dir: string): Promise<Entry[]> {
    try {
      const r = await fetch(`${API_BASE}/api/repo/${projectId}/tree?dir=${encodeURIComponent(dir)}`);
      const data = await r.json();
      return data;
    } catch (error) {
      console.error('Failed to load subdirectory:', error);
      return [];
    }
  }

  // Load folder contents
  async function handleLoadFolder(path: string) {
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
  }

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

  async function openFile(path: string) {
    try {
      const r = await fetch(`${API_BASE}/api/repo/${projectId}/file?path=${encodeURIComponent(path)}`);
      
      if (!r.ok) {
        console.error('Failed to load file:', r.status, r.statusText);
        setContent('// Failed to load file content');
        setSelectedFile(path);
        return;
      }
      
      const data = await r.json();
      setContent(data.content || '');
      setSelectedFile(path);
    } catch (error) {
      console.error('Error opening file:', error);
      setContent('// Error loading file');
      setSelectedFile(path);
    }
  }

  // Reload currently selected file
  async function reloadCurrentFile() {
    if (selectedFile && !showPreview) {
      try {
        const r = await fetch(`${API_BASE}/api/repo/${projectId}/file?path=${encodeURIComponent(selectedFile)}`);
        if (r.ok) {
          const data = await r.json();
          const newContent = data.content || '';
          // Only update if content actually changed
          if (newContent !== content) {
            setIsFileUpdating(true);
            setContent(newContent);
            setTimeout(() => setIsFileUpdating(false), 500);
          }
        }
      } catch (error) {
        // Silently fail - this is a background refresh
      }
    }
  }

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

  async function loadSettings(projectSettings?: { cli?: string; model?: string }) {
    try {
      console.log('🔧 loadSettings called with project settings:', projectSettings);
      
      // Use project settings if available, otherwise check state
      const hasCliSet = projectSettings?.cli || preferredCli;
      const hasModelSet = projectSettings?.model || selectedModel;
      
      // Only load global settings if project doesn't have CLI/model settings
      if (!hasCliSet || !hasModelSet) {
        console.log('⚠️ Missing CLI or model, loading global settings');
        const globalResponse = await fetch(`${API_BASE}/api/settings/global`);
        if (globalResponse.ok) {
          const globalSettings = await globalResponse.json();
          const defaultCli = globalSettings.default_cli || 'claude';
          
          // Only set if not already set by project
          if (!hasCliSet) {
            console.log('🔄 Setting CLI from global:', defaultCli);
            setPreferredCli(defaultCli);
          }
          
          // Set the model for the CLI if not already set
          if (!hasModelSet) {
            const cliSettings = globalSettings.cli_settings?.[hasCliSet || defaultCli];
            if (cliSettings?.model) {
              setSelectedModel(cliSettings.model);
            } else {
              // Set default model based on CLI
              const currentCli = hasCliSet || defaultCli;
              if (currentCli === 'claude') {
                setSelectedModel('claude-sonnet-4');
              } else if (currentCli === 'cursor') {
                setSelectedModel('gpt-5');
              } else if (currentCli === 'codex') {
                setSelectedModel('gpt-5');
              } else if (currentCli === 'qwen') {
                setSelectedModel('qwen3-coder-plus');
              } else if (currentCli === 'gemini') {
                setSelectedModel('gemini-2.5-pro');
              }
            }
          }
        } else {
          // Fallback to project settings
          const response = await fetch(`${API_BASE}/api/settings`);
          if (response.ok) {
            const settings = await response.json();
            if (!hasCliSet) setPreferredCli(settings.preferred_cli || 'claude');
            if (!hasModelSet) setSelectedModel(settings.preferred_cli === 'claude' ? 'claude-sonnet-4' : 'gpt-5');
          }
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Only set fallback if not already set
      const hasCliSet = projectSettings?.cli || preferredCli;
      const hasModelSet = projectSettings?.model || selectedModel;
      if (!hasCliSet) setPreferredCli('claude');
      if (!hasModelSet) setSelectedModel('claude-sonnet-4');
    }
  }

  async function loadProjectInfo() {
    try {
      const r = await fetch(`${API_BASE}/api/projects/${projectId}`);
      if (r.ok) {
        const project = await r.json();
        console.log('📋 Loading project info:', {
          preferred_cli: project.preferred_cli,
          selected_model: project.selected_model
        });
        setProjectName(project.name || `Project ${projectId.slice(0, 8)}`);
        
        // Set CLI and model from project settings if available
        if (project.preferred_cli) {
          console.log('✅ Setting CLI from project:', project.preferred_cli);
          setPreferredCli(project.preferred_cli);
        }
        if (project.selected_model) {
          console.log('✅ Setting model from project:', project.selected_model);
          setSelectedModel(project.selected_model);
        }
        // Determine if we should follow global defaults (no project-specific prefs)
        const followGlobal = !project.preferred_cli && !project.selected_model;
        setUsingGlobalDefaults(followGlobal);
        setProjectDescription(project.description || '');
        
        // Return project settings for use in loadSettings
        return {
          cli: project.preferred_cli,
          model: project.selected_model
        };
        
        // Check if project has initial prompt
        if (project.initial_prompt) {
          setHasInitialPrompt(true);
          localStorage.setItem(`project_${projectId}_hasInitialPrompt`, 'true');
          // Don't start preview automatically if there's an initial prompt
        } else {
          setHasInitialPrompt(false);
          localStorage.setItem(`project_${projectId}_hasInitialPrompt`, 'false');
        }

        // Check initial project status and handle initial prompt
        const initialPromptFromUrl = searchParams?.get('initial_prompt');
        
        if (project.status === 'initializing') {
          setProjectStatus('initializing');
          setIsInitializing(true);
          // initializing 상태면 WebSocket에서 active로 변경될 때까지 대기
        } else {
          setProjectStatus('active');
          setIsInitializing(false);
          
          // 프로젝트가 이미 active 상태면 즉시 의존성 설치 시작
          startDependencyInstallation();
          
          // Initial prompt: trigger once with shared guard (handles active-on-load case)
          triggerInitialPromptIfNeeded();
        }
        
        // Always load the file tree after getting project info
        await loadTree('.')
      } else {
        // If API fails, use a fallback name
        setProjectName(`Project ${projectId.slice(0, 8)}`);
        setProjectDescription('');
        setHasInitialPrompt(false);
        localStorage.setItem(`project_${projectId}_hasInitialPrompt`, 'false');
        setProjectStatus('active');
        setIsInitializing(false);
        setUsingGlobalDefaults(true);
        return {}; // Return empty object if no project found
      }
    } catch (error) {
      console.error('Failed to load project info:', error);
      // If network error, use a fallback name
      setProjectName(`Project ${projectId.slice(0, 8)}`);
      setProjectDescription('');
      setHasInitialPrompt(false);
      localStorage.setItem(`project_${projectId}_hasInitialPrompt`, 'false');
      setProjectStatus('active');
      setIsInitializing(false);
      setUsingGlobalDefaults(true);
      return {}; // Return empty object on error
    }
  }

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
      alert('작업 내용을 입력하거나 이미지를 업로드해주세요.');
      return;
    }
    
    // Chat Mode일 때 추가 지시사항 추가
    if (mode === 'chat') {
      finalMessage = finalMessage + "\n\nDo not modify code, only answer to the user's request.";
    }
    
    // If this is not an initial prompt and user is running a new task, 
    // ensure the preview button is not blocked
    if (!hasInitialPrompt || agentWorkComplete) {
      // This is a subsequent task, not the initial one
      // Don't block the preview button for subsequent tasks
    }
    
    setIsRunning(true);
    
    // ★ NEW: request_id 생성
    const requestId = crypto.randomUUID();
    
    try {
      // Handle images - convert UploadedImage format to API format
      const processedImages = imagesToUse.map(img => {
        // Check if this is from ChatInput (has 'path' property) or old format (has 'base64')
        if (img.path) {
          // New format from ChatInput - send path directly
          return {
            path: img.path,
            name: img.filename || img.name || 'image'
          };
        } else if (img.base64) {
          // Old format - convert to base64_data
          return {
            name: img.name,
            base64_data: img.base64.split(',')[1], // Remove data:image/...;base64, prefix
            mime_type: img.base64.split(';')[0].split(':')[1] // Extract mime type
          };
        }
        return img; // Return as-is if already in correct format
      });

      const requestBody = { 
        instruction: finalMessage, 
        images: processedImages,
        is_initial_prompt: false, // Mark as continuation message
        cli_preference: preferredCli, // Add CLI preference
        selected_model: selectedModel, // Add selected model
        request_id: requestId // ★ NEW: request_id 추가
      };
      
      
      // Use different endpoint based on mode
      const endpoint = mode === 'act' ? 'act' : 'chat';
      const r = await fetch(`${API_BASE}/api/chat/${projectId}/${endpoint}`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(requestBody) 
      });
      
      
      if (!r.ok) {
        const errorText = await r.text();
        console.error('❌ API Error:', errorText);
        alert(`오류: ${errorText}`);
        return;
      }
      
      const result = await r.json();
      
      // ★ NEW: UserRequest 생성
      createRequest(requestId, result.session_id, finalMessage, mode);
      
      // 완료 후 데이터 새로고침
      await loadTree('.');
      
      // 프롬프트 및 업로드된 이미지들 초기화
      setPrompt('');
      // Clean up old format images if any
      if (uploadedImages && uploadedImages.length > 0) {
        uploadedImages.forEach(img => {
          if (img.url) URL.revokeObjectURL(img.url);
        });
        setUploadedImages([]);
      }
      
    } catch (error) {
      console.error('Act 실행 오류:', error);
      alert(`실행 중 오류가 발생했습니다: ${error}`);
    } finally {
      setIsRunning(false);
    }
  }


  // Handle project status updates via callback from ChatLog
  const handleProjectStatusUpdate = (status: string, message?: string) => {
    const previousStatus = projectStatus;
    
    // 상태가 같다면 무시 (중복 방지)
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
      
      // initializing → active 전환인 경우에만 처리
      if (previousStatus === 'initializing') {
        
        // 의존성 설치 시작
        startDependencyInstallation();
      }
      
      // Initial prompt: trigger once with shared guard (handles active-via-WS case)
      triggerInitialPromptIfNeeded();
    } else if (status === 'failed') {
      setIsInitializing(false);
    }
  };

  // Function to start dependency installation in background
  const startDependencyInstallation = async () => {
    try {
      
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/install-dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const result = await response.json();
      } else {
        const errorText = await response.text();
        console.warn('⚠️ Failed to start dependency installation:', errorText);
      }
    } catch (error) {
      console.error('❌ Error starting dependency installation:', error);
    }
  };

  // Function to send initial prompt automatically
  const sendInitialPrompt = async (initialPrompt: string) => {
    // 이미 전송했으면 다시 전송하지 않음
    if (initialPromptSent) {
      return;
    }
    
    // Reset task complete state for new initial prompt
    setAgentWorkComplete(false);
    localStorage.setItem(`project_${projectId}_taskComplete`, 'false');
    
    // ★ NEW: request_id 생성
    const requestId = crypto.randomUUID();
    
    // No need to add project structure info here - backend will add it for the AI agent
    
    try {
      setIsRunning(true);
      setInitialPromptSent(true); // 전송 시작 시점에 바로 설정
      
      const requestBody = { 
        instruction: initialPrompt,
        images: [], // No images for initial prompt
        is_initial_prompt: true, // Mark as initial prompt
        request_id: requestId // ★ NEW: request_id 추가
      };
      
      const r = await fetch(`${API_BASE}/api/chat/${projectId}/act`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(requestBody) 
      });
      
      if (!r.ok) {
        const errorText = await r.text();
        console.error('❌ API Error:', errorText);
        setInitialPromptSent(false); // 실패하면 다시 시도할 수 있도록
        return;
      }
      
      const result = await r.json();
      
      // ★ NEW: UserRequest 생성 (display original prompt, not enhanced)
      createRequest(requestId, result.session_id, initialPrompt, 'act');
      
      // Clear the prompt input after sending
      setPrompt('');
      
      // Clean up URL by removing the initial_prompt parameter
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('initial_prompt');
      window.history.replaceState({}, '', newUrl.toString());
      
    } catch (error) {
      console.error('Error sending initial prompt:', error);
      setInitialPromptSent(false); // 실패하면 다시 시도할 수 있도록
    } finally {
      setIsRunning(false);
    }
  };

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

  // ★ NEW: 활성 요청 상태에 따른 preview 서버 자동 제어
  const previousActiveState = useRef(false);
  
  useEffect(() => {
    // Task 시작 시 - preview 서버 중지
    if (hasActiveRequests && previewUrl) {
      console.log('🔄 Auto-stopping preview server due to active request');
      stop();
    }
    
    // Task 완료 시 - preview 서버 자동 시작
    if (previousActiveState.current && !hasActiveRequests && !previewUrl) {
      console.log('✅ Task completed, auto-starting preview server');
      start();
    }
    
    previousActiveState.current = hasActiveRequests;
  }, [hasActiveRequests, previewUrl]);

  // Poll for file changes in code view
  useEffect(() => {
    if (!showPreview && selectedFile) {
      const interval = setInterval(() => {
        reloadCurrentFile();
      }, 2000); // Check every 2 seconds

      return () => clearInterval(interval);
    }
  }, [showPreview, selectedFile, projectId]);


  useEffect(() => { 
    let mounted = true;
    let timer: NodeJS.Timeout | null = null;
    
    const initializeChat = async () => {
      if (!mounted) return;
      
      // Load project info first to get project-specific settings
      const projectSettings = await loadProjectInfo();
      
      // Then load global settings as fallback, passing project settings
      await loadSettings(projectSettings);
      
      // Always load the file tree regardless of project status
      await loadTree('.');
      
      // Only set initializing to false if project is active
      if (projectStatus === 'active') {
        setIsInitializing(false);
      }
    };
    
    initializeChat();
    loadDeployStatus().then(() => {
      // 배포 상태 로드 후 진행 중인 배포 확인
      checkCurrentDeployment();
    });
    
    // Listen for service updates from Settings
    const handleServicesUpdate = () => {
      loadDeployStatus();
    };
    
    // Cleanup function to stop preview server when page is unloaded
    const handleBeforeUnload = () => {
      // Send a request to stop the preview server
      navigator.sendBeacon(`${API_BASE}/api/projects/${projectId}/preview/stop`);
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('services-updated', handleServicesUpdate);
    
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
      
      // Clean up event listeners
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('services-updated', handleServicesUpdate);
      
      // Stop preview server when component unmounts
      if (previewUrl) {
        fetch(`${API_BASE}/api/projects/${projectId}/preview/stop`, { method: 'POST' })
          .catch(() => {});
      }
    };
  }, [projectId, previewUrl, loadDeployStatus, checkCurrentDeployment]);

  // React to global settings changes when using global defaults
  const { settings: globalSettings } = useGlobalSettings();
  useEffect(() => {
    if (!usingGlobalDefaults) return;
    if (!globalSettings) return;

    const cli = globalSettings.default_cli || 'claude';
    setPreferredCli(cli);

    const modelFromGlobal = globalSettings.cli_settings?.[cli]?.model;
    if (modelFromGlobal) {
      setSelectedModel(modelFromGlobal);
    } else {
      // Fallback per CLI
      if (cli === 'claude') setSelectedModel('claude-sonnet-4');
      else if (cli === 'cursor') setSelectedModel('gpt-5');
      else if (cli === 'codex') setSelectedModel('gpt-5');
      else setSelectedModel('');
    }
  }, [globalSettings, usingGlobalDefaults]);


  // Show loading UI if project is initializing

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Loading Chat Interface
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please wait while we initialize the chat interface...
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
