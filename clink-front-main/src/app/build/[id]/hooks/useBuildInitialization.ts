'use client';

import { useEffect, useState, type MutableRefObject } from 'react';
import { chatService } from '@/lib/chat';
import { clientLogger } from '@/lib/client-logger';
import { normalizeCli, resolveModelValue } from '@/lib/assistant-options';
import type { AssistantKey } from '@/lib/assistant-options';
import type { resumeSandboxAndWait as resumeSandboxAndWaitFn } from '@/lib/sandbox-resume';
import { needsResume } from '@/lib/sandbox-resume';
import { useLatest } from '@/hooks/use-latest';

export type EffortLevel = 'low' | 'medium' | 'high';

const isEffortLevel = (value: unknown): value is EffortLevel =>
  value === 'low' || value === 'medium' || value === 'high';

type ResumeSandboxAndWait = typeof resumeSandboxAndWaitFn;

export interface BuildInitializationOptions {
  projectId: string;
  resetLifecycle: () => void;
  resetChatState: (options?: { resetInitialPrompt?: boolean }) => void;
  resetFileTree: () => void;
  resetFileEditor: () => void;
  setFileError: (value: string | null) => void;
  setHasDevServer: (value: boolean) => void;
  setCurrentDeploymentSubdomain: (value: string | null) => void;
  setSubdomainName: (value: string, options?: { source?: 'auto' | 'user' | 'reset' }) => void;
  setIsPublishPanelOpen: (value: boolean) => void;
  hasRequestedFileTreeRef: MutableRefObject<boolean>;
  resetTurn: () => void;
  refreshProject: () => Promise<any | null>;
  resumeSandboxAndWait: ResumeSandboxAndWait;
  loadChatHistory: () => Promise<void>;
  hydrateSessions: () => Promise<void>;
  setSelectedCli: (cli: AssistantKey) => void;
  setSelectedModel: (model: string) => void;
  setSelectedEffort: (effort: EffortLevel) => void;
}

export interface BuildInitializationResult {
  status: 'idle' | 'running' | 'ready' | 'error';
  isReady: boolean;
  isResuming: boolean;
  resumeError: string | null;
}

export function useBuildInitialization({
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
}: BuildInitializationOptions): BuildInitializationResult {
  const [status, setStatus] = useState<'idle' | 'running' | 'ready' | 'error'>('idle');
  const [isResuming, setIsResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const actionsRef = useLatest({
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

  useEffect(() => {
    if (!projectId) {
      setStatus('idle');
      setIsResuming(false);
      setResumeError(null);
      return;
    }

    let cancelled = false;

    const initialise = async () => {
      setStatus('running');
      setResumeError(null);

      const actions = actionsRef.current;
      actions.resetLifecycle();
      actions.resetChatState({ resetInitialPrompt: true });
      actions.resetFileTree();
      actions.resetFileEditor();
      actions.setFileError(null);
      actions.setHasDevServer(false);
      actions.setCurrentDeploymentSubdomain(null);
      actions.setSubdomainName('', { source: 'reset' });
      actions.setIsPublishPanelOpen(false);
      actions.hasRequestedFileTreeRef.current = false;
      actions.resetTurn();

      setIsResuming(true);

      try {
        await chatService.initializeProject(projectId);

        let projectData = await actions.refreshProject();
        if (cancelled) {
          return;
        }

        // Skip sandbox resume for Import mode (Railway deployment doesn't need it)
        const isImportMode = projectData?.projectType === 'dev';

        if (projectData && needsResume(projectData.status) && !isImportMode) {
          try {
            await actions.resumeSandboxAndWait(projectId, {
              timeout: 60000,
              pollingInterval: 2000,
            });
            if (cancelled) {
              return;
            }
            projectData = await actions.refreshProject();
            clientLogger.info('[BuildPage] Sandbox resumed successfully');
          } catch (error) {
            if (!cancelled) {
              const message =
                error instanceof Error ? error.message : String(error);
              clientLogger.error('[BuildPage] Resume failed:', error);
              setResumeError(message);
            }
          }
        } else if (isImportMode) {
          clientLogger.info('[BuildPage] Import mode - skipping sandbox resume (not needed for Railway deployment)');
        }

        if (cancelled) {
          return;
        }

        actions.setHasDevServer(Boolean(projectData?.devServerUrl));

        if (!projectData) {
          setStatus('error');
          setResumeError('Project not found.');
          return;
        }

        const cli = normalizeCli(projectData.cli);
        actions.setSelectedCli(cli);
        actions.setSelectedModel(resolveModelValue(cli, projectData.model));
        const effort = isEffortLevel(projectData.workspaceEffort)
          ? projectData.workspaceEffort
          : 'medium';
        actions.setSelectedEffort(effort);

        await actions.loadChatHistory();
        if (cancelled) {
          return;
        }

        await actions.hydrateSessions();
        if (cancelled) {
          return;
        }

        setStatus('ready');
      } catch (error) {
        if (cancelled) {
          return;
        }
        clientLogger.error('Failed to initialise build workspace:', error);
        setStatus('error');
        const message =
          error instanceof Error ? error.message : String(error);
        setResumeError(message);
      } finally {
        if (!cancelled) {
          setIsResuming(false);
        }
      }
    };

    void initialise();

    return () => {
      cancelled = true;
    };
  }, [projectId, actionsRef]);

  return {
    status,
    isReady: status === 'ready',
    isResuming,
    resumeError,
  };
}
