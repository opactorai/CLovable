/**
 * Authentication middleware.
 * Extracts the Supabase access token from the Authorization header,
 * verifies it, and attaches the authenticated user to the request.
 */
import type { NextFunction, Request, Response } from 'express';
import { httpErrors } from '../lib/errors';
import { verifyAccessToken, type AuthedUser } from '../lib/supabase';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim() || null;
  }
  // WebSocket upgrade requests can pass the token as a query param.
  const queryToken = req.query.access_token;
  if (typeof queryToken === 'string' && queryToken.length > 0) {
    return queryToken;
  }
  return null;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractBearer(req);
    if (!token) {
      throw httpErrors.unauthorized('Missing access token');
    }
    const user = await verifyAccessToken(token);
    if (!user) {
      throw httpErrors.unauthorized('Invalid or expired access token');
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Resolve and verify a user from a raw token (used by the WebSocket upgrade path). */
export async function authenticateToken(token: string | null): Promise<AuthedUser | null> {
  if (!token) return null;
  return verifyAccessToken(token);
}
