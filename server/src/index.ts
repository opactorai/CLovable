/**
 * Server entry point.
 * Boots the session manager (Docker reconciliation + reaper), starts the HTTP
 * server, and attaches the WebSocket server to the same port.
 */
import { createServer } from 'node:http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { createApp } from './app';
import { attachWebSocketServer } from './realtime/ws-server';
import { sessionManager } from './workspace/session-manager';

async function main() {
  // Initialize workspace orchestration before accepting traffic.
  await sessionManager.init().catch((err) => {
    logger.error({ err }, 'Session manager init failed (continuing without containers)');
  });

  const app = createApp();
  const server = createServer(app);
  attachWebSocketServer(server);

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, '🚀 Claudable Cloud server listening');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    await sessionManager.shutdown().catch(() => {});
    server.close(() => process.exit(0));
    // Force-exit if connections linger.
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
