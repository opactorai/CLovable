'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { FileNode, chatService } from '@/lib/chat';
import {
  CodeXml,
  Loader2,
  X,
  ChevronRight,
  ChevronDown,
  Download,
  GitCommit,
} from 'lucide-react';
import { FileIcon, FolderIcon } from './FileIcons';
import { patchToContent, getLanguageFromFilename } from '@/lib/utils/patch-parser';

// Dynamically import CodeEditor to avoid Monaco Editor compilation during initial page load
const CodeEditor = dynamic(() => import('./CodeEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="animate-spin text-gray-400" size={24} />
    </div>
  ),
});

// Dynamically import CodeDiffEditor
const CodeDiffEditor = dynamic(() => import('./CodeDiffEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="animate-spin text-gray-400" size={24} />
    </div>
  ),
});

interface CodePanelProps {
  projectId: string;
  projectName: string;
  fileTree: FileNode[];
  expandedFolders: Set<string>;
  selectedFile: string | null;
  openFiles: string[];
  onToggleFolder: (path: string) => void;
  onSelectFile: (path: string) => void;
  onSelectTab: (path: string | null) => void;
  onCloseTab: (path: string) => void;
  dirtyFiles: Record<string, boolean>;
  content: string;
  isLoading: boolean;
  isSaving: boolean;
  dirty: boolean;
  lastSavedAt: number | null;
  error: string | null;
  onContentChange: (value: string) => void;
  onConfirm: () => void;
  highlightRequest?: { line: number; timestamp: number } | null;
  projectType?: 'base' | 'dev' | 'BASE' | 'DEV';
  devServerUrl?: string | null;
  turnDiff?: any | null;
  onCloseTurnDiff?: () => void;
  onTempRestore?: () => Promise<void>;
  onConfirmRestore?: () => Promise<void>;
  onCancelRestore?: () => Promise<void>;
  restoreState?: Record<string, 'idle' | 'loading' | 'confirming'>;
}


