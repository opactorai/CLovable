/**
 * WebSocket server attached to the shared HTTP server.
 *
 * Path: /api/ws/:projectId?access_token=<jwt>
 * - Authenticates the Supabase JWT on upgrade.
 * - Verifies the user owns the project.
 * - Subscribes the socket to that project's event bus.
 * - Heartbeats to drop dead connections.
 */
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, Server as HttpServer } from 'http';
import type { Socket } from 'net';
import { eventBus } from './event-bus';
import { makeEvent, type RealtimeEnvelope } from './events';
import { authenticateToken } from '../middleware/auth';
import { getProject } from '../services/projects';
import { logger } from '../lib/logger';

interface ManagedSocket extends WebSocket {
  isAlive?: boolean;
  seq?: number;
}

const WS_PATH_PREFIX = '/api/ws/';

export function attachWebSocketServer(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
    let url: URL;
    try {
      url = new URL(req.url ?? '', 'http://localhost');
    } catch {
      socket.destroy();
      return;
    }

    if (!url.pathname.startsWith(WS_PATH_PREFIX)) {
      // Not ours — leave it for any other upgrade handler.
      return;
    }

    const projectId = decodeURIComponent(url.pathname.slice(WS_PATH_PREFIX.length).split('/')[0] ?? '');
    const token = url.searchParams.get('access_token');

    void (async () => {
      const user = await authenticateToken(token);
      if (!user || !projectId) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      const project = await getProject(projectId);
      if (!project || project.user_id !== user.id) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws as ManagedSocket, projectId);
      });
    })().catch((err) => {
      logger.error({ err }, 'WS upgrade failed');
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
    });
  });

  wss.on('connection', (ws: ManagedSocket, projectId: string) => {
    ws.isAlive = true;
    ws.seq = 0;
    const log = logger.child({ projectId });
    log.debug('WS connected');

    const send = (event: RealtimeEnvelope) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.seq = (ws.seq ?? 0) + 1;
      try {
        ws.send(JSON.stringify({ ...event, seq: ws.seq }));
      } catch (err) {
        log.warn({ err }, 'WS send failed');
      }
    };

    send(makeEvent('connected', projectId, { transport: 'websocket', stage: 'handshake' }));

    const unsubscribe = eventBus.subscribe(projectId, send);

    ws.on('pong', () => {
      ws.isAlive = true;
    });
    ws.on('close', () => {
      unsubscribe();
      log.debug('WS closed');
    });
    ws.on('error', () => {
      unsubscribe();
    });
  });

  // Heartbeat: terminate sockets that stopped responding to pings.
  const interval = setInterval(() => {
    for (const client of wss.clients) {
      const ws = client as ManagedSocket;
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        /* ignore */
      }
    }
  }, 30_000);
  interval.unref?.();

  wss.on('close', () => clearInterval(interval));
}
