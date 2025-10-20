import { getPlainServiceToken } from '@/lib/services/tokens';
import { upsertProjectServiceConnection } from '@/lib/services/project-services';

class SupabaseError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'SupabaseError';
  }
}

export async function createSupabaseProject(
  projectId: string,
  projectName: string,
  options: { dbPassword: string; region?: string }
) {
  const token = await getPlainServiceToken('supabase');
  if (!token) {
    throw new SupabaseError('Supabase token not configured', 401);
  }

  const projectSlug = `${projectName}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const projectUrl = `https://${projectSlug}.supabase.co`;

  const serviceData = {
    project_name: projectName,
    project_url: projectUrl,
    region: options.region ?? 'us-east-1',
    created_at: new Date().toISOString(),
  };

  await upsertProjectServiceConnection(projectId, 'supabase', serviceData);

  return {
    success: true,
    project_url: projectUrl,
    project_name: projectName,
  };
}

export async function connectExistingSupabase(
  projectId: string,
  payload: { projectUrl: string; projectName?: string | null }
) {
  const token = await getPlainServiceToken('supabase');
  if (!token) {
    throw new SupabaseError('Supabase token not configured', 401);
  }

  const serviceData = {
    project_url: payload.projectUrl,
    project_name: payload.projectName ?? payload.projectUrl,
    connected_at: new Date().toISOString(),
  };

  await upsertProjectServiceConnection(projectId, 'supabase', serviceData);
  return serviceData;
}
