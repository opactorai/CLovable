import { getPlainServiceToken } from '@/lib/services/tokens';
import { upsertProjectServiceConnection } from '@/lib/services/project-services';

const SUPABASE_API_BASE = 'https://api.supabase.com/v1';

class SupabaseError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'SupabaseError';
  }
}

export interface SupabaseOrganization {
  id: string;
  name: string;
  slug: string;
}

export interface SupabaseProject {
  id: string;
  name: string;
  organization_id: string;
  status: string;
  region: string;
  inserted_at?: string;
  created_at?: string;
  database?: {
    host?: string;
    version?: string;
  };
}

export interface SupabaseApiKeys {
  anon: string;
  service_role: string;
}

async function requireSupabaseToken(): Promise<string> {
  const token = await getPlainServiceToken('supabase');
  if (!token) {
    throw new SupabaseError('Supabase token not configured', 401);
  }
  return token;
}

async function supabaseFetch<T = any>(
  endpoint: string,
  {
    method = 'GET',
    body,
    token,
  }: {
    method?: string;
    body?: any;
    token?: string;
  } = {},
): Promise<T> {
  const resolvedToken = token ?? (await requireSupabaseToken());
  const headers: Record<string, string> = {
    Authorization: `Bearer ${resolvedToken}`,
  };

  let resolvedBody: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
    resolvedBody = JSON.stringify(body);
  }

  const response = await fetch(`${SUPABASE_API_BASE}${endpoint}`, {
    method,
    headers,
    body: resolvedBody,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new SupabaseError(text || `Supabase API request failed (${response.status})`, response.status);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export async function listSupabaseOrganizations(): Promise<SupabaseOrganization[]> {
  const organizations = await supabaseFetch<SupabaseOrganization[]>('/organizations');
  return Array.isArray(organizations) ? organizations : [];
}

export async function createSupabaseProject(
  projectId: string,
  projectName: string,
  options: { dbPassword: string; region?: string; organizationId: string },
) {
  if (!options.organizationId) {
    throw new SupabaseError('organizationId is required', 400);
  }

  const project = await supabaseFetch<SupabaseProject>('/projects', {
    method: 'POST',
    body: {
      organization_id: options.organizationId,
      name: projectName,
      region: options.region ?? 'us-east-1',
      db_pass: options.dbPassword,
    },
  });

  const serviceData = {
    project_id: project.id,
    project_name: project.name,
    project_url: `https://${project.id}.supabase.co`,
    region: project.region,
    organization_id: project.organization_id,
    created_at: project.inserted_at ?? project.created_at ?? new Date().toISOString(),
  };

  await upsertProjectServiceConnection(projectId, 'supabase', serviceData);

  return project;
}

export async function getSupabaseProject(projectId: string): Promise<SupabaseProject> {
  return supabaseFetch<SupabaseProject>(`/projects/${projectId}`);
}

export async function getSupabaseApiKeys(projectId: string): Promise<SupabaseApiKeys> {
  const response = await supabaseFetch<unknown>(`/projects/${projectId}/api-keys`);

  if (Array.isArray(response)) {
    const anonKey = response.find((item) => item && typeof item === 'object' && ('name' in item || 'id' in item) && ((item as any).name === 'anon' || (item as any).id === 'anon'));
    const serviceRoleKey = response.find((item) => item && typeof item === 'object' && ('name' in item || 'id' in item) && ((item as any).name === 'service_role' || (item as any).id === 'service_role'));

    const anon = anonKey && typeof (anonKey as any).api_key === 'string' ? (anonKey as any).api_key : null;
    const serviceRole = serviceRoleKey && typeof (serviceRoleKey as any).api_key === 'string' ? (serviceRoleKey as any).api_key : null;

    if (anon && serviceRole) {
      return { anon, service_role: serviceRole };
    }
  } else if (response && typeof response === 'object') {
    const anon = typeof (response as any).anon === 'string' ? (response as any).anon : typeof (response as any).anon_key === 'string' ? (response as any).anon_key : null;
    const serviceRole =
      typeof (response as any).service_role === 'string'
        ? (response as any).service_role
        : typeof (response as any).service_role_key === 'string'
        ? (response as any).service_role_key
        : null;

    if (anon && serviceRole) {
      return { anon, service_role: serviceRole };
    }
  }

  throw new SupabaseError('Supabase API keys not available yet', 404);
}

export async function connectExistingSupabase(
  projectId: string,
  payload: { projectId: string; projectUrl: string; projectName?: string | null; region?: string | null },
) {
  await requireSupabaseToken();

  const serviceData = {
    project_id: payload.projectId,
    project_url: payload.projectUrl,
    project_name: payload.projectName ?? payload.projectUrl,
    region: payload.region ?? null,
    connected_at: new Date().toISOString(),
  };

  await upsertProjectServiceConnection(projectId, 'supabase', serviceData);
  return serviceData;
}
