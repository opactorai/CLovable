import path from 'path';
import fs from 'fs/promises';
import { getPlainServiceToken } from '@/lib/services/tokens';
import { getProjectById, updateProject } from '@/lib/services/project';
import { getProjectService, upsertProjectServiceConnection, updateProjectServiceData } from '@/lib/services/project-services';
import { ensureGitRepository, ensureGitConfig, initializeMainBranch, addOrUpdateRemote, commitAll, pushToRemote } from '@/lib/services/git';

interface GitHubUserInfo {
  login: string;
  name?: string;
  email?: string;
}

interface CreateRepoOptions {
  repoName: string;
  description?: string;
  private?: boolean;
}

class GitHubError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'GitHubError';
  }
}

async function githubFetch(token: string, endpoint: string, init?: RequestInit) {
  const baseUrl = 'https://api.github.com';
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'Claudable-Next',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new GitHubError(message || 'GitHub API request failed', response.status);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function getGithubUser(): Promise<GitHubUserInfo> {
  const token = await getPlainServiceToken('github');
  if (!token) {
    throw new GitHubError('GitHub token not configured', 401);
  }

  const data = (await githubFetch(token, '/user')) as any;
  return {
    login: data.login,
    name: data.name,
    email: data.email,
  };
}

export async function checkRepositoryAvailability(repoName: string) {
  const token = await getPlainServiceToken('github');
  if (!token) {
    throw new GitHubError('GitHub token not configured', 401);
  }

  const user = await getGithubUser();
  try {
    await githubFetch(token, `/repos/${user.login}/${repoName}`);
    return { exists: true, username: user.login };
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) {
      return { exists: false, username: user.login };
    }
    throw error;
  }
}

export async function createRepository(options: CreateRepoOptions) {
  const token = await getPlainServiceToken('github');
  if (!token) {
    throw new GitHubError('GitHub token not configured', 401);
  }

  const payload = {
    name: options.repoName,
    description: options.description ?? '',
    private: options.private ?? false,
    auto_init: false,
  };

  const repo = await githubFetch(token, '/user/repos', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return repo as any;
}

function resolveProjectRepoPath(projectId: string, repoPath?: string | null) {
  if (repoPath) {
    return path.isAbsolute(repoPath) ? repoPath : path.resolve(process.cwd(), repoPath);
  }
  return path.resolve(process.cwd(), process.env.PROJECTS_DIR || './data/projects', projectId);
}

export async function ensureProjectRepository(projectId: string, repoPath?: string | null) {
  const resolved = resolveProjectRepoPath(projectId, repoPath);
  await fs.mkdir(resolved, { recursive: true });
  return resolved;
}

export async function connectProjectToGitHub(projectId: string, options: CreateRepoOptions) {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const token = await getPlainServiceToken('github');
  if (!token) {
    throw new GitHubError('GitHub token not configured', 401);
  }

  const user = await getGithubUser();
  const repo = await createRepository(options);

  const repoPath = await ensureProjectRepository(projectId, project.repoPath);
  ensureGitRepository(repoPath);
  const repoUrl = repo.html_url as string;
  const cloneUrl = repo.clone_url as string;
  const defaultBranch = repo.default_branch as string;

  await updateProject(projectId, { repoPath });

  const userName = user.name || user.login;
  const userEmail = user.email || `${user.login}@users.noreply.github.com`;

  ensureGitConfig(repoPath, userName, userEmail);
  initializeMainBranch(repoPath);

  const authenticatedUrl = cloneUrl.replace('https://', `https://${user.login}:${token}@`);
  addOrUpdateRemote(repoPath, 'origin', authenticatedUrl);
  commitAll(repoPath, 'Initial commit - connected to GitHub');

  await upsertProjectServiceConnection(projectId, 'github', {
    repo_url: repoUrl,
    repo_name: options.repoName,
    clone_url: cloneUrl,
    default_branch: defaultBranch,
    owner: user.login,
  });

  return {
    repo_url: repoUrl,
    clone_url: cloneUrl,
    default_branch: defaultBranch,
    owner: user.login,
  };
}

export async function pushProjectToGitHub(projectId: string) {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const token = await getPlainServiceToken('github');
  if (!token) {
    throw new GitHubError('GitHub token not configured', 401);
  }

  const service = await getProjectService(projectId, 'github');
  const data = service?.serviceData as Record<string, any> | undefined;
  if (!data?.clone_url || !data?.owner) {
    throw new GitHubError('GitHub repository not connected', 404);
  }

  const repoPath = await ensureProjectRepository(projectId, project.repoPath);
  ensureGitRepository(repoPath);
  const authenticatedUrl = String(data.clone_url).replace('https://', `https://${data.owner}:${token}@`);
  addOrUpdateRemote(repoPath, 'origin', authenticatedUrl);
  const committed = commitAll(repoPath, 'Update from Claudable');
  if (!committed) {
    console.log('[GitHubService] No changes to commit before push');
  }
  pushToRemote(repoPath, 'origin', data.default_branch || 'main');

  await updateProjectServiceData(projectId, 'github', {
    last_pushed_at: new Date().toISOString(),
  });
}
