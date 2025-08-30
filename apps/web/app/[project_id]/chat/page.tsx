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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

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
        
        /* Dark mode overrides */
        .dark .hljs {
          background: #374151 !important;
          color: #f9fafb !important;
        }
        
        .dark .hljs-punctuation,
        .dark .hljs-bracket,
        .dark .hljs-operator {
          color: #f9fafb !important;
        }
        
        .dark .hljs-built_in,
        .dark .hljs-keyword {
          color: #a78bfa !important;
        }
        
        .dark .hljs-string {
          color: #34d399 !important;
        }
        
        .dark .hljs-number {
          color: #f87171 !important;
        }
        
        .dark .hljs-comment {
          color: #9ca3af !important;
        }
        
        .dark .hljs-function,
        .dark .hljs-title {
          color: #60a5fa !important;
        }
        
        .dark .hljs-variable,
        .dark .hljs-attr {
          color: #f87171 !important;
        }
        
        .dark .hljs-tag,
        .dark .hljs-name {
          color: #34d399 !important;
        }
      `}</style>

      <div className="h-screen bg-white dark:bg-black flex relative overflow-hidden">
        <div className="h-full w-full flex">
          {/* 왼쪽: 채팅창 */}
          <div
            style={{ width: '30%' }}
            className="h-full border-r border-gray-200 dark:border-gray-800 flex flex-col"
          >
            {/* 채팅 헤더 */}
            <div className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 p-4 h-[73px] flex items-center">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => router.push('/')}
                  className="flex items-center justify-center w-8 h-8 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  title="Back to home"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{projectName || 'Loading...'}</h1>
                  {projectDescription && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {projectDescription}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* 채팅 로그 영역 */}
            <div className="flex-1 min-h-0">
              <ChatLog 
                projectId={projectId} 
                onSessionStatusChange={(isRunningValue) => {
                  console.log('🔍 [DEBUG] Session status change:', isRunningValue);
                  setIsRunning(isRunningValue);
                  // Agent 작업 완료 상태 추적 및 자동 preview 시작
                  if (!isRunningValue && hasInitialPrompt && !agentWorkComplete && !previewUrl) {
                    setAgentWorkComplete(true);
                    // Save to localStorage
                    localStorage.setItem(`project_${projectId}_taskComplete`, 'true');
                    // Initial prompt 작업 완료 후 자동으로 preview 서버 시작
                    start();
                  }
                }}
                onProjectStatusUpdate={handleProjectStatusUpdate}
                startRequest={startRequest}
                completeRequest={completeRequest}
              />
            </div>
            
            {/* 간단한 입력 영역 */}
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
              />
            </div>
          </div>

          {/* 오른쪽: Preview/Code 영역 */}
          <div className="h-full flex flex-col bg-black" style={{ width: '70%' }}>
            {/* 컨텐츠 영역 */}
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Controls Bar */}
              <div className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 px-4 h-[73px] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* 토글 스위치 */}
                  <div className="flex items-center bg-gray-100 dark:bg-gray-900 rounded-lg p-1">
                    <button
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        showPreview 
                          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white' 
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                      onClick={() => setShowPreview(true)}
                    >
                      <span className="w-4 h-4 flex items-center justify-center"><FaDesktop size={16} /></span>
                    </button>
                    <button
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        !showPreview 
                          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white' 
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
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
                      <div className="h-9 flex items-center bg-gray-100 dark:bg-gray-900 rounded-lg px-3 border border-gray-200 dark:border-gray-700">
                        <span className="text-gray-400 dark:text-gray-500 mr-2">
                          <FaHome size={12} />
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">/</span>
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
                          className="bg-transparent text-sm text-gray-700 dark:text-gray-300 outline-none w-40"
                          placeholder="route"
                        />
                        <button
                          onClick={() => navigateToRoute(currentRoute)}
                          className="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          <FaArrowRight size={12} />
                        </button>
                      </div>
                      
                      {/* Action Buttons Group */}
                      <div className="flex items-center gap-1.5">
                        <button 
                          className="h-9 w-9 flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
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
                        <div className="h-9 flex items-center gap-1 bg-gray-100 dark:bg-gray-900 rounded-lg px-1 border border-gray-200 dark:border-gray-700">
                          <button
                            aria-label="Desktop preview"
                            className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${
                              deviceMode === 'desktop' 
                                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' 
                                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}
                            onClick={() => setDeviceMode('desktop')}
                          >
                            <FaDesktop size={14} />
                          </button>
                          <button
                            aria-label="Mobile preview"
                            className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${
                              deviceMode === 'mobile' 
                                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' 
                                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
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
                    className="h-9 w-9 flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
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
                      className="h-9 flex items-center gap-2 px-3 bg-black text-white rounded-lg text-sm font-medium transition-colors hover:bg-gray-900 border border-black/10 dark:border-white/10 shadow-sm"
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
                      <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 p-5">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Publish Project</h3>
                        
                        {/* Deployment Status Display */}
                        {deploymentStatus === 'deploying' && (
                          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                              <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Deployment in progress...</p>
                            </div>
                            <p className="text-xs text-blue-600 dark:text-blue-300">Building and deploying your project. This may take a few minutes.</p>
                          </div>
                        )}
                        
                        {deploymentStatus === 'ready' && publishedUrl && (
                          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                            <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">Currently published at:</p>
                            <a 
                              href={publishedUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-sm text-green-600 dark:text-green-300 font-mono hover:underline break-all"
                            >
                              {publishedUrl}
                            </a>
                          </div>
                        )}
                        
                        {deploymentStatus === 'error' && (
                          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                            <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Deployment failed</p>
                            <p className="text-xs text-red-600 dark:text-red-300">There was an error during deployment. Please try again.</p>
                          </div>
                        )}
                        
                        <div className="space-y-4">
                          {!githubConnected || !vercelConnected ? (
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                              <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">To publish, connect the following services:</p>
                              <div className="space-y-2">
                                {!githubConnected && (
                                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-sm">GitHub repository not connected</span>
                                  </div>
                                )}
                                {!vercelConnected && (
                                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-sm">Vercel project not connected</span>
                                  </div>
                                )}
                              </div>
                              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                                Go to 
                                <button
                                  onClick={() => {
                                    setShowPublishPanel(false);
                                    setShowGlobalSettings(true);
                                  }}
                                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 underline font-medium mx-1"
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
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ branch: 'main' })
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
                                  if (data.ready && data.deployment_url) {
                                    const url = data.deployment_url.startsWith('http') ? data.deployment_url : `https://${data.deployment_url}`;
                                    setPublishedUrl(url);
                                    setDeploymentStatus('ready');
                                  }
                                } else {
                                  const errorText = await vercelRes.text();
                                  console.error('🚀 Vercel deploy failed:', vercelRes.status, errorText);
                                  // if Vercel not connected, just close
                                  setDeploymentStatus('idle');
                                  setPublishLoading(false); // Vercel 배포 실패 시에도 loading 중단
                                }
                                // Keep panel open to show deployment progress
                              } catch (e) {
                                console.error('🚀 Publish failed:', e);
                                alert('Publish failed. Check Settings and tokens.');
                                setDeploymentStatus('idle');
                                setPublishLoading(false); // 에러 시에는 loading 중단
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
                                ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed' 
                                : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600'
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
                <AnimatePresence mode="wait">
                  {showPreview ? (
                  <MotionDiv
                    key="preview"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ height: '100%' }}
                  >
                {previewUrl ? (
                  <div className="relative w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <div 
                      className={`bg-white dark:bg-gray-900 ${
                        deviceMode === 'mobile' 
                          ? 'w-[375px] h-[667px] rounded-[25px] border-8 border-gray-800 shadow-2xl' 
                          : 'w-full h-full'
                      } overflow-hidden`}
                    >
                      <iframe 
                        ref={iframeRef}
                        className="w-full h-full border-none bg-white dark:bg-gray-800"
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
                      className="absolute inset-0 bg-gray-50 dark:bg-gray-900 flex items-center justify-center z-10"
                      style={{ display: 'none' }}
                    >
                      <div className="text-center max-w-md mx-auto p-6">
                        <div className="text-4xl mb-4">🔄</div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                          Connection Issue
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                          The preview couldn't load properly. Try clicking the refresh button to reload the page.
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
                  <div className="h-full w-full flex items-center justify-center bg-gray-50 dark:bg-black relative">
                    {/* Gradient background similar to main page */}
                    <div className="absolute inset-0">
                      <div className="absolute inset-0 bg-white dark:bg-black" />
                      <div 
                        className="absolute inset-0 dark:block hidden transition-all duration-1000 ease-in-out"
                        style={{
                          background: `radial-gradient(circle at 50% 100%, 
                            ${assistantBrandColors[preferredCli] || assistantBrandColors.claude}66 0%, 
                            ${assistantBrandColors[preferredCli] || assistantBrandColors.claude}4D 25%, 
                            ${assistantBrandColors[preferredCli] || assistantBrandColors.claude}33 50%, 
                            transparent 70%)`
                        }}
                      />
                      {/* Light mode gradient - subtle */}
                      <div 
                        className="absolute inset-0 block dark:hidden transition-all duration-1000 ease-in-out"
                        style={{
                          background: `radial-gradient(circle at 50% 100%, 
                            ${assistantBrandColors[preferredCli] || assistantBrandColors.claude}40 0%, 
                            ${assistantBrandColors[preferredCli] || assistantBrandColors.claude}26 25%, 
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
                              backgroundColor: assistantBrandColors[preferredCli] || assistantBrandColors.claude,
                              mask: 'url(/Symbol_white.png) no-repeat center/contain',
                              WebkitMask: 'url(/Symbol_white.png) no-repeat center/contain',
                              opacity: 0.9
                            }}
                          />
                          
                          {/* Loading spinner in center */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div 
                              className="w-14 h-14 border-4 border-t-transparent rounded-full animate-spin"
                              style={{
                                borderColor: assistantBrandColors[preferredCli] || assistantBrandColors.claude,
                                borderTopColor: 'transparent'
                              }}
                            />
                          </div>
                        </div>
                        
                        {/* Content */}
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                          Starting Preview Server
                        </h3>
                        
                        <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400">
                          <span>{previewInitializationMessage}</span>
                          <MotionDiv
                            className="flex gap-1 ml-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          >
                            <MotionDiv
                              animate={{ opacity: [0, 1, 0] }}
                              transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                              className="w-1 h-1 bg-gray-600 dark:bg-gray-400 rounded-full"
                            />
                            <MotionDiv
                              animate={{ opacity: [0, 1, 0] }}
                              transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                              className="w-1 h-1 bg-gray-600 dark:bg-gray-400 rounded-full"
                            />
                            <MotionDiv
                              animate={{ opacity: [0, 1, 0] }}
                              transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
                              className="w-1 h-1 bg-gray-600 dark:bg-gray-400 rounded-full"
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
                                    backgroundColor: assistantBrandColors[preferredCli] || assistantBrandColors.claude,
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
                                    backgroundColor: assistantBrandColors[preferredCli] || assistantBrandColors.claude,
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
                                    className="w-14 h-14 border-4 border-t-transparent rounded-full animate-spin"
                                    style={{
                                      borderColor: assistantBrandColors[preferredCli] || assistantBrandColors.claude,
                                      borderTopColor: 'transparent'
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
                            
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                              Preview Not Running
                            </h3>
                            
                            <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
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
                className="h-full flex bg-white dark:bg-gray-950"
              >
                {/* Left Sidebar - File Explorer (VS Code style) */}
                <div className="w-64 flex-shrink-0 bg-gray-50 dark:bg-[#0a0a0a] border-r border-gray-200 dark:border-[#1a1a1a] flex flex-col">
                  {/* File Tree */}
                  <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#0a0a0a] custom-scrollbar">
                    {!tree || tree.length === 0 ? (
                      <div className="px-3 py-8 text-center text-[11px] text-gray-600 dark:text-[#6a6a6a] select-none">
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
                <div className="flex-1 flex flex-col bg-white dark:bg-[#0d0d0d] min-w-0">
                  {selectedFile ? (
                    <>
                      {/* File Tab */}
                      <div className="flex-shrink-0 bg-gray-100 dark:bg-[#1a1a1a]">
                        <div className="flex items-center">
                          <div className="flex items-center gap-2 bg-white dark:bg-[#0d0d0d] px-3 py-1.5 border-t-2 border-t-blue-500 dark:border-t-[#007acc]">
                            <span className="w-4 h-4 flex items-center justify-center">
                              {getFileIcon(tree.find(e => e.path === selectedFile) || { path: selectedFile, type: 'file' })}
                            </span>
                            <span className="text-[13px] text-gray-700 dark:text-[#cccccc]" style={{ fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
                              {selectedFile.split('/').pop()}
                            </span>
                            {isFileUpdating && (
                              <span className="text-[11px] text-green-600 dark:text-green-400 ml-auto mr-2">
                                Updated
                              </span>
                            )}
                            <button 
                              className="text-gray-700 dark:text-[#cccccc] hover:bg-gray-200 dark:hover:bg-[#383838] ml-2 px-1 rounded"
                              onClick={() => {
                                setSelectedFile('');
                                setContent('');
                              }}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Code Editor */}
                      <div className="flex-1 overflow-hidden">
                        <div className="w-full h-full flex bg-white dark:bg-[#0d0d0d] overflow-hidden">
                          {/* Line Numbers */}
                          <div className="bg-gray-50 dark:bg-[#0d0d0d] px-3 py-4 select-none flex-shrink-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
                            <div className="text-[13px] font-mono text-gray-500 dark:text-[#858585] leading-[19px]">
                              {(content || '').split('\n').map((_, index) => (
                                <div key={index} className="text-right pr-2">
                                  {index + 1}
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Code Content */}
                          <div className="flex-1 overflow-auto custom-scrollbar">
                            <pre className="p-4 text-[13px] leading-[19px] font-mono text-gray-800 dark:text-[#d4d4d4] whitespace-pre" style={{ fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace" }}>
                              <code 
                                className={`language-${getFileLanguage(selectedFile)}`}
                                dangerouslySetInnerHTML={{
                                  __html: hljs && content ? hljs.highlight(content, { language: getFileLanguage(selectedFile) }).value : (content || '')
                                }}
                              />
                            </pre>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Welcome Screen */
                    <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#0d0d0d]">
                      <div className="text-center">
                        <span className="w-16 h-16 mb-4 opacity-10 text-gray-400 dark:text-[#3c3c3c] mx-auto flex items-center justify-center"><FaCode size={64} /></span>
                        <h3 className="text-lg font-medium text-gray-700 dark:text-[#cccccc] mb-2">
                          Welcome to Code Editor
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-[#858585]">
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
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/60 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-black border border-black/10 dark:border-white/10">
                  <FaRocket size={14} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Publish Project</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Deploy with Vercel, linked to your GitHub repo</p>
                </div>
              </div>
              <button onClick={() => setShowPublishPanel(false)} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {deploymentStatus === 'deploying' && (
                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Deployment in progress…</p>
                  </div>
                  <p className="text-xs text-blue-700/80 dark:text-blue-300/80">Building and deploying your project. This may take a few minutes.</p>
                </div>
              )}

              {deploymentStatus === 'ready' && publishedUrl && (
                <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-2">Published successfully</p>
                  <div className="flex items-center gap-2">
                    <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-mono text-emerald-700 dark:text-emerald-300 underline break-all flex-1">
                      {publishedUrl}
                    </a>
                    <button
                      onClick={() => navigator.clipboard?.writeText(publishedUrl)}
                      className="px-2 py-1 text-xs rounded-lg border border-emerald-300/80 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              {deploymentStatus === 'error' && (
                <div className="p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">Deployment failed. Please try again.</p>
                </div>
              )}

              {!githubConnected || !vercelConnected ? (
                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">Connect the following services:</p>
                  <div className="space-y-1 text-amber-700 dark:text-amber-400 text-sm">
                    {!githubConnected && (<div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"/>GitHub repository not connected</div>)}
                    {!vercelConnected && (<div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"/>Vercel project not connected</div>)}
                  </div>
                  <button
                    className="mt-3 w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
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
                    ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
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
        initialTab="services"
      />
    </>
  );
}
