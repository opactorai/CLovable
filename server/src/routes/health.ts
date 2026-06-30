import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'claudable-cloud-server', time: new Date().toISOString() });
});
