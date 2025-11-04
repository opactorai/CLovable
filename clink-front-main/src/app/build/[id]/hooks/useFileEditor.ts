'use client';

import { useCallback, useRef, useState } from 'react';
import { chatService } from '@/lib/chat';

interface UseFileEditorOptions {
  workspacePath?: string;
  notifyActivity?: (
    source?: string,
    options?: { autoStart?: boolean },
  ) => void;
}

interface UseFileEditorReturn {
  content: string;
  isLoading: boolean;
  isSaving: boolean;
  dirty: boolean;
  error: string | null;
  lastSavedAt: number | null;
  loadContent: (filePath: string) => Promise<void>;
  updateContent: (value: string) => void;
  saveContent: (filePath?: string) => Promise<void>;
  reset: () => void;
  setError: (value: string | null) => void;
  dirtyFiles: Record<string, boolean>;
  evictFile: (filePath: string) => void;
  refreshFiles: (filePaths: string[]) => Promise<void>;
}

export const useFileEditor = (
  options: UseFileEditorOptions = {},
): UseFileEditorReturn => {
  const { workspacePath, notifyActivity } = options;
  const [content, setContent] = useState('');
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [dirtyFiles, setDirtyFiles] = useState<Record<string, boolean>>({});

  const contentCacheRef = useRef<Map<string, string>>(new Map());
  const dirtyMapRef = useRef<Record<string, boolean>>({});
  const lastSavedMapRef = useRef<Record<string, number | null>>({});
  const activeRequestRef = useRef<symbol | null>(null);

  const loadContent = useCallback(
    async (filePath: string) => {
      const requestToken = Symbol(filePath);
      activeRequestRef.current = requestToken;

      const cachedContent = contentCacheRef.current.get(filePath);
      const cachedDirty = dirtyMapRef.current[filePath] ?? false;
      const cachedLastSaved = lastSavedMapRef.current[filePath] ?? null;

      // 파일을 열 때마다 항상 로딩 표시 - 최신화 피드백 제공
      setIsLoading(true);
      setError(null);
      setCurrentFile(filePath);

      // 캐시된 내용이 있으면 먼저 보여주되, 항상 서버에서 최신 내용을 가져옴
      if (cachedContent !== undefined) {
        setContent(cachedContent);
        setDirty(cachedDirty);
        setLastSavedAt(cachedLastSaved);
      } else {
        setContent('');
        setDirty(false);
        setLastSavedAt(null);
      }

      try {
        notifyActivity?.('file:content:get');
        const value = await chatService.getFileContent(
          filePath,
          workspacePath ? { workspacePath } : undefined,
        );

        if (activeRequestRef.current !== requestToken) {
          return;
        }

        contentCacheRef.current.set(filePath, value);
        dirtyMapRef.current = { ...dirtyMapRef.current, [filePath]: false };
        lastSavedMapRef.current = { ...lastSavedMapRef.current, [filePath]: null };

        setContent(value);
        setDirty(false);
        setDirtyFiles({ ...dirtyMapRef.current });
        setLastSavedAt(null);
      } catch (err) {
        if (activeRequestRef.current !== requestToken) {
          return;
        }

        const message = err instanceof Error ? err.message : '파일을 불러오지 못했습니다.';
        setError(message);
        setContent('');
        setDirty(false);
        setLastSavedAt(null);
      } finally {
        if (activeRequestRef.current === requestToken) {
          setIsLoading(false);
        }
      }
    },
    [notifyActivity, workspacePath],
  );

  const updateContent = useCallback((value: string) => {
    setContent(value);
    setDirty(true);
    setError(null);
    if (currentFile) {
      contentCacheRef.current.set(currentFile, value);
      dirtyMapRef.current = { ...dirtyMapRef.current, [currentFile]: true };
      setDirtyFiles({ ...dirtyMapRef.current });
    }
  }, [currentFile]);

  const saveContent = useCallback(
    async (filePath?: string) => {
      const targetPath = filePath ?? currentFile;
      if (!targetPath) {
        return;
      }

      setIsSaving(true);
      setError(null);

      try {
        notifyActivity?.('file:content:update');
        await chatService.updateFileContent(
          targetPath,
          content,
          workspacePath ? { workspacePath } : undefined,
        );
        setDirty(false);
        const savedAt = Date.now();
        setLastSavedAt(savedAt);
        contentCacheRef.current.set(targetPath, content);
        dirtyMapRef.current = { ...dirtyMapRef.current, [targetPath]: false };
        lastSavedMapRef.current = {
          ...lastSavedMapRef.current,
          [targetPath]: savedAt,
        };
        setDirtyFiles({ ...dirtyMapRef.current });
      } catch (err) {
        const message = err instanceof Error ? err.message : '파일을 저장하지 못했습니다.';
        setError(message);
      } finally {
        setIsSaving(false);
      }
    },
    [content, currentFile, notifyActivity, workspacePath],
  );

  const reset = useCallback(() => {
    setContent('');
    setCurrentFile(null);
    setDirty(false);
    setError(null);
    setIsLoading(false);
    setIsSaving(false);
    setLastSavedAt(null);
    contentCacheRef.current.clear();
    dirtyMapRef.current = {};
    lastSavedMapRef.current = {};
    activeRequestRef.current = null;
    setDirtyFiles({});
  }, []);

  const evictFile = useCallback((filePath: string) => {
    contentCacheRef.current.delete(filePath);

    if (dirtyMapRef.current[filePath] !== undefined) {
      const nextDirty = { ...dirtyMapRef.current };
      delete nextDirty[filePath];
      dirtyMapRef.current = nextDirty;
      setDirtyFiles(nextDirty);
    }

    if (lastSavedMapRef.current[filePath] !== undefined) {
      const nextSaved = { ...lastSavedMapRef.current };
      delete nextSaved[filePath];
      lastSavedMapRef.current = nextSaved;
    }
  }, []);

  const refreshFiles = useCallback(
    async (filePaths: string[]) => {
      const uniquePaths = Array.from(
        new Set(
          filePaths.filter((path): path is string => typeof path === 'string' && path.length > 0),
        ),
      );

      await Promise.all(
        uniquePaths.map(async (path) => {
          if (dirtyMapRef.current[path]) {
            return;
          }

          const shouldUpdateActive = currentFile === path && !dirtyMapRef.current[path];

          try {
            if (shouldUpdateActive) {
              setIsLoading(true);
            }

            notifyActivity?.('file:content:refresh');
            const value = await chatService.getFileContent(
              path,
              workspacePath ? { workspacePath } : undefined,
            );

            contentCacheRef.current.set(path, value);
            dirtyMapRef.current = { ...dirtyMapRef.current, [path]: false };
            setDirtyFiles({ ...dirtyMapRef.current });

            if (path === currentFile && !dirtyMapRef.current[path]) {
              setContent(value);
              setDirty(false);
              setLastSavedAt(lastSavedMapRef.current[path] ?? null);
            }
          } catch (error) {
            console.error('Failed to refresh file content:', error);
          } finally {
            if (shouldUpdateActive) {
              setIsLoading(false);
            }
          }
        }),
      );
    },
    [currentFile, notifyActivity, workspacePath],
  );

  return {
    content,
    isLoading,
    isSaving,
    dirty,
    error,
    lastSavedAt,
    loadContent,
    updateContent,
    saveContent,
    reset,
    setError,
    dirtyFiles,
    evictFile,
    refreshFiles,
  };
};
