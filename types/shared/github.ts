/**
 * GitHub Service Types
 */

export interface GitHubUserInfo {
  login: string;
  name?: string;
  email?: string;
}

export interface CreateRepoOptions {
  repoName: string;
  description?: string;
  private?: boolean;
}

export interface GitHubRepositoryInfo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    id: number | null;
  };
  default_branch: string;
}

export interface GitHubError extends Error {
  status?: number;
}
