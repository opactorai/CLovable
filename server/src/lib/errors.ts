/**
 * Typed application errors + an Express error-handling middleware.
 * Routes throw AppError (or call the http helpers); the middleware turns
 * them into clean JSON responses and logs the rest.
 */
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger';
import { isProd } from '../config/env';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = 'app_error',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const httpErrors = {
  badRequest: (msg = 'Bad request', details?: unknown) =>
    new AppError(400, msg, 'bad_request', details),
  unauthorized: (msg = 'Unauthorized') => new AppError(401, msg, 'unauthorized'),
  forbidden: (msg = 'Forbidden') => new AppError(403, msg, 'forbidden'),
  notFound: (msg = 'Not found') => new AppError(404, msg, 'not_found'),
  conflict: (msg = 'Conflict') => new AppError(409, msg, 'conflict'),
  tooManyRequests: (msg = 'Too many requests') =>
    new AppError(429, msg, 'rate_limited'),
  internal: (msg = 'Internal server error') => new AppError(500, msg, 'internal'),
};

/** Wrap an async route handler so thrown errors reach the error middleware. */
export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => unknown>(
  fn: T,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'validation_error', message: 'Invalid request', details: err.issues },
    });
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err }, 'Unhandled application error');
    }
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  logger.error({ err }, 'Unexpected error');
  return res.status(500).json({
    error: {
      code: 'internal',
      message: 'Internal server error',
      ...(isProd ? {} : { details: err instanceof Error ? err.message : String(err) }),
    },
  });
}
