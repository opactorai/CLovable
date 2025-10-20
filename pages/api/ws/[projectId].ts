import type { NextApiRequest, NextApiResponse } from 'next';
import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage, Server as HTTPServer } from 'http';
import type { Socket } from 'net';
import { parse } from 'url';
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

    // Attach a single upgrade listener to the HTTP server
    server.on('upgrade', (request: IncomingMessage, socket: Socket, head: Buffer) => {
      try {
        const { pathname } = parse(request.url ?? '', true);
        // Only handle our WS endpoint: /api/ws/<projectId>
        if (!pathname || !pathname.startsWith('/api/ws/')) {
          return; // Let Next.js handle other upgrades (HMR, etc.)
        }

        wss.handleUpgrade(request, socket, head, (websocket: WebSocket) => {
          const projectId = pathname.split('/').filter(Boolean).pop();
          if (!projectId) {
            websocket.close(1008, 'Project ID required');
            return;
          }
          websocketManager.addConnection(projectId, websocket as any);
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
  res.status(200).json({ ok: true });
}
