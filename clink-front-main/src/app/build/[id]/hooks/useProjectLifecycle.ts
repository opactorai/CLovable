'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { FreestyleMessagePayload, ProjectStatusUpdatePayload } from '@/lib/chat';
import { perfEnd, perfMeasure, perfStart } from '@/lib/perf-logger';
import { clientLogger } from '@/lib/client-logger';

export type ProjectStatus =
  | 'creating'
  | 'active'
  | 'failed'
  | 'stopped'
  | 'archived'
  | 'starting';

export type RailwayDeploymentStatus = 'PENDING' | 'BUILDING' | 'SUCCESS' | 'FAILED' | null;

type LifecycleNotice = {
  message: string;
  level: 'info' | 'warning' | 'error';
};

type DevServerHealthState =
  | 'ready'
  | 'inactive'
  | 'unavailable'
  | 'unhealthy'
  | 'unreachable';

type DevServerHealthResponse = {
  state: DevServerHealthState;
  projectStatus: ProjectStatus;
  devServerUrl?: string | null;
  previewUrl?: string | null;
  sandboxId?: string | null;
  latencyMs?: number;
  httpStatus?: number;
  message?: string;
  checkedAt: string;
};

interface UseProjectLifecycleReturn {
  projectName: string;
  projectStatus: ProjectStatus;
  previewUrl: string | null;
  previewNonce: number;
  isPreviewRunning: boolean;
  isPreviewLoading: boolean;
  previewReady: boolean;
  lifecycleNotice: LifecycleNotice | null;
  refreshProject: () => Promise<any | null>;
  waitForPreviewReady: () => Promise<void>;
  startPreview: () => Promise<void>;
  stopPreview: () => Promise<void>;
  publishProject: (subdomainName: string, customDomainId?: string) => Promise<any>;
  fetchDeploymentStatus: () => Promise<any>;
  triggerPreview: () => void;
  forcePreviewRefresh: () => void;
  handleProjectStatusUpdate: (payload: ProjectStatusUpdatePayload) => void;
  handleFreestyleMessage: (payload: FreestyleMessagePayload) => void;
  resetLifecycle: () => void;
  setProjectStatus: (status: ProjectStatus) => void;
  setPreviewUrl: (url: string | null) => void;
  setIsPreviewRunning: (running: boolean) => void;
  project: any | null;
  railwayDeploymentStatus: RailwayDeploymentStatus;
  railwayMessage: string;
  railwayUrl: string | null;
  railwayErrorLogs: string | null;
  checkRailwayDeploymentStatus: () => Promise<void>;
}

