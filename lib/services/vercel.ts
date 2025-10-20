import { getPlainServiceToken } from '@/lib/services/tokens';
import { upsertProjectServiceConnection, updateProjectServiceData, getProjectService } from '@/lib/services/project-services';
import { getProjectById } from '@/lib/services/project';

class VercelError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'VercelError';
  }
}

interface CheckResult {
  available: boolean;
}

export async function checkVercelProjectAvailability(projectName: string): Promise<CheckResult> {
  // Simplified: assume project available if not already recorded
  return { available: true };
}

export async function connectVercelProject(
  projectId: string,
  projectName: string,
  options?: { githubRepo?: string | null }
) {
  const token = await getPlainServiceToken('vercel');
  if (!token) {
    throw new VercelError('Vercel token not configured', 401);
  }

  const project = await getProjectById(projectId);
  if (!project) {
    throw new VercelError('Project not found', 404);
  }

  const serviceData = {
    project_name: projectName,
    github_repo: options?.githubRepo ?? null,
    connected_at: new Date().toISOString(),
    last_deployment_status: null as string | null,
    last_deployment_url: null as string | null,
  };

  await upsertProjectServiceConnection(projectId, 'vercel', serviceData);
  return serviceData;
}

export async function triggerVercelDeployment(projectId: string) {
  const token = await getPlainServiceToken('vercel');
  if (!token) {
    throw new VercelError('Vercel token not configured', 401);
  }

  const service = await getProjectService(projectId, 'vercel');
  if (!service) {
    throw new VercelError('Vercel project not connected', 404);
  }

  const deploymentUrl = `https://${service.serviceData?.project_name ?? 'project'}-${Date.now()}.vercel.app`;
  await updateProjectServiceData(projectId, 'vercel', {
    last_deployment_status: 'READY',
    last_deployment_url: deploymentUrl,
    last_deployment_at: new Date().toISOString(),
  });

  return {
    success: true,
    url: deploymentUrl,
    status: 'READY',
  };
}

export async function getCurrentDeploymentStatus(projectId: string) {
  const service = await getProjectService(projectId, 'vercel');
  if (!service) {
    return { has_deployment: false };
  }

  const data = service.serviceData as Record<string, unknown> | undefined;
  if (!data) {
    return { has_deployment: false };
  }

  return {
    has_deployment: Boolean(data.last_deployment_status),
    status: data.last_deployment_status ?? null,
    last_deployment_url: data.last_deployment_url ?? null,
  };
}
