/**
 * useProjectStream — subscribe to a project's realtime Claude Code output.
 *
 * WebSocket is primary; on failure it falls back to the SSE endpoint. Both
 * deliver identical event envelopes. Consumers receive a flat list of events
 * plus the latest connection state.
 */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAccessToken } from './supabase-client';

export interface StreamEvent {
  type: string;
  projectId: string;
  requestId?: string;
  seq?: number;
  ts: string;
  data: unknown;
}

type ConnState = 'connecting' | 'open' | 'closed';

const WS_BASE = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? '';
const HTTP_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

export function useProjectStream(projectId: string | null) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [state, setState] = useState<ConnState>('closed');
  const wsRef = useRef<WebSocket | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const push = useCallback((evt: StreamEvent) => {
    setEvents((prev) => [...prev, evt]);
  }, []);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    const connectSSE = async () => {
      const token = await getAccessToken();
      if (cancelled || !token) return;
      const url = `${HTTP_BASE}/api/projects/${projectId}/stream?access_token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      esRef.current = es;
      es.onopen = () => setState('open');
      es.onmessage = (e) => {
        try {
          push(JSON.parse(e.data));
        } catch {
          /* ignore malformed */
        }
      };
      es.onerror = () => setState('closed');
    };

    const connectWS = async () => {
      const token = await getAccessToken();
      if (cancelled || !token) return;
      setState('connecting');
      const url = `${WS_BASE}/api/ws/${projectId}?access_token=${encodeURIComponent(token)}`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        void connectSSE();
        return;
      }
      wsRef.current = ws;
      ws.onopen = () => setState('open');
      ws.onmessage = (e) => {
        try {
          push(JSON.parse(e.data));
        } catch {
          /* ignore malformed */
        }
      };
      ws.onerror = () => {
        // Fall back to SSE if the socket never opened.
        if (ws.readyState !== WebSocket.OPEN) void connectSSE();
      };
      ws.onclose = () => setState('closed');
    };

    void connectWS();

    return () => {
      cancelled = true;
      wsRef.current?.close();
      esRef.current?.close();
      wsRef.current = null;
      esRef.current = null;
    };
  }, [projectId, push]);

  const clear = useCallback(() => setEvents([]), []);

  return { events, state, clear };
}
