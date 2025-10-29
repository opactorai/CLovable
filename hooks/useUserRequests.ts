import { useState, useCallback, useEffect, useRef } from 'react';

interface UseUserRequestsOptions {
  projectId: string;
}

interface ActiveRequestsResponse {
  hasActiveRequests: boolean;
  activeCount: number;
}

export function useUserRequests({ projectId }: UseUserRequestsOptions) {
  const [hasActiveRequests, setHasActiveRequests] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const [isTabVisible, setIsTabVisible] = useState(true); // Default to true

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousActiveState = useRef(false);
  const activeRequestIdsRef = useRef<Set<string>>(new Set());

  const setFromActiveSet = useCallback(() => {
    const size = activeRequestIdsRef.current.size;
    setActiveCount(size);
    setHasActiveRequests(size > 0);
  }, []);

  const registerActiveRequest = useCallback((requestId: string | null | undefined) => {
    if (!requestId) return;
    const set = activeRequestIdsRef.current;
    const before = set.size;
    set.add(requestId);
    if (set.size !== before) {
      setFromActiveSet();
    }
  }, [setFromActiveSet]);

  const unregisterActiveRequest = useCallback((requestId: string | null | undefined) => {
    if (!requestId) return;
    const set = activeRequestIdsRef.current;
    if (set.delete(requestId)) {
      setFromActiveSet();
    }
  }, [setFromActiveSet]);

  // Track tab visibility state
  useEffect(() => {
    // Execute only on client side
    if (typeof document !== 'undefined') {
      setIsTabVisible(!document.hidden);
      
      const handleVisibilityChange = () => {
        setIsTabVisible(!document.hidden);
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, []);

  // Query active request status from DB
  const checkActiveRequests = useCallback(async (options?: { force?: boolean }) => {
    if (!options?.force && !isTabVisible) return; // Stop polling if tab is inactive unless forced

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '';
      const response = await fetch(`${apiBase}/api/chat/${projectId}/requests/active`, {
        cache: 'no-store',
      });
      if (response.status === 404) {
        if (previousActiveState.current) {
          console.log('🔄 [UserRequests] Active requests endpoint unavailable; assuming no active requests.');
        }
        if (activeRequestIdsRef.current.size > 0) {
          activeRequestIdsRef.current.clear();
        }
        setHasActiveRequests(false);
        setActiveCount(0);
        previousActiveState.current = false;
        return;
      }

      if (response.ok) {
        const data: ActiveRequestsResponse = await response.json();
        if (!data.hasActiveRequests && activeRequestIdsRef.current.size > 0) {
          activeRequestIdsRef.current.clear();
        }
        setHasActiveRequests(data.hasActiveRequests);
        setActiveCount(data.activeCount);

        // Log only when active state changes
        if (data.hasActiveRequests !== previousActiveState.current) {
          console.log(`🔄 [UserRequests] Active requests: ${data.hasActiveRequests} (count: ${data.activeCount})`);
          previousActiveState.current = data.hasActiveRequests;
        }
      } else {
        // Treat other statuses as no-op without logging noisy errors
        return;
      }
    } catch (error) {
      if (activeRequestIdsRef.current.size > 0) {
        activeRequestIdsRef.current.clear();
        setFromActiveSet();
      } else {
        setHasActiveRequests(false);
        setActiveCount(0);
      }
      previousActiveState.current = false;
      if (process.env.NODE_ENV === 'development') {
        console.warn('[UserRequests] Failed to check active requests (network issue):', error);
      }
    }
  }, [projectId, isTabVisible, setFromActiveSet]);

  // Adaptive polling configuration
  useEffect(() => {
    // Stop polling if tab is inactive
    if (!isTabVisible) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Determine polling interval based on active request status
    const pollInterval = hasActiveRequests ? 500 : 5000; // 0.5s vs 5s

    // Clean up existing polling
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Check immediately once
    checkActiveRequests();

    // Start new polling
    intervalRef.current = setInterval(() => checkActiveRequests(), pollInterval);

    if (process.env.NODE_ENV === 'development') {
      console.log(`⏱️ [UserRequests] Polling interval: ${pollInterval}ms (active: ${hasActiveRequests})`);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [hasActiveRequests, isTabVisible, checkActiveRequests]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      activeRequestIdsRef.current.clear();
    };
  }, []);

  // Placeholder functions for WebSocket events (maintaining existing interface)
  const createRequest = useCallback((
    requestId: string,
    messageId: string,
    instruction: string,
    type: 'act' | 'chat' = 'act'
  ) => {
    registerActiveRequest(requestId);
    // Check status immediately via polling
    checkActiveRequests({ force: true });
    console.log(`🔄 [UserRequests] Created request: ${requestId}`);
  }, [checkActiveRequests, registerActiveRequest]);

  const startRequest = useCallback((requestId: string) => {
    registerActiveRequest(requestId);
    // Check status immediately via polling
    checkActiveRequests({ force: true });
    console.log(`▶️ [UserRequests] Started request: ${requestId}`);
  }, [checkActiveRequests, registerActiveRequest]);

  const completeRequest = useCallback((
    requestId: string,
    isSuccessful: boolean,
    errorMessage?: string
  ) => {
    unregisterActiveRequest(requestId);
    // Check status immediately via polling with slight delay
    setTimeout(() => checkActiveRequests({ force: true }), 100);
    console.log(`✅ [UserRequests] Completed request: ${requestId} (${isSuccessful ? 'success' : 'failed'})`);
  }, [checkActiveRequests, unregisterActiveRequest]);

  return {
    hasActiveRequests,
    activeCount,
    createRequest,
    startRequest,
    completeRequest,
    // Legacy interface compatibility
    requests: [],
    activeRequests: [],
    getRequest: () => undefined,
    clearCompletedRequests: () => {}
  };
}
