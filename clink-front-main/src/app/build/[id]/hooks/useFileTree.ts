'use client';

import { useCallback, useState } from 'react';
import { chatService } from '@/lib/chat';
import type { FileNode } from '@/lib/chat';

interface UseFileTreeReturn {
  fileTree: FileNode[];
  expandedFolders: Set<string>;
  selectedFile: string | null;
  openFiles: string[];
  loadFileTree: () => Promise<FileNode[]>;
  toggleFolder: (path: string) => void;
  selectFile: (path: string | null) => void;
  closeFile: (path: string) => void;
  resetFileTree: () => void;
  expandToFile: (filePath: string) => void;
}

export const useFileTree = (
  options: {
    notifyActivity?: (source?: string, opts?: { autoStart?: boolean }) => void;
  } = {},
): UseFileTreeReturn => {
  const { notifyActivity } = options;
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);

  const loadFileTree = useCallback(async () => {
    try {
      notifyActivity?.('file:tree');
      const files = await chatService.getProjectFiles();
      setFileTree(files);
      return files;
    } catch (error) {
      console.error('Failed to load file tree:', error);
      return [];
    }
  }, [notifyActivity]);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const selectFile = useCallback((path: string | null) => {
    if (!path) {
      setSelectedFile(null);
      return;
    }

    setSelectedFile(path);
    setOpenFiles((prev) => {
      if (prev.includes(path)) {
        return prev;
      }
      return [...prev, path];
    });
  }, []);

  const closeFile = useCallback((path: string) => {
    setOpenFiles((prev) => {
      if (!prev.includes(path)) {
        return prev;
      }
      const index = prev.indexOf(path);
      const next = prev.filter((item) => item !== path);

      setSelectedFile((current) => {
        if (current !== path) {
          return current;
        }

        if (next.length === 0) {
          return null;
        }

        const fallbackIndex = index > 0 ? index - 1 : 0;
        return next[fallbackIndex];
      });

      return next;
    });
  }, []);

  const resetFileTree = useCallback(() => {
    setFileTree([]);
    setExpandedFolders(new Set());
    setSelectedFile(null);
    setOpenFiles([]);
  }, []);

  const expandToFile = useCallback((filePath: string) => {
    // Extract all parent folder paths from the file path
    const parts = filePath.split('/');
    const foldersToExpand = new Set<string>();

    // Build paths for all parent folders
    for (let i = 1; i < parts.length; i++) {
      const folderPath = parts.slice(0, i).join('/');
      if (folderPath) {
        foldersToExpand.add(folderPath);
      }
    }

    // Expand all parent folders
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      foldersToExpand.forEach((folder) => next.add(folder));
      return next;
    });
  }, []);

  return {
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
  };
};
