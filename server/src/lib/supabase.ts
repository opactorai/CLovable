/**
 * Supabase clients.
 *
 * - `admin`: service-role client. Bypasses RLS — use ONLY on the server, and
 *   always enforce ownership in application code (see services/projects.ts).
 * - `verifyAccessToken`: validates a user's JWT (from the Authorization header)
 *   and returns the authenticated user.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

export const admin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export interface AuthedUser {
  id: string;
  email: string | null;
}

/**
 * Verify a bearer access token issued by Supabase Auth.
 * Returns the user, or null if the token is missing/invalid/expired.
 */
export async function verifyAccessToken(accessToken: string): Promise<AuthedUser | null> {
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) {
    return null;
  }
  return { id: data.user.id, email: data.user.email ?? null };
}
