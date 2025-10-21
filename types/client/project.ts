/**
 * Client-side Project Types
 */

import type { BaseProject, ServiceConnection } from '../shared/project';

/**
 * Client Project (with optional fields for frontend display)
 */
export interface Project extends BaseProject {
  createdAt: string;
  updatedAt?: string;
  lastActiveAt?: string | null;
  lastMessageAt?: string | null;
  services?: {
    github?: ServiceConnection;
    supabase?: ServiceConnection;
    vercel?: ServiceConnection;
  };
}
