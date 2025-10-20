import type { WebSocket } from 'ws';
import type { RealtimeEvent } from '@/types';

type ProjectId = string;

interface ManagedSocket extends WebSocket {
  /**
   * Flag used for heartbeat to drop dead connections.
   */
  isAlive?: boolean;
}

class WebSocketManager {
  private connections = new Map<ProjectId, Set<ManagedSocket>>();

  public addConnection(projectId: ProjectId, socket: ManagedSocket): void {
    const projectConnections = this.connections.get(projectId) ?? new Set<ManagedSocket>();
    projectConnections.add(socket);
    this.connections.set(projectId, projectConnections);

    socket.isAlive = true;

    socket.on('pong', () => {
      socket.isAlive = true;
    });

    socket.on('close', () => {
      this.removeConnection(projectId, socket);
    });

    socket.on('error', () => {
      this.removeConnection(projectId, socket);
    });

    // Send initial acknowledgement so clients know the connection succeeded.
    this.safeSend(socket, {
      type: 'connected',
      data: {
        projectId,
        timestamp: new Date().toISOString(),
        transport: 'websocket',
      },
    });
  }

  public removeConnection(projectId: ProjectId, socket: ManagedSocket): void {
    const projectConnections = this.connections.get(projectId);
    if (!projectConnections) {
      return;
    }

    projectConnections.delete(socket);

    if (projectConnections.size === 0) {
      this.connections.delete(projectId);
    }
  }

  public broadcast(projectId: ProjectId, data: RealtimeEvent | string): void {
    const projectConnections = this.connections.get(projectId);
    if (!projectConnections || projectConnections.size === 0) {
      return;
    }

    const payload = typeof data === 'string' ? data : JSON.stringify(data);

    for (const socket of [...projectConnections]) {
      if (socket.readyState !== socket.OPEN) {
        projectConnections.delete(socket);
        continue;
      }

      try {
        socket.send(payload);
      } catch {
        projectConnections.delete(socket);
      }
    }

    if (projectConnections.size === 0) {
      this.connections.delete(projectId);
    }
  }

  /**
   * Iterate through all active sockets and terminate dead connections.
   */
  public pruneDeadConnections(): void {
    for (const [projectId, sockets] of this.connections.entries()) {
      for (const socket of sockets) {
        if (socket.isAlive === false) {
          socket.terminate();
          sockets.delete(socket);
          continue;
        }

        socket.isAlive = false;
        socket.ping();
      }

      if (sockets.size === 0) {
        this.connections.delete(projectId);
      }
    }
  }

  private safeSend(socket: ManagedSocket, data: RealtimeEvent): void {
    if (socket.readyState !== socket.OPEN) {
      return;
    }
    try {
      socket.send(JSON.stringify(data));
    } catch {
      // Ignore send failures; cleanup happens via close/error.
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __claudable_ws_manager__: WebSocketManager | undefined;
  // eslint-disable-next-line no-var
  var __claudable_ws_heartbeat__: NodeJS.Timeout | undefined;
}

export const websocketManager: WebSocketManager =
  globalThis.__claudable_ws_manager__ ?? (globalThis.__claudable_ws_manager__ = new WebSocketManager());

export function ensureHeartbeat(): void {
  if (globalThis.__claudable_ws_heartbeat__) {
    return;
  }

  globalThis.__claudable_ws_heartbeat__ = setInterval(() => {
    websocketManager.pruneDeadConnections();
  }, 30_000);
}
