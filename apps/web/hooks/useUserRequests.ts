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
  const [isTabVisible, setIsTabVisible] = useState(true); // 기본값 true로 설정
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousActiveState = useRef(false);

  // 탭 활성화 상태 추적
  useEffect(() => {
    // 클라이언트 사이드에서만 실행
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

  // DB에서 활성 요청 상태 조회
  const checkActiveRequests = useCallback(async () => {
    if (!isTabVisible) return; // 탭이 비활성화되어 있으면 폴링 중지

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';
      const response = await fetch(`${apiBase}/api/chat/${projectId}/requests/active`);
      if (response.ok) {
        const data: ActiveRequestsResponse = await response.json();
        setHasActiveRequests(data.hasActiveRequests);
        setActiveCount(data.activeCount);
        
        // 활성 상태가 변경되었을 때만 로그 출력
        if (data.hasActiveRequests !== previousActiveState.current) {
          console.log(`🔄 [UserRequests] Active requests: ${data.hasActiveRequests} (count: ${data.activeCount})`);
          previousActiveState.current = data.hasActiveRequests;
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[UserRequests] Failed to check active requests:', error);
      }
    }
  }, [projectId, isTabVisible]);

  // 적응형 폴링 설정
  useEffect(() => {
    // 탭이 비활성화되어 있으면 폴링 중지
    if (!isTabVisible) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // 활성 요청 상태에 따른 폴링 간격 결정
    const pollInterval = hasActiveRequests ? 500 : 5000; // 0.5초 vs 5초
    
    // 기존 폴링 정리
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // 즉시 한 번 확인
    checkActiveRequests();

    // 새로운 폴링 시작
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

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // WebSocket 이벤트용 플레이스홀더 함수들 (기존 인터페이스 유지)
  const createRequest = useCallback((
    requestId: string,
    messageId: string,
    instruction: string,
    type: 'act' | 'chat' = 'act'
  ) => {
    // 즉시 폴링으로 상태 확인
    checkActiveRequests();
    console.log(`🔄 [UserRequests] Created request: ${requestId}`);
  }, [checkActiveRequests]);

  const startRequest = useCallback((requestId: string) => {
    // 즉시 폴링으로 상태 확인
    checkActiveRequests();
    console.log(`▶️ [UserRequests] Started request: ${requestId}`);
  }, [checkActiveRequests]);

  const completeRequest = useCallback((
    requestId: string, 
    isSuccessful: boolean,
    errorMessage?: string
  ) => {
    // 즉시 폴링으로 상태 확인
    setTimeout(checkActiveRequests, 100); // 약간 지연 후 확인
    console.log(`✅ [UserRequests] Completed request: ${requestId} (${isSuccessful ? 'success' : 'failed'})`);
  }, [checkActiveRequests]);

  return {
    hasActiveRequests,
    activeCount,
    createRequest,
    startRequest,
    completeRequest,
    // 레거시 인터페이스 호환성
    requests: [],
    activeRequests: [],
    getRequest: () => undefined,
    clearCompletedRequests: () => {}
  };
}