const FILE_STATUS_META = {
  added: {
    label: 'Added',
    badgeClass:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  deleted: {
    label: 'Deleted',
    badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  },
  modified: {
    label: 'Modified',
    badgeClass:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
} as const;

type FileStatusKey = keyof typeof FILE_STATUS_META;

const normalizeFileStatus = (status: unknown): FileStatusKey => {
  if (typeof status === 'string') {
    const lowered = status.toLowerCase();
    if (lowered === 'added' || lowered === 'deleted' || lowered === 'modified') {
      return lowered;
    }
  }
  return 'modified';
};

const extensionLanguageMap: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',
  html: 'markup',
  htm: 'markup',
  md: 'markdown',
  mdx: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  env: 'bash',
  conf: 'bash',
  config: 'bash',
  go: 'go',
  rs: 'rust',
  py: 'python',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  sql: 'sql',
  diff: 'diff',
  lock: 'json',
  toml: 'toml',
};

const filenameLanguageMap: Record<string, string> = {
  dockerfile: 'bash',
  makefile: 'bash',
  gitignore: 'bash',
  npmrc: 'bash',
  yarnrc: 'bash',
  pnpmrc: 'bash',
  'package.json': 'json',
  'tsconfig.json': 'json',
  'jsconfig.json': 'json',
  'composer.json': 'json',
};

const getLanguageFromPath = (path: string | null): string => {
  if (!path) {
    return 'plain';
  }

  const name = path.split('/').pop()?.toLowerCase() ?? '';
  if (filenameLanguageMap[name]) {
    return filenameLanguageMap[name];
  }

  const baseName = name.replace(/\.[^/.]+$/, '');
  if (filenameLanguageMap[baseName]) {
    return filenameLanguageMap[baseName];
  }

  const parts = name.split('.');
  const extension = parts.length > 1 ? parts.pop() ?? '' : '';

  if (extension && extensionLanguageMap[extension]) {
    return extensionLanguageMap[extension];
  }

  return 'plain';
};

const renderFileTree = (
  nodes: FileNode[],
  expandedFolders: Set<string>,
  selectedFile: string | null,
  onToggleFolder: (path: string) => void,
  onSelectFile: (path: string) => void,
  highlightedFile: string | null,
  depth = 0,
): JSX.Element[] => {
  return nodes.flatMap((node) => {
    const paddingLeft = 8 + depth * 16;

    if (node.type === 'folder') {
      const isExpanded = expandedFolders.has(node.path);
      const hasChildren = node.children && node.children.length > 0;

      const chevron = hasChildren ? (
        isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-tertiary flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-tertiary flex-shrink-0" />
        )
      ) : (
        <div className="w-3.5 h-3.5 flex-shrink-0" />
      );

      const folderButton = (
        <button
          key={node.path}
          type="button"
          onClick={() => onToggleFolder(node.path)}
          className="flex items-center gap-1.5 w-full text-left px-2 py-1 text-xs text-secondary hover:bg-interactive-hover rounded transition-colors"
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          {chevron}
          <FolderIcon folderName={node.name} isOpen={isExpanded} />
          <span className="truncate">{node.name}</span>
        </button>
      );

      if (!node.children || node.children.length === 0 || !isExpanded) {
        return [folderButton];
      }

      return [
        folderButton,
        ...renderFileTree(
          node.children,
          expandedFolders,
          selectedFile,
          onToggleFolder,
          onSelectFile,
          highlightedFile,
          depth + 1,
        ),
      ];
    }

    const isSelected = selectedFile === node.path;
    const isHighlighted = highlightedFile === node.path;
    return [
      <button
        key={node.path}
        type="button"
        onClick={() => onSelectFile(node.path)}
        className={`flex items-center gap-1.5 w-full text-left px-2 py-1 text-xs rounded transition-all duration-300 ${
          isHighlighted
            ? 'bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
            : isSelected
            ? 'bg-interactive-secondary text-primary'
            : 'text-tertiary hover:bg-interactive-hover'
        }`}
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        <div className="w-3.5 h-3.5 flex-shrink-0" />
        <FileIcon fileName={node.name} />
        <span className="truncate">{node.name}</span>
      </button>,
    ];
  });
};

