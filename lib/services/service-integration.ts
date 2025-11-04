/**
 * Service Integration Helper
 * Common utilities for integrating external services (GitHub, Vercel, etc.)
 * This module breaks circular dependencies between service modules
 */

import { getProjectById } from '@/lib/services/project';
import { getProjectService } from '@/lib/services/project-services';

/**
 * Get GitHub repository information from project services
 */
export async function getProjectGitHubRepo(projectId: string): Promise<{
  owner: string;
  repoName: string;
  fullName: string;
} | null> {
  const githubService = await getProjectService(projectId, 'github');
  const githubData = githubService?.serviceData as Record<string, unknown> | undefined;

  if (githubData && typeof githubData.owner === 'string' && typeof githubData.repo_name === 'string') {
    return {
      owner: githubData.owner,
      repoName: githubData.repo_name,
      fullName: `${githubData.owner}/${githubData.repo_name}`,
    };
  }

  return null;
}

/**
 * Get Vercel project information from project services
 */
export async function getProjectVercelInfo(projectId: string): Promise<{
  projectId: string;
  projectName: string;
  teamId: string | null;
} | null> {
  const vercelService = await getProjectService(projectId, 'vercel');
  const vercelData = vercelService?.serviceData as Record<string, unknown> | undefined;

  if (vercelData && typeof vercelData.project_id === 'string') {
    return {
      projectId: vercelData.project_id,
      projectName: typeof vercelData.project_name === 'string' ? vercelData.project_name : '',
      teamId: typeof vercelData.team_id === 'string' ? vercelData.team_id : null,
    };
  }

  return null;
}

/**
 * Validate project exists
 */
export async function validateProjectExists(projectId: string): Promise<void> {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error('Project not found');
  }
}
