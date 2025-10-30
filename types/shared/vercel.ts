/**
 * Vercel Service Types
 */

export interface CheckResult {
  available: boolean;
}

export interface VercelProjectResponse {
  id: string;
  name: string;
  link?: {
    type?: string;
    url?: string;
  };
  latestDeployments?: Array<{
    id: string;
    url: string;
    readyState: string;
    createdAt?: number;
  }>;
}

export interface VercelDeploymentsResponse {
  deployments: Array<{
    id: string;
    url: string;
    readyState: string;
    inspectorUrl?: string;
    createdAt?: number;
  }>;
}

export interface VercelProjectServiceData {
  project_id?: string | null;
  project_name?: string | null;
  project_url?: string | null;
  github_repo?: string | null;
  team_id?: string | null;
  connected_at?: string;
  last_deployment_id?: string | null;
  last_deployment_status?: string | null;
  last_deployment_url?: string | null;
  last_deployment_at?: string | null;
}

export interface DeploymentStatusResponse {
  has_deployment: boolean;
  status: string | null;
  deployment_id: string | null;
  deployment_url: string | null;
  last_deployment_url: string | null;
  inspector_url: string | null;
  vercel_configured: boolean;
}

export interface VercelError extends Error {
  status?: number;
}
