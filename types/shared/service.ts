/**
 * Shared Service Types
 */

export type ServiceProvider = 'github' | 'vercel' | 'supabase';

export type ServiceStatus = 'connected' | 'disconnected' | 'error';

export interface ServiceConnectionData {
  provider: ServiceProvider;
  status: ServiceStatus;
  connectedAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * GitHub Service Data
 */
export interface GitHubServiceData {
  repo_url: string;
  repo_name: string;
  clone_url: string;
  default_branch: string;
  owner: string;
  last_pushed_at?: string;
}

/**
 * Vercel Service Data
 */
export interface VercelServiceData {
  project_id: string;
  project_name: string;
  project_url?: string | null;
  github_repo?: string | null;
  team_id?: string | null;
  connected_at?: string;
  last_deployment_id?: string | null;
  last_deployment_status?: string | null;
  last_deployment_url?: string | null;
  last_deployment_at?: string | null;
}

/**
 * Supabase Service Data
 */
export interface SupabaseServiceData {
  project_id: string;
  project_name: string;
  database_url: string;
  anon_key?: string;
  service_role_key?: string;
  connected_at?: string;
}
