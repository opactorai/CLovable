'use client';

import { useAuth } from '@/app/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { resolveApiBaseUrl } from '@/lib/env';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const HEARTBEAT_INTERVAL_MS = 10_000;
const ACTIVITY_DEBOUNCE_MS = 500;
const API_BASE_URL = resolveApiBaseUrl();

interface HeartbeatOptions {
  ended?: boolean;
  autoStart?: boolean;
}

interface ProjectPresenceResponse {
  sandboxId?: string | null;
}

export interface ProjectActivityControls {
  notifyActivity: (
    source?: string,
    options?: { autoStart?: boolean },
  ) => void;
  lastPingAt: number | null;
  isHeartbeatActive: boolean;
  sandboxId: string | null;
}

const debounce = <T extends (...args: any[]) => void>(fn: T, delay: number) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, delay);
  };
};

const generateTabId = () => `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

export const useProjectActivity = (
  projectId: string | undefined | null,
  sandboxIdFromProps?: string | null,
): ProjectActivityControls => {
  const { user } = useAuth();
  const [lastPingAt, setLastPingAt] = useState<number | null>(null);
  const [isHeartbeatActive, setIsHeartbeatActive] = useState(false);
  const [sandboxId, setSandboxId] = useState<string | null>(sandboxIdFromProps ?? null);

  const sandboxIdRef = useRef<string | null>(sandboxIdFromProps ?? null);
  const tabIdRef = useRef<string>('');
  const lastActivityRef = useRef<number>(Date.now());
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatInFlightRef = useRef(false);
  const sendHeartbeatRef = useRef<(options?: HeartbeatOptions) => Promise<void> | void>();

  useEffect(() => {
    if (typeof window === 'undefined') {
      tabIdRef.current = generateTabId();
      return;
    }

    const storageKey = 'presence:tab-id';
    const existing = sessionStorage.getItem(storageKey);
    if (existing) {
      tabIdRef.current = existing;
    } else {
      const tabId = generateTabId();
      sessionStorage.setItem(storageKey, tabId);
      tabIdRef.current = tabId;
    }
  }, []);

  useEffect(() => {
    if (sandboxIdFromProps === undefined) {
      return;
    }
    sandboxIdRef.current = sandboxIdFromProps;
    setSandboxId(sandboxIdFromProps ?? null);
  }, [sandboxIdFromProps]);

  const sendHeartbeat = useCallback(
    async (options?: HeartbeatOptions) => {
      const sandboxIdValue = sandboxIdRef.current;
      if (!sandboxIdValue || !user) {
        return;
      }

      const shouldThrottle = options?.ended !== true;
      if (shouldThrottle && heartbeatInFlightRef.current) {
        return;
      }

      if (shouldThrottle) {
        heartbeatInFlightRef.current = true;
      }

      try {
        await apiClient.request('/api/presence/heartbeat', {
          method: 'POST',
          body: {
            sandboxId: sandboxIdValue,
            tabId: tabIdRef.current,
            ended: options?.ended ?? false,
            autoStart: options?.autoStart ?? true,
          },
        });

        if (!options?.ended) {
          const now = Date.now();
          setLastPingAt(now);
        }
      } catch (error) {
        console.error('Failed to send presence heartbeat:', error);
      } finally {
        if (shouldThrottle) {
          heartbeatInFlightRef.current = false;
        }
      }
    },
    [user],
  );

  useEffect(() => {
    sendHeartbeatRef.current = sendHeartbeat;
  }, [sendHeartbeat]);

  useEffect(() => {
    if (!projectId || !user) {
      sandboxIdRef.current = sandboxIdFromProps ?? null;
      setSandboxId(sandboxIdFromProps ?? null);
      return;
    }

    if (sandboxIdRef.current) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const data =
          await apiClient.request<ProjectPresenceResponse>(
            `/api/projects/${projectId}`,
          );
        if (cancelled) {
          return;
        }
        const fetchedSandboxId = data?.sandboxId ?? null;
        sandboxIdRef.current = fetchedSandboxId;
        setSandboxId(fetchedSandboxId);
        if (fetchedSandboxId) {
          sendHeartbeatRef.current?.({ autoStart: true });
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load project for presence tracking:', error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, user, sandboxIdFromProps]);

  useEffect(() => {
    if (!sandboxId) {
      return;
    }
    lastActivityRef.current = Date.now();
    sendHeartbeatRef.current?.({ autoStart: true });
  }, [sandboxId]);

  const detectActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const debouncedActivity = useMemo(
    () => debounce(detectActivity, ACTIVITY_DEBOUNCE_MS),
    [detectActivity],
  );

  useEffect(() => {
    if (!projectId || !user) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        detectActivity();
        sendHeartbeatRef.current?.({ autoStart: true });
      }
    };

    const handleBeforeUnload = () => {
      const sandboxIdValue = sandboxIdRef.current;
      if (!sandboxIdValue) {
        return;
      }
      try {
        const payload = JSON.stringify({
          sandboxId: sandboxIdValue,
          tabId: tabIdRef.current,
          ended: true,
        });
        navigator.sendBeacon(
          `${API_BASE_URL}/api/presence/heartbeat`,
          new Blob([payload], { type: 'application/json' }),
        );
      } catch (error) {
        // ignore beacon errors
      }
    };

    const handlePageHide = () => {
      const sandboxIdValue = sandboxIdRef.current;
      if (!sandboxIdValue) {
        return;
      }
      try {
        const payload = JSON.stringify({
          sandboxId: sandboxIdValue,
          tabId: tabIdRef.current,
          ended: true,
          autoStart: false,
        });
        navigator.sendBeacon(
          `${API_BASE_URL}/api/presence/heartbeat`,
          new Blob([payload], { type: 'application/json' }),
        );
      } catch (error) {
        // ignore beacon errors
      }
    };

    window.addEventListener('pointermove', debouncedActivity);
    window.addEventListener('keydown', debouncedActivity);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    const interval = setInterval(() => {
      const sandboxIdValue = sandboxIdRef.current;
      if (!sandboxIdValue) {
        return;
      }
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs <= HEARTBEAT_INTERVAL_MS) {
        sendHeartbeatRef.current?.({ autoStart: false });
      }
    }, HEARTBEAT_INTERVAL_MS);

    heartbeatTimerRef.current = interval;
    setIsHeartbeatActive(true);

    return () => {
      window.removeEventListener('pointermove', debouncedActivity);
      window.removeEventListener('keydown', debouncedActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      setIsHeartbeatActive(false);
    };
  }, [projectId, user, debouncedActivity, detectActivity]);

  const notifyActivity = useCallback(
    (source?: string, options?: { autoStart?: boolean }) => {
      detectActivity();
      void sendHeartbeat({ autoStart: options?.autoStart ?? true });
    },
    [detectActivity, sendHeartbeat],
  );

  return useMemo(
    () => ({
      notifyActivity,
      lastPingAt,
      isHeartbeatActive,
      sandboxId,
    }),
    [notifyActivity, lastPingAt, isHeartbeatActive, sandboxId],
  );
};
