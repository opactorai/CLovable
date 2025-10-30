/**
 * WebSocket Hook
 * Manages WebSocket connection for real-time updates
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { WEBSOCKET_CONFIG } from '@/lib/config/constants';
import type { ChatMessage, RealtimeEvent, RealtimeStatus } from '@/types';

interface WebSocketOptions {
  projectId: string;
  onMessage?: (message: ChatMessage) => void;
  onStatus?: (status: string, data?: RealtimeStatus | Record<string, unknown>, requestId?: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export function useWebSocket({
  projectId,
  onMessage,
  onStatus,
  onConnect,
  onDisconnect,
  onError
}: WebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const manualCloseRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const handlersRef = useRef({
    onMessage,
    onStatus,
    onConnect,
    onDisconnect,
    onError,
  });

  useEffect(() => {
    handlersRef.current = {
      onMessage,
      onStatus,
      onConnect,
      onDisconnect,
      onError,
    };
  }, [onMessage, onStatus, onConnect, onDisconnect, onError]);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    clearHeartbeat();
    heartbeatIntervalRef.current = setInterval(() => {
      const socket = wsRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }
      try {
        socket.send('ping');
      } catch (error) {
        console.error('Failed to send WebSocket ping:', error);
      }
    }, 25000);
  }, [clearHeartbeat]);

  const connect = useCallback(() => {
    const existing = wsRef.current;
    if (existing) {
      if (
        existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING
      ) {
        return;
      }

      try {
        existing.close(1000, 'Reconnecting');
      } catch {
        // Ignore close errors; we'll replace the socket below.
      }
      wsRef.current = null;
    }

    // Don't reconnect if we're intentionally disconnecting
    if (!shouldReconnectRef.current) {
      return;
    }

    const resolveWebSocketUrl = () => {
      const rawBase = process.env.NEXT_PUBLIC_WS_BASE?.trim() ?? '';
      const endpoint = `/api/ws/${projectId}`;
      if (rawBase.length > 0) {
        const normalizedBase = rawBase.replace(/\/+$/, '');
        return `${normalizedBase}${endpoint}`;
      }
      if (typeof window !== 'undefined') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}${endpoint}`;
      }
      throw new Error('WebSocket base URL is not available');
    };

    const resolveHttpWarmupUrl = () => {
      const rawBase = process.env.NEXT_PUBLIC_WS_BASE?.trim() ?? '';
      const endpoint = `/api/ws/${projectId}`;
      if (rawBase.length > 0) {
        // Convert ws/wss to http/https for the warm-up fetch
        const normalizedBase = rawBase
          .replace(/\/+$/, '')
          .replace(/^ws:\/\//i, 'http://')
          .replace(/^wss:\/\//i, 'https://');
        return `${normalizedBase}${endpoint}`;
      }
      if (typeof window !== 'undefined') {
        const httpProto = window.location.protocol === 'https:' ? 'https:' : 'http:';
        return `${httpProto}//${window.location.host}${endpoint}`;
      }
      throw new Error('HTTP base URL is not available');
    };

    const openWebSocket = () => {
      setIsConnecting(true);
      const ws = new WebSocket(resolveWebSocketUrl());
      manualCloseRef.current = false;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        connectionAttemptsRef.current = 0;
        startHeartbeat();
        handlersRef.current.onConnect?.();
      };

      ws.onmessage = (event) => {
        if (event.data === 'pong') {
          return;
        }

        try {
          const envelope = JSON.parse(event.data) as RealtimeEvent;
          const { onMessage: handleMessage, onStatus: handleStatus, onError: handleError } =
            handlersRef.current;

          switch (envelope.type) {
            case 'message':
              if (envelope.data && handleMessage) {
                handleMessage(envelope.data);
              }
              break;
            case 'status':
              if (envelope.data && handleStatus) {
                handleStatus(envelope.data.status, envelope.data, envelope.data.requestId);
              }
              break;
            case 'error': {
              const message = envelope.error ?? 'Realtime bridge error';
              const rawData = envelope.data as Record<string, unknown> | undefined;
              const requestId = (() => {
                if (!rawData) return undefined;
                const direct = rawData.requestId ?? rawData.request_id;
                return typeof direct === 'string' ? direct : undefined;
              })();
              const payload: RealtimeStatus = {
                status: 'error',
                message,
                ...(requestId ? { requestId } : {}),
              };
              handleStatus?.('error', payload, requestId);
              handleError?.(new Error(message));
              break;
            }
            case 'connected':
              if (handleStatus) {
                const payload: RealtimeStatus = {
                  status: 'connected',
                  message: 'Realtime channel connected',
                  sessionId: envelope.data.sessionId,
                };
                handleStatus('connected', payload, envelope.data.sessionId);
              }
              break;
            case 'preview_error':
            case 'preview_success':
              if (handleStatus) {
                const payload: RealtimeStatus = {
                  status: envelope.type,
                  message: envelope.data?.message,
                  metadata: envelope.data?.severity
                    ? { severity: envelope.data.severity }
                    : undefined,
                };
                handleStatus(envelope.type, payload);
              }
              break;
            case 'heartbeat':
              break;
            default: {
              const fallback = envelope as unknown as { type: string };
              handleStatus?.(fallback.type, envelope as unknown as Record<string, unknown>);
              break;
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        if (manualCloseRef.current) {
          setIsConnecting(false);
          return;
        }
        console.error('❌ WebSocket error:', error);
        console.error('❌ WebSocket readyState:', ws.readyState);
        console.error('❌ WebSocket URL:', ws.url);
        clearHeartbeat();
        setIsConnecting(false);
        handlersRef.current.onError?.(new Error(`WebSocket connection error to ${ws.url}`));
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        clearHeartbeat();
        handlersRef.current.onDisconnect?.();
        
        // Only reconnect if we should
        if (shouldReconnectRef.current) {
          const attempts = connectionAttemptsRef.current + 1;
          connectionAttemptsRef.current = attempts;

          // After max attempts, continue with longer delays
          let delay: number;
          if (attempts > WEBSOCKET_CONFIG.MAX_RECONNECT_ATTEMPTS) {
            // After max attempts, keep trying every 30-60 seconds
            const longDelay = 30000 + Math.random() * 30000; // 30-60s
            delay = longDelay;
            console.warn(`[WebSocket] Max reconnection attempts reached, retrying every 30-60s (attempt ${attempts})`);
            const error = new Error('Max reconnection attempts reached, continuing with longer delays');
            handlersRef.current.onError?.(error);
          } else {
            // Exponential backoff with jitter for initial attempts
            const exponentialDelay = Math.min(
              WEBSOCKET_CONFIG.BASE_RECONNECT_DELAY * Math.pow(2, attempts - 1),
              WEBSOCKET_CONFIG.MAX_RECONNECT_DELAY
            );
            const jitter = Math.random() * 1000; // Add 0-1s jitter
            delay = exponentialDelay + jitter;
            console.log(`[WebSocket] Reconnecting in ${Math.round(delay)}ms (attempt ${attempts}/${WEBSOCKET_CONFIG.MAX_RECONNECT_ATTEMPTS})`);
          }

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      wsRef.current = ws;
    };

    // Warm up the API route to ensure server-side WS upgrade handler is attached
    (async () => {
      try {
        const warmupUrl = resolveHttpWarmupUrl();
        await fetch(warmupUrl, { method: 'GET', headers: { 'x-ws-warmup': '1' } });
        // Wait a bit for the upgrade handler to be fully attached
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch {
        // Warm-up is best-effort; proceed regardless
      } finally {
        try {
          openWebSocket();
        } catch (error) {
          setIsConnecting(false);
          console.error('Failed to create WebSocket connection:', error);
          handlersRef.current.onError?.(error as Error);
        }
      }
    })();
  }, [projectId, startHeartbeat, clearHeartbeat]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    manualCloseRef.current = true;
    clearHeartbeat();
    setIsConnecting(false);
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      const socket = wsRef.current;
      wsRef.current = null;

      if (socket.readyState === WebSocket.CONNECTING) {
        socket.addEventListener('open', () => {
          socket.close(1000, 'Client disconnect');
        });
      } else {
        socket.close(1000, 'Client disconnect');
      }
    }
    
    setIsConnected(false);
  }, [clearHeartbeat]);

  const sendMessage = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  const manualReconnect = useCallback(() => {
    console.log('[WebSocket] Manual reconnect triggered');
    shouldReconnectRef.current = true;
    connectionAttemptsRef.current = 0; // Reset attempt counter
    disconnect();
    setTimeout(() => connect(), 100);
  }, [disconnect, connect]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    manualCloseRef.current = false;
    connectionAttemptsRef.current = 0;
    connect();
    
    return () => {
      disconnect();
    };
  }, [projectId, disconnect, connect]);

  return {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    sendMessage,
    manualReconnect
  };
}
