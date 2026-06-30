/**
 * Structured logger (pino). Secrets are redacted globally so tokens/keys
 * never leak into logs even if accidentally attached to a log object.
 */
import { pino } from 'pino';
import { env, isDev } from '../config/env';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.ANTHROPIC_API_KEY',
      '*.SUPABASE_SERVICE_ROLE_KEY',
      '*.token',
      '*.apiKey',
      '*.password',
    ],
    censor: '[redacted]',
  },
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
    : undefined,
  base: { service: 'claudable-cloud-server', env: env.NODE_ENV },
});

/** Create a child logger scoped to a project (and optionally a container). */
export function projectLogger(projectId: string, containerId?: string) {
  return logger.child({ projectId, ...(containerId ? { containerId } : {}) });
}