export const CodePanel = ({
  projectId,
  projectName,
  fileTree,
  expandedFolders,
  selectedFile,
  openFiles,
  onToggleFolder,
  onSelectFile,
  onSelectTab,
  onCloseTab,
  dirtyFiles,
  content,
  isLoading,
  isSaving,
  dirty,
  lastSavedAt,
  error,
  onContentChange,
  onConfirm,
  highlightRequest,
  projectType,
  devServerUrl,
  turnDiff,
  onCloseTurnDiff,
  onTempRestore,
  onConfirmRestore,
  onCancelRestore,
  restoreState = {},
}: CodePanelProps) => {
  const [highlightedFile, setHighlightedFile] = useState<string | null>(null);
  const [selectedDiffIndex, setSelectedDiffIndex] = useState(0);

  // Highlight the selected file for 1 second when it changes
  useEffect(() => {
    if (selectedFile) {
      setHighlightedFile(selectedFile);
      const timer = setTimeout(() => {
        setHighlightedFile(null);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedFile]);

  // Reset selected diff index when turnDiff changes
  useEffect(() => {
    setSelectedDiffIndex(0);
  }, [turnDiff]);

  const treeItems = useMemo(
    () =>
      renderFileTree(
        fileTree,
        expandedFolders,
        selectedFile,
        onToggleFolder,
        onSelectFile,
        highlightedFile,
      ),
    [fileTree, expandedFolders, selectedFile, onToggleFolder, onSelectFile, highlightedFile],
  );

  const editorLanguage = getLanguageFromPath(selectedFile);
  const selectedFileLabel = selectedFile ?? 'No file selected';

  // If turnDiff is provided, show diff view instead of file editor
  if (turnDiff) {
    const files = (Array.isArray(turnDiff?.files) ? turnDiff.files : []).map(
      (file: any) => ({
        ...file,
        status: normalizeFileStatus(file?.status),
      }),
    );
    const selected = files[selectedDiffIndex] || null;

    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-primary h-full">
        {/* Header with commit message */}
        <div className="h-10 flex items-center justify-between px-3 border-b border-primary flex-shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <GitCommit className="w-4 h-4 text-tertiary flex-shrink-0" />
            <div className="text-sm font-medium text-primary truncate">{turnDiff.commitMessage || 'Git Changes'}</div>
          </div>
          <button onClick={onCloseTurnDiff} className="px-2 py-1 text-xs text-tertiary hover:text-primary">
            <X className="w-4 h-4" />
          </button>
        </div>

        {turnDiff.stats ? (
          <div className="px-3 py-2 text-xs text-tertiary border-b border-primary">
            {turnDiff.stats}
          </div>
        ) : null}

        <div className="flex-1 flex min-h-0">
          {/* Left: file list */}
          <div className="w-64 border-r border-primary overflow-auto file-tree-scrollbar">
            {files.map((f: any, idx: number) => {
              const statusKey = normalizeFileStatus(f?.status);
              const statusMeta = FILE_STATUS_META[statusKey];
              return (
                <button
                  key={`${f.filename}-${idx}`}
                  className={`w-full text-left px-3 py-2 text-xs border-b border-primary hover:bg-interactive-hover ${idx === selectedDiffIndex ? 'bg-interactive-secondary' : ''}`}
                  onClick={() => setSelectedDiffIndex(idx)}
                >
                  <div className="flex items-center gap-2 text-primary truncate">
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded ${statusMeta?.badgeClass ?? FILE_STATUS_META.modified.badgeClass}`}
                    >
                      {statusMeta?.label ?? FILE_STATUS_META.modified.label}
                    </span>
                    <span className="truncate">{f.filename}</span>
                  </div>
                  <div className="text-[11px] text-tertiary">
                    <span className="text-green-600 dark:text-green-500">+{f.additions || 0}</span>{' '}
                    <span className="text-red-600 dark:text-red-500">−{f.deletions || 0}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: diff view */}
          <div className="flex-1 overflow-hidden bg-white dark:bg-[#1e1e1e]">
            {selected ? (
              selected.patch ? (
                (() => {
                  try {
                    const { original, modified } = patchToContent(selected.patch);
                    const language = getLanguageFromFilename(selected.filename);
                    return (
                      <CodeDiffEditor
                        original={original}
                        modified={modified}
                        language={language}
                        filename={selected.filename}
                      />
                    );
                  } catch (e) {
                    console.error('Failed to parse diff:', e);
                    return (
                      <div className="p-4">
                        <div className="mb-3 text-xs font-semibold font-mono text-gray-800 dark:text-[#d4d4d4]">{selected.filename}</div>
                        <pre className="text-[11px] leading-5 whitespace-pre-wrap break-words font-mono p-4 text-gray-800 dark:text-[#d4d4d4]">
                          {selected.patch}
                        </pre>
                      </div>
                    );
                  }
                })()
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-gray-500 dark:text-[#858585]">
                  (no patch)
                </div>
              )
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500 dark:text-[#858585]">
                Select a file to view diff
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-primary h-full">
      {/* File Tree Sidebar */}
      <div className="w-64 flex flex-col h-full bg-transparent">
        <div className="px-1 py-1 border-b border-primary bg-primary flex-shrink-0 h-10 justify-between items-center flex">
          <div className="flex items-center gap-2">
            <h3 className="text-sm ml-2 font-medium text-primary">Project</h3>
            <button
              type="button"
              onClick={async () => {
                if (fileTree.length === 0) return;

                try {
                  console.log('Exporting project from GitHub...');

                  // Get the API base URL
                  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
                  const token = localStorage.getItem('token');

                  if (!token) {
                    alert('You must be logged in to export projects');
                    return;
                  }

                  // Call the backend export API
                  const response = await fetch(`${apiUrl}/api/projects/${projectId}/files/export/zip`, {
                    method: 'GET',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                    },
                  });

                  if (!response.ok) {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(error.message || 'Failed to export project');
                  }

                  // Use project name as filename
                  const sanitizedProjectName = projectName.replace(/[^a-zA-Z0-9-_]/g, '_');
                  const filename = `${sanitizedProjectName}.zip`;

                  // Download the ZIP file
                  const blob = await response.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);

                  console.log('Project exported successfully!');
                } catch (error) {
                  console.error('Failed to export project:', error);
                  alert(`Failed to export project: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }}
              disabled={fileTree.length === 0}
              className={`p-1 rounded hover:bg-interactive-hover transition-colors ${
                fileTree.length === 0 ? 'text-muted cursor-not-allowed' : 'text-tertiary hover:text-primary'
              }`}
              title="Export project as ZIP from GitHub"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center">
          <div className={`flex items-center gap-1 px-2 transition-opacity ${isSaving ? 'opacity-100' : 'opacity-0'}`}>
              <span className="text-xs text-tertiary flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
              </span>
            </div>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!selectedFile || isSaving || isLoading || !dirty}
              className={`px-2 py-1.5 rounded-full text-xs font-medium transition-colors ${
                !selectedFile || isSaving || isLoading || !dirty
                  ? 'text-muted cursor-not-allowed'
                  : 'bg-primary text-primary hover:bg-interactive-hover'
              }`}
            >
              Save
            </button>

          </div>

        </div>
        <div className="flex-1 overflow-y-auto py-1 px-1 min-h-0 file-tree-scrollbar">
          {treeItems.length > 0 ? (
            treeItems
          ) : (
            <p className="text-xs text-tertiary px-3 py-2">No files found</p>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-primary">
        {/* Tabs */}
        {openFiles.length > 0 && (
          <div className="border-b border-primary bg-secondary align-middle align-items-center justify-between flex px-1 h-10 flex-shrink-0">
            <div className="flex items-center flex-1 min-w-0">
              <div
                className="flex items-center gap-2 overflow-x-auto flex-1 scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {openFiles.map((path) => {
                  const isActive = path === selectedFile;
                  const isDirty = dirtyFiles[path];
                  const fileName = path.split('/').pop() ?? path;

                  return (
                    <div
                      key={path}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-all rounded-full flex-shrink-0 ${
                        isActive
                          ? 'bg-interactive-primary text-white dark:text-white font-medium shadow-sm'
                          : 'bg-interactive-secondary text-secondary hover:bg-interactive-hover'
                      }`}
                      title={path}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectTab(path)}
                        className="flex items-center gap-1.5 max-w-[140px]"
                      >
                        <span className="truncate">{fileName}</span>
                        {isDirty && <span className={`text-xs ${isActive ? 'text-blue-400' : 'text-blue-500'}`}>●</span>}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onCloseTab(path);
                        }}
                        className={`hover:bg-opacity-20 hover:bg-black rounded-full p-0.5 ${
                          isActive ? 'text-white' : 'text-tertiary hover:text-secondary'
                        }`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* Editor */}
        <div className="flex-1 min-h-0 relative">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center bg-secondary">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500 dark:text-blue-400 mb-2" />
              <span className="text-xs text-tertiary">Loading file...</span>
            </div>
          ) : selectedFile ? (
            <CodeEditor
              value={content}
              language={editorLanguage}
              onChange={onContentChange}
              highlightRequest={highlightRequest}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-secondary text-tertiary">
              <CodeXml className="w-12 h-12 mb-3 opacity-50" strokeWidth={1.7} />
              <span className="text-sm">Select a file to view</span>
            </div>
          )}
        </div>

        {/* Error Bar */}
        {error && (
          <div className="border-t border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <span className="font-semibold">Error:</span>
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export type { CodePanelProps };
