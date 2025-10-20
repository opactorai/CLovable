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
  const checkActiveRequests = useCallback(async () => {
    if (!isTabVisible) return; // Stop polling if tab is inactive

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '';
      const response = await fetch(`${apiBase}/api/chat/${projectId}/requests/active`);
      if (response.status === 404) {
        if (previousActiveState.current) {
          console.log('🔄 [UserRequests] Active requests endpoint unavailable; assuming no active requests.');
        }
        setHasActiveRequests(false);
        setActiveCount(0);
        previousActiveState.current = false;
        return;
      }

      if (response.ok) {
        const data: ActiveRequestsResponse = await response.json();
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
      if (process.env.NODE_ENV === 'development') {
        console.error('[UserRequests] Failed to check active requests:', error);
      }
    }
  }, [projectId, isTabVisible]);

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
    intervalRef.current = setInterval(checkActiveRequests, pollInterval);

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
    };
  }, []);

  // Placeholder functions for WebSocket events (maintaining existing interface)
  const createRequest = useCallback((
    requestId: string,
    messageId: string,
    instruction: string,
    type: 'act' | 'chat' = 'act'
  ) => {
    // Check status immediately via polling
    checkActiveRequests();
    console.log(`🔄 [UserRequests] Created request: ${requestId}`);
  }, [checkActiveRequests]);

  const startRequest = useCallback((requestId: string) => {
    // Check status immediately via polling
    checkActiveRequests();
    console.log(`▶️ [UserRequests] Started request: ${requestId}`);
  }, [checkActiveRequests]);

  const completeRequest = useCallback((
    requestId: string,
    isSuccessful: boolean,
    errorMessage?: string
  ) => {
    // Check status immediately via polling with slight delay
    setTimeout(checkActiveRequests, 100);
    console.log(`✅ [UserRequests] Completed request: ${requestId} (${isSuccessful ? 'success' : 'failed'})`);
  }, [checkActiveRequests]);

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
