import type { NextApiRequest, NextApiResponse } from 'next';
import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage, Server as HTTPServer } from 'http';
import type { Socket } from 'net';
import { ensureHeartbeat, websocketManager } from '@/lib/server/websocket-manager';

type NextApiResponseWithSocket = NextApiResponse & {
  socket: Socket & {
    server: HTTPServer & {
      wss?: WebSocketServer;
      __ws_initialized__?: boolean;
    };
  };
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  // Initialize a shared WebSocket server on the underlying HTTP server once.
  const baseSocket = res.socket as any;
  if (!baseSocket?.server) {
    res.status(500).send('Socket server unavailable');
    return;
  }

  const server = baseSocket.server as typeof baseSocket.server & {
    wss?: WebSocketServer;
    __ws_initialized__?: boolean;
  };

  if (!server.__ws_initialized__) {
    const wss = new WebSocketServer({ noServer: true });

    const handleConnection = (websocket: WebSocket, request: IncomingMessage) => {
      const requestUrl = new URL(request.url ?? '', 'http://localhost');
      const segment = requestUrl.pathname.split('/').filter(Boolean).pop();
      const projectId = segment ? decodeURIComponent(segment) : null;

      if (!projectId) {
        websocket.close(1008, 'Project ID required');
        return;
      }

      websocketManager.addConnection(projectId, websocket as any);
    };

    wss.on('connection', handleConnection);

    // Attach a single upgrade listener to the HTTP server
    server.on('upgrade', (request: IncomingMessage, socket: Socket, head: Buffer) => {
      try {
        const upgradeUrl = new URL(request.url ?? '', 'http://localhost');

        // Only handle our WS endpoint: /api/ws/<projectId>
        if (!upgradeUrl.pathname.startsWith('/api/ws/')) {
          return; // Let Next.js handle other upgrades (HMR, etc.)
        }

        wss.handleUpgrade(request, socket, head, (websocket: WebSocket) => {
          wss.emit('connection', websocket, request);
        });
      } catch {
        try {
          socket.destroy();
        } catch {
          // Ignore socket destroy failures
        }
      }
    });

    server.wss = wss;
    server.__ws_initialized__ = true;
    ensureHeartbeat();
  }

  // When the browser initiates the WebSocket handshake it sends an Upgrade request.
  // The actual upgrade is handled in the server.on('upgrade') listener above,
  // so we must not attempt to write a normal HTTP response here.
  if (req.headers.upgrade?.toLowerCase() === 'websocket') {
    return;
  }

  // This API route is only used to ensure the server is initialized.
  // Respond with a simple 200 so the client knows the endpoint exists.
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.status(200).json({ ok: true });
}
