import { getPlainServiceToken } from '@/lib/services/tokens';
import { upsertProjectServiceConnection, updateProjectServiceData, getProjectService } from '@/lib/services/project-services';
import { getProjectById } from '@/lib/services/project';
import { listEnvVars } from '@/lib/services/env';
import { validateProjectExists, getProjectGitHubRepo } from '@/lib/services/service-integration';
import type {
  CheckResult,
  VercelProjectResponse,
  VercelDeploymentsResponse,
  VercelProjectServiceData,
  DeploymentStatusResponse,
} from '@/types/shared';

const VERCEL_API_BASE = 'https://api.vercel.com';

class VercelError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'VercelError';
  }
}

async function vercelFetch<T = any>(
  token: string,
  endpoint: string,
  {
    method = 'GET',
    body,
    teamId,
    query,
  }: {
    method?: string;
    body?: any;
    teamId?: string | null;
    query?: Record<string, string | undefined>;
  } = {},
): Promise<T> {
  const url = new URL(`${VERCEL_API_BASE}${endpoint}`);
  if (teamId) {
    url.searchParams.set('teamId', teamId);
  }
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  let resolvedBody: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
    resolvedBody = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: resolvedBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new VercelError(errorText || `Vercel API request failed (${response.status})`, response.status);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

function normalizeDeploymentUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}

function createEmptyDeploymentResponse(
  overrides: Partial<DeploymentStatusResponse> = {},
): DeploymentStatusResponse {
  return {
    has_deployment: false,
    status: null,
    deployment_id: null,
    deployment_url: null,
    last_deployment_url: null,
    inspector_url: null,
    vercel_configured: true,
    ...overrides,
  };
}

/**
 * Internal function to fetch GitHub repository details
 * Avoids circular dependency with github.ts
 */
async function getGithubRepositoryDetailsInternal(
  vercelToken: string,
  owner: string,
  repo: string,
): Promise<{ id: number; name: string; default_branch: string }> {
  // Import dynamically to avoid circular dependency
  const { getGithubRepositoryDetails } = await import('@/lib/services/github');
  return getGithubRepositoryDetails(owner, repo);
}

export async function checkVercelProjectAvailability(
  projectName: string,
  options?: { teamId?: string | null },
): Promise<CheckResult> {
  const token = await getPlainServiceToken('vercel');
  if (!token) {
    throw new VercelError('Vercel token not configured', 401);
  }

  try {
    const response = await vercelFetch<{ projects: Array<{ name: string }> }>(
      token,
      '/v9/projects',
      {
        method: 'GET',
        teamId: options?.teamId ?? null,
        query: {
          search: projectName,
          limit: '1',
        },
      },
    );

    const exists = Array.isArray(response?.projects)
      ? response.projects.some((project) => project.name === projectName)
      : false;

    return { available: !exists };
  } catch (error) {
    if (error instanceof VercelError && error.status === 404) {
      return { available: true };
    }
    throw error;
  }
}

