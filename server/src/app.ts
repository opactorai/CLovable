/**
 * Express application factory. Kept separate from index.ts so it can be
 * imported in tests without binding a port.
 */
import express, { type Express } from 'express';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { errorMiddleware } from './lib/errors';
import { healthRouter } from './routes/health';
import { projectsRouter } from './routes/projects';
import { settingsRouter } from './routes/settings';

export function createApp(): Express {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: '10mb' }));

  // CORS for the Next.js frontend.
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', env.FRONTEND_ORIGIN);
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(healthRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/settings', settingsRouter);

  app.use(errorMiddleware);
  return app;
}