export const useProjectLifecycle = (projectId: string | undefined | null): UseProjectLifecycleReturn => {
  const safeProjectId = useMemo(() => projectId ?? '', [projectId]);

  const [projectName, setProjectName] = useState('•••');
  const [projectStatus, setProjectStatusState] = useState<ProjectStatus>('creating');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewNonce, setPreviewNonce] = useState<number>(0);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPreviewRunning, setIsPreviewRunning] = useState(false);
  const [lifecycleNotice, setLifecycleNotice] = useState<LifecycleNotice | null>(null);
  const [devServerHealthState, setDevServerHealthState] =
    useState<DevServerHealthState>('unavailable');
  const [projectData, setProjectData] = useState<any | null>(null);

  // Railway deployment state
  const [railwayDeploymentStatus, setRailwayDeploymentStatus] = useState<RailwayDeploymentStatus>(null);
  const [railwayMessage, setRailwayMessage] = useState<string>('');
  const [railwayUrl, setRailwayUrl] = useState<string | null>(null);
  const [railwayErrorLogs, setRailwayErrorLogs] = useState<string | null>(null);
  const [isPollingRailway, setIsPollingRailway] = useState(false);

  const previewReadyRef = useRef(false);
  const previewTriggeredRef = useRef(false);
  const previewWaitPromiseRef = useRef<Promise<void> | null>(null);
  const projectStatusRef = useRef<ProjectStatus>('creating');
  const isPreviewRunningRef = useRef(false);
  const lastPreviewUrlRef = useRef<string | null>(null);
  const devServerHealthStateRef = useRef<DevServerHealthState>('unavailable');

  const previewReady =
    projectStatus === 'active' &&
    Boolean(previewUrl) &&
    devServerHealthState === 'ready';

  useEffect(() => {
    previewReadyRef.current = previewReady;
  }, [previewReady]);

  useEffect(() => {
    isPreviewRunningRef.current = isPreviewRunning;
  }, [isPreviewRunning]);

  const updateLifecycleBanner = useCallback(
    (
      status: ProjectStatus,
      lifecycle?: ProjectStatusUpdatePayload['lifecycle'],
    ) => {
      if (status === 'active' || status === 'creating') {
        setLifecycleNotice(null);
        return;
      }

      if (status === 'starting') {
        setLifecycleNotice({
          level: 'info',
          message: 'Starting sandbox...',
        });
        return;
      }

      if (status === 'stopped') {
        const idleSeconds = lifecycle?.idleSeconds;
        let detail = 'due to inactivity';
        if (typeof idleSeconds === 'number' && idleSeconds > 0) {
          if (idleSeconds >= 60) {
            const minutes = Math.max(1, Math.round(idleSeconds / 60));
            detail = `after ${minutes} minute${minutes === 1 ? '' : 's'} of inactivity`;
          } else {
            detail = `after ${idleSeconds} seconds of inactivity`;
          }
        }
        setLifecycleNotice({
          level: 'info',
          message: `Sandbox paused ${detail}. Click Run to resume.`,
        });
        return;
      }

      if (status === 'archived') {
        setLifecycleNotice({
          level: 'warning',
          message:
            'Sandbox archived after extended inactivity. Click Run to restore the environment.',
        });
        return;
      }

      if (status === 'failed') {
        setLifecycleNotice({
          level: 'error',
          message: 'Sandbox provisioning failed. Restart the project to try again.',
        });
        return;
      }
    },
    [],
  );

  const updateProjectStatus = useCallback(
    (
      status: ProjectStatus,
      lifecycle?: ProjectStatusUpdatePayload['lifecycle'],
    ) => {
      setProjectStatusState(status);
      projectStatusRef.current = status;
      updateLifecycleBanner(status, lifecycle);
    },
    [updateLifecycleBanner],
  );

  const applyProjectData = useCallback(
    (data: any) => {
      if (!data) {
        return data;
      }

      setProjectName(data.name ?? '•••');
      const previousStatus = projectStatusRef.current;

      const preview = data.previewUrl || null;
      const rawStatus = data.status as ProjectStatus | undefined;
      const knownStatuses: ProjectStatus[] = ['active', 'failed', 'stopped', 'archived', 'starting', 'creating'];
      const status: ProjectStatus = rawStatus && knownStatuses.includes(rawStatus)
        ? rawStatus
        : preview
          ? 'active'
          : 'creating';

      // Persist last known preview URL per project to survive navigation
      const storageKey = `project:${safeProjectId}:lastPreviewUrl`;

      if (status === 'active') {
        setPreviewUrl(preview);
        const shouldShowPreview =
          Boolean(preview) && devServerHealthStateRef.current === 'ready';
        const shouldShowLoading = !shouldShowPreview;

        setIsPreviewRunning(shouldShowPreview);
        setIsPreviewLoading(shouldShowLoading);

        // bump nonce if becoming active or URL changed
        if (
          shouldShowPreview &&
          (previousStatus !== 'active' ||
            lastPreviewUrlRef.current !== preview)
        ) {
          setPreviewNonce(Date.now());
        }
        lastPreviewUrlRef.current = preview;
        if (preview) {
          try {
            sessionStorage.setItem(storageKey, preview);
          } catch {}
        }
      } else {
        devServerHealthStateRef.current = 'inactive';
        setDevServerHealthState('inactive');
        // Keep last preview visible as cached view if available
        let cached = preview;
        if (!cached) {
          try {
            cached = sessionStorage.getItem(storageKey) || null;
          } catch {
            cached = null;
          }
        }

        if (cached) {
          setPreviewUrl(cached);
        } else {
          setPreviewUrl(null);
        }
        setIsPreviewRunning(false);
        setIsPreviewLoading(false);
      }

      updateProjectStatus(status);
      setProjectData(data);

      // Sync Railway deployment state from project data
      if (data.projectType === 'dev') {
        if (data.productionUrl) {
          setRailwayUrl(data.productionUrl);
          if (data.railwayProjectId && data.railwayServiceId) {
            // Only set SUCCESS if we haven't already set a status
            if (!railwayDeploymentStatus) {
              setRailwayDeploymentStatus('SUCCESS');
            }
          }
        }
      }

      return data;
    },
    [updateProjectStatus, railwayDeploymentStatus],
  );

  const fetchProject = useCallback(async () => {
    if (!safeProjectId) {
      return null;
    }
    return perfMeasure(
      `api.projects.fetch#${safeProjectId}`,
      () => apiClient.request(`/api/projects/${safeProjectId}`),
      { projectId: safeProjectId },
    );
  }, [safeProjectId]);

  const refreshProject = useCallback(
    async () => {
      try {
        const data = await fetchProject();
        applyProjectData(data);
        return data;
      } catch (error) {
        console.error('Failed to refresh project:', error);
        return null;
      }
    },
    [applyProjectData, fetchProject],
  );

  const checkDevServerHealth = useCallback(async (): Promise<DevServerHealthResponse> => {
    const fallbackState: DevServerHealthResponse = {
      state: 'unavailable',
      projectStatus: projectStatusRef.current,
      checkedAt: new Date().toISOString(),
    };

    if (!safeProjectId) {
      setDevServerHealthState('unavailable');
      devServerHealthStateRef.current = 'unavailable';
      return fallbackState;
    }

    try {
      const response = await apiClient.request<DevServerHealthResponse>(
        `/api/projects/${safeProjectId}/dev-server/health`,
      );

      // Handle undefined response (204 No Content)
      if (!response || !response.state) {
        clientLogger.debug('[useProjectLifecycle] Health check returned empty response (204)');
        setDevServerHealthState('unavailable');
        devServerHealthStateRef.current = 'unavailable';
        return fallbackState;
      }

      setDevServerHealthState(response.state);
      devServerHealthStateRef.current = response.state;
      return response;
    } catch (error) {
      console.error('Failed to check dev server health:', error);
      setDevServerHealthState('unreachable');
      devServerHealthStateRef.current = 'unreachable';
      return {
        state: 'unreachable',
        projectStatus: projectStatusRef.current,
        message: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
      };
    }
  }, [safeProjectId]);

  const waitForPreviewReady = useCallback(async () => {
    clientLogger.debug('[waitForPreviewReady] Starting...', {
      projectStatus: projectStatusRef.current,
      previewReady: previewReadyRef.current,
      devServerHealthState: devServerHealthStateRef.current,
    });

    if (projectStatusRef.current === 'failed') {
      throw new Error('Project provisioning failed. Please restart the project.');
    }
    if (previewReadyRef.current) {
      clientLogger.debug('[waitForPreviewReady] Already ready (cached)');
      const timerName = `preview.wait#${safeProjectId}`;
      perfStart(timerName);
      perfEnd(timerName, { status: 'ready-cache' });
      return;
    }

    if (!previewWaitPromiseRef.current) {
      const timerName = `preview.wait#${safeProjectId}`;
      perfStart(timerName);
      previewWaitPromiseRef.current = (async () => {
        await refreshProject();
        if (previewReadyRef.current) {
          return;
        }

        const maxAttempts = 60;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          const statusBeforeSleep = projectStatusRef.current;
          if (statusBeforeSleep === 'failed') {
            throw new Error('Project provisioning failed. Please restart the project.');
          }

          if (statusBeforeSleep === 'active') {
            const health = await checkDevServerHealth();
            clientLogger.debug('[waitForPreviewReady] Health check result:', health);
            if (health.state === 'ready') {
              clientLogger.debug('[waitForPreviewReady] Preview is ready! ✅');
              previewReadyRef.current = true;
              return;
            } else {
              clientLogger.debug(`[waitForPreviewReady] Not ready yet (state=${health.state}), attempt ${attempt + 1}/${maxAttempts}`);
            }
          } else {
            clientLogger.debug(`[waitForPreviewReady] Project not active (status=${statusBeforeSleep}), attempt ${attempt + 1}/${maxAttempts}`);
          }

          await new Promise<void>((resolve) => setTimeout(resolve, 1000));

          const statusAfterSleep = projectStatusRef.current;
          if (statusAfterSleep === 'failed') {
            throw new Error('Project provisioning failed. Please restart the project.');
          }

          if ((attempt + 1) % 5 === 0) {
            await refreshProject();
          }
        }

        throw new Error(
          'Dev server is still provisioning. Please wait a little longer and try again.',
        );
      })()
        .then(() => {
          perfEnd(timerName, { status: 'ready' });
        })
        .catch((error) => {
          perfEnd(timerName, { status: 'error', error: error instanceof Error ? error.message : String(error) });
          throw error;
        })
        .finally(() => {
          previewWaitPromiseRef.current = null;
        });
    }

    return previewWaitPromiseRef.current;
  }, [refreshProject, checkDevServerHealth]);

  const startPreview = useCallback(async () => {
    if (!safeProjectId) {
      return;
    }
    setIsPreviewLoading(true);
    try {
      const status = projectStatusRef.current;

      if (status === 'starting') {
        await waitForPreviewReady();
        await refreshProject();
        return;
      }

      if (status === 'stopped' || status === 'archived') {
        // Keep last previewUrl rendered to show cached view with overlay.
        setIsPreviewRunning(false);
        await apiClient.request(`/api/projects/${safeProjectId}/sandbox/start`, {
          method: 'POST',
        });
        updateProjectStatus('starting');
        await waitForPreviewReady();
        await refreshProject();
        return;
      }

      const data = await perfMeasure(
        `api.preview.start#${safeProjectId}`,
        () =>
          apiClient.request<{ url?: string }>(
            `/api/projects/${safeProjectId}/preview/start`,
            {
              method: 'POST',
            },
          ),
        { projectId: safeProjectId },
      );

      const nextPreviewUrl = data?.url || 'http://localhost:3001';
      setPreviewUrl(nextPreviewUrl);
      setIsPreviewRunning(true);
    } catch (error) {
      console.error('Failed to start preview:', error);
    } finally {
      if (projectStatusRef.current !== 'starting') {
        setIsPreviewLoading(false);
      }
    }
  }, [refreshProject, safeProjectId, updateProjectStatus, waitForPreviewReady]);

  const stopPreview = useCallback(async () => {
    if (!safeProjectId) {
      return;
    }
    try {
      await perfMeasure(
        `api.preview.stop#${safeProjectId}`,
        () =>
          apiClient.request(`/api/projects/${safeProjectId}/preview/stop`, {
            method: 'POST',
          }),
        { projectId: safeProjectId },
      );
      // Keep last preview visible with paused overlay
      setIsPreviewRunning(false);
      previewTriggeredRef.current = false;
    } catch (error) {
      console.error('Failed to stop preview:', error);
    }
  }, [safeProjectId]);

  const publishProject = useCallback(async (subdomainName: string, customDomainId?: string) => {
    if (!safeProjectId) {
      return null;
    }

    const body: { subdomainName: string; customDomainId?: string } = {
      subdomainName,
    };

    // Only include customDomainId if provided
    if (customDomainId) {
      body.customDomainId = customDomainId;
    }

    return perfMeasure(
      `api.projects.deploy#${safeProjectId}`,
      () =>
        apiClient.request(`/api/projects/${safeProjectId}/deploy`, {
          method: 'POST',
          body,
        }),
      { projectId: safeProjectId },
    );
  }, [safeProjectId]);

  const fetchDeploymentStatus = useCallback(async () => {
    if (!safeProjectId) {
      return null;
    }

    return perfMeasure(
      `api.projects.deploymentStatus#${safeProjectId}`,
      () => apiClient.request(`/api/projects/${safeProjectId}/deployment-status`),
      { projectId: safeProjectId },
    );
  }, [safeProjectId]);

  const checkRailwayDeploymentStatus = useCallback(async () => {
    if (!safeProjectId) {
      return;
    }

    try {
      const statusRes = await apiClient.getRailwayDeploymentStatus(safeProjectId);
      setRailwayMessage(statusRes.message || '');

      if (statusRes.status === 'SUCCESS') {
        setRailwayDeploymentStatus('SUCCESS');
        setRailwayUrl(statusRes.url || null);
        setRailwayErrorLogs(null);
        setIsPollingRailway(false);

        // Refresh parent project data to update productionUrl
        await refreshProject();
      } else if (statusRes.status === 'FAILED' || statusRes.status === 'CRASHED') {
        setRailwayDeploymentStatus('FAILED');
        setRailwayErrorLogs(statusRes.logs || 'No logs available');
        setIsPollingRailway(false);
      } else if (statusRes.status === 'BUILDING') {
        setRailwayDeploymentStatus('BUILDING');
        setIsPollingRailway(true);
      }
    } catch (error) {
      console.error('Failed to check Railway deployment status:', error);
      // Don't update status on error to avoid disrupting UI
    }
  }, [safeProjectId, refreshProject]);

  const triggerPreview = useCallback(() => {
    if (previewTriggeredRef.current || isPreviewRunningRef.current) {
      return;
    }
    previewTriggeredRef.current = true;
    void startPreview();
  }, [startPreview]);

  const forcePreviewRefresh = useCallback(() => {
    setPreviewNonce(Date.now());
  }, []);

  const handleProjectStatusUpdate = useCallback(
    (payload: ProjectStatusUpdatePayload) => {
      clientLogger.info('[useProjectLifecycle] projectStatusUpdate', {
        projectId: safeProjectId,
        status: payload.status,
        previewUrl: payload.previewUrl ?? payload.urls?.preview ?? null,
      });
      updateProjectStatus(payload.status, payload.lifecycle);

      if (payload.status === 'active') {
        // Use direct previewUrl field first, fallback to urls.preview for backwards compatibility
        const previewUrlToUse = payload.previewUrl || payload.urls?.preview || null;
        if (previewUrlToUse) {
          setPreviewUrl(previewUrlToUse);
          devServerHealthStateRef.current = 'unavailable';
          setDevServerHealthState('unavailable');
          setIsPreviewRunning(false);
          setIsPreviewLoading(true); // Show loading while we verify dev server health
          try {
            sessionStorage.setItem(`project:${safeProjectId}:lastPreviewUrl`, previewUrlToUse);
          } catch {}
          lastPreviewUrlRef.current = previewUrlToUse;

          // Verify dev server is responding before showing iframe
          (async () => {
            const maxHealthCheckAttempts = 10;
            let lastHealth: DevServerHealthResponse | null = null;
            for (let i = 0; i < maxHealthCheckAttempts; i++) {
              lastHealth = await checkDevServerHealth();
              if (lastHealth.state === 'ready') {
                setIsPreviewRunning(true);
                setIsPreviewLoading(false);
                setPreviewNonce(Date.now()); // Force iframe reload
                return;
              }
              // Wait 1 second before next health check
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            clientLogger.warn(
              '[useProjectLifecycle] Dev server health check did not succeed after attempts',
              lastHealth,
            );
            setIsPreviewRunning(false);
            setIsPreviewLoading(true);
          })();
        } else {
          // No preview URL yet; keep last known view if any, show loading state
          devServerHealthStateRef.current = 'unavailable';
          setDevServerHealthState('unavailable');
          setIsPreviewRunning(false);
          setIsPreviewLoading(true);
        }
        void refreshProject();
        return;
      }

      if (payload.status === 'starting') {
        // Keep last preview visible; show loading overlay until active
        devServerHealthStateRef.current = 'inactive';
        setDevServerHealthState('inactive');
        setIsPreviewRunning(false);
        setIsPreviewLoading(true);
        return;
      }

      // stopped/archived/failed: keep last preview visible and show paused overlay
      devServerHealthStateRef.current = 'inactive';
      setDevServerHealthState('inactive');
      setIsPreviewRunning(false);
      setIsPreviewLoading(false);
    },
    [refreshProject, updateProjectStatus, safeProjectId, checkDevServerHealth],
  );

  const handleFreestyleMessage = useCallback(
    (payload: FreestyleMessagePayload) => {
      if (payload?.type === 'lifecycle') {
        setLifecycleNotice({
          level: (payload.level as 'info' | 'warning' | 'error') ?? 'info',
          message: payload.message,
        });

        return;
      }
    },
    [],
  );

  const resetLifecycle = useCallback(() => {
    setProjectName('Untitled Project');
    updateProjectStatus('creating');
    setPreviewUrl(null);
    setIsPreviewRunning(false);
    setIsPreviewLoading(false);
    setLifecycleNotice(null);
    devServerHealthStateRef.current = 'unavailable';
    setDevServerHealthState('unavailable');
    previewReadyRef.current = false;
    previewTriggeredRef.current = false;
    previewWaitPromiseRef.current = null;
    setProjectData(null);
    // Reset Railway state
    setRailwayDeploymentStatus(null);
    setRailwayMessage('');
    setRailwayUrl(null);
    setRailwayErrorLogs(null);
    setIsPollingRailway(false);
  }, [updateProjectStatus]);

  // Railway polling effect
  useEffect(() => {
    if (!isPollingRailway || !safeProjectId) {
      return;
    }

    const pollInterval = setInterval(async () => {
      await checkRailwayDeploymentStatus();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [isPollingRailway, safeProjectId, checkRailwayDeploymentStatus]);

  return {
    projectName,
    projectStatus,
    previewUrl,
    previewNonce,
    isPreviewRunning,
    isPreviewLoading,
    previewReady,
    lifecycleNotice,
    refreshProject,
    waitForPreviewReady,
    startPreview,
    stopPreview,
    publishProject,
    fetchDeploymentStatus,
    triggerPreview,
    forcePreviewRefresh,
    handleProjectStatusUpdate,
    handleFreestyleMessage,
    resetLifecycle,
    setProjectStatus: updateProjectStatus,
    setPreviewUrl,
    setIsPreviewRunning,
    project: projectData,
    railwayDeploymentStatus,
    railwayMessage,
    railwayUrl,
    railwayErrorLogs,
    checkRailwayDeploymentStatus,
  };
};