async function fetchExistingProject(
  token: string,
  projectName: string,
  teamId?: string | null,
): Promise<VercelProjectResponse | null> {
  try {
    const project = await vercelFetch<VercelProjectResponse>(
      token,
      `/v9/projects/${encodeURIComponent(projectName)}`,
      {
        method: 'GET',
        teamId,
      },
    );
    return project;
  } catch (error) {
    if (error instanceof VercelError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function connectVercelProject(
  projectId: string,
  projectName: string,
  options?: { githubRepo?: string | null; teamId?: string | null },
) {
  const token = await getPlainServiceToken('vercel');
  if (!token) {
    throw new VercelError('Vercel token not configured', 401);
  }

  const project = await getProjectById(projectId);
  if (!project) {
    throw new VercelError('Project not found', 404);
  }

  const teamId = options?.teamId ?? null;

  let linkedRepo = options?.githubRepo ?? null;
  if (!linkedRepo) {
    const githubRepo = await getProjectGitHubRepo(projectId);
    if (githubRepo) {
      linkedRepo = githubRepo.fullName;
    }
  }

  const payload: Record<string, unknown> = {
    name: projectName,
    framework: 'nextjs',
  };

  if (linkedRepo) {
    payload.gitRepository = {
      type: 'github',
      repo: linkedRepo,
    };
  }

  let vercelProject: VercelProjectResponse | null = null;

  try {
    vercelProject = await vercelFetch<VercelProjectResponse>(
      token,
      '/v10/projects',
      {
        method: 'POST',
        body: payload,
        teamId,
      },
    );
  } catch (error) {
    if (error instanceof VercelError && error.status === 409) {
      vercelProject = await fetchExistingProject(token, projectName, teamId);
    } else {
      throw error;
    }
  }

  if (!vercelProject) {
    throw new VercelError('Failed to create or retrieve Vercel project', 500);
  }

  const envVars = await listEnvVars(projectId);
  for (const envVar of envVars) {
    try {
      await vercelFetch(
        token,
        `/v10/projects/${vercelProject.id}/env`,
        {
          method: 'POST',
          teamId,
          body: {
            key: envVar.key,
            value: envVar.value,
            target: ['production', 'preview', 'development'],
            type: envVar.is_secret ? 'encrypted' : 'plain',
          },
        },
      );
    } catch (error) {
      if (error instanceof VercelError && error.status === 409) {
        continue;
      }
      console.warn('[Vercel] Failed to sync env var:', envVar.key, error);
    }
  }

  const dashboardUrl = `https://vercel.com/dashboard/projects/${vercelProject.id}`;
  const latestDeployment = Array.isArray(vercelProject.latestDeployments) ? vercelProject.latestDeployments[0] : undefined;

  const serviceData: VercelProjectServiceData = {
    project_id: vercelProject.id,
    project_name: vercelProject.name,
    project_url: vercelProject.link?.url ?? dashboardUrl,
    github_repo: linkedRepo,
    team_id: teamId,
    connected_at: new Date().toISOString(),
    last_deployment_id: latestDeployment?.id ?? null,
    last_deployment_status: latestDeployment?.readyState ?? null,
    last_deployment_url: normalizeDeploymentUrl(latestDeployment?.url),
    last_deployment_at: latestDeployment?.createdAt
      ? new Date(latestDeployment.createdAt).toISOString()
      : null,
  };

  await upsertProjectServiceConnection(projectId, 'vercel', serviceData as Record<string, unknown>);
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

  const data = (service.serviceData ?? {}) as VercelProjectServiceData;
  if (!data.project_id) {
    throw new VercelError('Vercel project ID missing', 400);
  }

  const teamId = data.team_id ?? null;

  const githubRepo = await getProjectGitHubRepo(projectId);
  if (!githubRepo) {
    throw new VercelError('GitHub repository not connected', 400);
  }

  const githubService = await getProjectService(projectId, 'github');
  const githubData = githubService?.serviceData as Record<string, any> | undefined;
  const repoBranch =
    typeof githubData?.default_branch === 'string' && githubData.default_branch.length > 0
      ? githubData.default_branch
      : 'main';

  // Note: GitHub push is handled separately by user action
  // Removed circular dependency to pushProjectToGitHub

  // Fetch GitHub repository details directly
  const repoInfo = await getGithubRepositoryDetailsInternal(token, githubRepo.owner, githubRepo.repoName);
  const ref = repoBranch || repoInfo.default_branch || 'main';

  const deploymentPayload = {
    project: data.project_id,
    name: data.project_name ?? repoInfo.name,
    target: 'production',
    gitSource: {
      type: 'github',
      repoId: repoInfo.id,
      ref,
    },
  };

  if (!data.project_name) {
    await updateProjectServiceData(projectId, 'vercel', {
      project_name: repoInfo.name,
    });
  }

  const { owner: repoOwner, repoName } = githubRepo;

  const deployment = await vercelFetch<{
    id: string;
    url: string;
    readyState: string;
    inspectorUrl?: string;
    createdAt?: number;
  }>(
    token,
    '/v13/deployments',
    {
      method: 'POST',
      teamId,
      body: deploymentPayload,
    },
  );

  const deploymentUrl = normalizeDeploymentUrl(deployment?.url);
  const readyState = deployment?.readyState ?? 'QUEUED';

  await updateProjectServiceData(projectId, 'vercel', {
    github_repo: `${repoOwner}/${repoName}`,
    last_deployment_id: deployment?.id ?? null,
    last_deployment_status: readyState,
    last_deployment_url: deploymentUrl,
    last_deployment_at: deployment?.createdAt
      ? new Date(deployment.createdAt).toISOString()
      : new Date().toISOString(),
  });

  return {
    success: true,
    deploymentId: deployment?.id ?? null,
    deploymentUrl,
    status: readyState,
  };
}

export async function getCurrentDeploymentStatus(projectId: string) {
  const token = await getPlainServiceToken('vercel');
  if (!token) {
    return createEmptyDeploymentResponse({
      status: 'not_configured',
      vercel_configured: false,
    });
  }

  const service = await getProjectService(projectId, 'vercel');
  if (!service || !service.serviceData) {
    return createEmptyDeploymentResponse({ vercel_configured: false });
  }

  const data = service.serviceData as VercelProjectServiceData;
  if (!data.project_id) {
    return createEmptyDeploymentResponse({ vercel_configured: false });
  }

  const teamId = data.team_id ?? null;

  const buildResponse = (deployment?: {
    id: string;
    url: string;
    readyState: string;
    inspectorUrl?: string;
    createdAt?: number;
  }): DeploymentStatusResponse => {
    const deploymentUrl = normalizeDeploymentUrl(deployment?.url ?? data.last_deployment_url);
    const readyState = deployment?.readyState ?? data.last_deployment_status ?? null;
    const deploymentId = deployment?.id ?? data.last_deployment_id ?? null;
    const isActive = readyState === 'QUEUED' || readyState === 'BUILDING';

    return {
      has_deployment: Boolean(isActive && deploymentId),
      status: readyState ?? null,
      last_deployment_url: deploymentUrl ?? null,
      deployment_id: deploymentId ?? null,
      inspector_url: deployment?.inspectorUrl ?? null,
      deployment_url: deploymentUrl ?? null,
      vercel_configured: true,
    };
  };

  if (data.last_deployment_id) {
    try {
      const deployment = await vercelFetch<{
        id: string;
        url: string;
        readyState: string;
        inspectorUrl?: string;
        createdAt?: number;
      }>(
        token,
        `/v13/deployments/${data.last_deployment_id}`,
        {
          method: 'GET',
          teamId,
        },
      );

      const deploymentUrl = normalizeDeploymentUrl(deployment?.url);
      const readyState = deployment?.readyState ?? null;

      await updateProjectServiceData(projectId, 'vercel', {
        last_deployment_id: deployment?.id ?? data.last_deployment_id,
        last_deployment_status: readyState,
        last_deployment_url: deploymentUrl,
        last_deployment_at: deployment?.createdAt
          ? new Date(deployment.createdAt).toISOString()
          : data.last_deployment_at ?? new Date().toISOString(),
      });

      return buildResponse(deployment);
    } catch (error) {
      if (!(error instanceof VercelError && error.status === 404)) {
        throw error;
      }
      // Fall through to list deployments when the stored deployment id is no longer valid.
    }
  }

  const deployments = await vercelFetch<VercelDeploymentsResponse>(
    token,
    `/v13/projects/${data.project_id}/deployments`,
    {
      method: 'GET',
      teamId,
      query: {
        limit: '1',
      },
    },
  );

  const latest = Array.isArray(deployments?.deployments) ? deployments.deployments[0] : undefined;
  if (!latest) {
    return createEmptyDeploymentResponse();
  }

  const deploymentUrl = normalizeDeploymentUrl(latest.url);
  const readyState = latest.readyState ?? null;

  await updateProjectServiceData(projectId, 'vercel', {
    last_deployment_id: latest.id ?? data.last_deployment_id ?? null,
    last_deployment_status: readyState,
    last_deployment_url: deploymentUrl,
    last_deployment_at: latest.createdAt
      ? new Date(latest.createdAt).toISOString()
      : data.last_deployment_at ?? new Date().toISOString(),
  });

  return buildResponse(latest);
}
