/**
 * WebSocket Hook
 * Manages WebSocket connection for real-time updates
 */
import { useEffect, useRef, useCallback, useState } from 'react';
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
  const connectionAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const manualCloseRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
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
      const ws = new WebSocket(resolveWebSocketUrl());
      manualCloseRef.current = false;

      ws.onopen = () => {
        setIsConnected(true);
        connectionAttemptsRef.current = 0;
        onConnect?.();
      };

      ws.onmessage = (event) => {
        if (event.data === 'pong') {
          return;
        }

        try {
          const envelope = JSON.parse(event.data) as RealtimeEvent;

          switch (envelope.type) {
            case 'message':
              if (envelope.data && onMessage) {
                onMessage(envelope.data);
              }
              break;
            case 'status':
              if (envelope.data && onStatus) {
                onStatus(envelope.data.status, envelope.data, envelope.data.requestId);
              }
              break;
            case 'error': {
              const message = envelope.error ?? 'Realtime bridge error';
              const payload: RealtimeStatus = {
                status: 'error',
                message,
              };
              onStatus?.('error', payload);
              onError?.(new Error(message));
              break;
            }
            case 'connected':
              if (onStatus) {
                const payload: RealtimeStatus = {
                  status: 'connected',
                  message: 'Realtime channel connected',
                  sessionId: envelope.data.sessionId,
                };
                onStatus('connected', payload, envelope.data.sessionId);
              }
              break;
            case 'preview_error':
            case 'preview_success':
              if (onStatus) {
                const payload: RealtimeStatus = {
                  status: envelope.type,
                  message: envelope.data?.message,
                  metadata: envelope.data?.severity
                    ? { severity: envelope.data.severity }
                    : undefined,
                };
                onStatus(envelope.type, payload);
              }
              break;
            case 'heartbeat':
              break;
            default: {
              const fallback = envelope as unknown as { type: string };
              onStatus?.(fallback.type, envelope as unknown as Record<string, unknown>);
              break;
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        if (manualCloseRef.current) {
          return;
        }
        console.error('❌ WebSocket error:', error);
        console.error('❌ WebSocket readyState:', ws.readyState);
        console.error('❌ WebSocket URL:', ws.url);
        onError?.(new Error(`WebSocket connection error to ${ws.url}`));
      };

      ws.onclose = () => {
        setIsConnected(false);
        onDisconnect?.();
        
        // Only reconnect if we should and haven't exceeded attempts
        if (shouldReconnectRef.current) {
          const attempts = connectionAttemptsRef.current + 1;
          connectionAttemptsRef.current = attempts;
          
          if (attempts < 5) {
            const delay = Math.min(1000 * Math.pow(2, attempts), 10000);
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          }
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
          console.error('Failed to create WebSocket connection:', error);
          onError?.(error as Error);
        }
      }
    })();
  }, [projectId, onMessage, onStatus, onConnect, onDisconnect, onError]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    manualCloseRef.current = true;
    
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
  }, []);

  const sendMessage = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  useEffect(() => {
    shouldReconnectRef.current = true;
    manualCloseRef.current = false;
    connectionAttemptsRef.current = 0;
    connect();
    
    return () => {
      disconnect();
    };
  }, [projectId]);

  return {
    isConnected,
    connect,
    disconnect,
    sendMessage
  };
}
