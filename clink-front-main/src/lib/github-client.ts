import { config } from './config';

interface GitHubConnectionStatus {
  connected: boolean;
  installation?: {
    id: string; // UUID database ID
    targetLogin: string;
    targetType: string;
  };
  githubUsername?: string;
  hasOAuthToken?: boolean;
}

interface GitHubInstallation {
  id: string; // UUID database ID
  targetLogin: string;
  targetType: string;
}

interface ProjectSyncStatus {
  isSynced: boolean;
  repository?: {
    url: string;
    fullName: string;
  };
}

type GithubClientMode = 'default' | 'import';
const DEFAULT_MODE: GithubClientMode = 'default';

const withModeParam = (url: string, mode: GithubClientMode): string => {
  if (!mode || mode === DEFAULT_MODE) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}mode=${mode}`;
};

const getAuthToken = () => localStorage.getItem('token') || '';

const getAuthHeaders = () => {
  const token = getAuthToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

const CONNECTION_STATUS_TTL = 60 * 1000; // 60 seconds cache window

type ConnectionCacheEntry = {
  status: GitHubConnectionStatus | null;
  fetchedAt: number | null;
  token: string | null;
};

const connectionCache: Record<GithubClientMode, ConnectionCacheEntry> = {
  default: { status: null, fetchedAt: null, token: null },
  import: { status: null, fetchedAt: null, token: null },
};

const shouldUseConnectionCache = (
  mode: GithubClientMode,
  forceRefresh?: boolean,
) => {
  const cacheEntry = connectionCache[mode];
  const token = getAuthToken();
  if (forceRefresh) return false;
  if (!cacheEntry.status || !cacheEntry.fetchedAt) return false;
  if (!token || cacheEntry.token !== token) return false;
  return Date.now() - cacheEntry.fetchedAt < CONNECTION_STATUS_TTL;
};

const setConnectionStatusCache = (
  mode: GithubClientMode,
  status: GitHubConnectionStatus | null,
) => {
  connectionCache[mode] = {
    status,
    fetchedAt: status ? Date.now() : null,
    token: status ? getAuthToken() : null,
  };
};

const clearConnectionStatusCache = (mode?: GithubClientMode) => {
  if (mode) {
    setConnectionStatusCache(mode, null);
    return;
  }
  (['default', 'import'] as GithubClientMode[]).forEach((cacheMode) =>
    setConnectionStatusCache(cacheMode, null),
  );
};

export const githubClient = {
  // 계정 연결 상태 확인
  async getConnectionStatus(
    options: { forceRefresh?: boolean; mode?: GithubClientMode } = {},
  ): Promise<GitHubConnectionStatus> {
    const mode = options.mode ?? DEFAULT_MODE;
    if (shouldUseConnectionCache(mode, options.forceRefresh)) {
      return connectionCache[mode].status as GitHubConnectionStatus;
    }

    const response = await fetch(
      withModeParam(
        `${config.apiUrl}/api/github/connection/status`,
        mode,
      ),
      {
        headers: getAuthHeaders(),
        credentials: 'include',
      },
    );

    if (!response.ok) {
      throw new Error('Failed to fetch connection status');
    }

    const status = await response.json();
    setConnectionStatusCache(mode, status);
    return status;
  },
  invalidateConnectionStatusCache(mode?: GithubClientMode): void {
    clearConnectionStatusCache(mode);
  },

  // 연결된 Organization 목록
  async getInstallations(options: {
    mode?: GithubClientMode;
  } = {}): Promise<{ installations: GitHubInstallation[] }> {
    const mode = options.mode ?? DEFAULT_MODE;
    const response = await fetch(
      withModeParam(`${config.apiUrl}/api/github/installations`, mode),
      {
        headers: getAuthHeaders(),
        credentials: 'include',
      },
    );

    if (!response.ok) {
      throw new Error('Failed to fetch installations');
    }

    return response.json();
  },

  // GitHub에서 installations 동기화
  async syncInstallations(options: {
    mode?: GithubClientMode;
  } = {}): Promise<{ success: boolean; syncedCount: number; installations: GitHubInstallation[] }> {
    const mode = options.mode ?? DEFAULT_MODE;
    const response = await fetch(
      withModeParam(`${config.apiUrl}/api/github/installations/sync`, mode),
      {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      },
    );

    if (!response.ok) {
      throw new Error('Failed to sync installations');
    }

    return response.json();
  },

  // GitHub App 설치 URL 받기
  async getInstallUrl(
    mode: GithubClientMode = DEFAULT_MODE,
  ): Promise<{ installUrl: string; state: string; userId: string; mode: GithubClientMode }> {
    const response = await fetch(
      withModeParam(`${config.apiUrl}/api/github/install`, mode),
      {
        headers: getAuthHeaders(),
        credentials: 'include',
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || `Failed to fetch install URL (${response.status})`;

      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      }

      throw new Error(errorMessage);
    }

    return response.json();
  },

  // 연결 해제
  async disconnectInstallation(installationId: string): Promise<void> {
    const response = await fetch(
      `${config.apiUrl}/api/github/connection/${installationId}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      },
    );

    if (!response.ok) {
      throw new Error('Failed to disconnect installation');
    }
  },

  // 사용자의 GitHub repositories 가져오기
  async getRepositories(
    page: number = 1,
    perPage: number = 30,
    installationId?: number,
    options: { mode?: GithubClientMode } = {},
  ): Promise<{
    repositories: Array<{
      id: number;
      name: string;
      full_name: string;
      description: string | null;
      private: boolean;
      html_url: string;
      clone_url: string;
      default_branch: string;
      language: string | null;
      stargazers_count: number;
      updated_at: string;
      owner: {
        login: string;
        avatar_url: string;
      };
    }>;
    totalCount: number;
    page: number;
    perPage: number;
  }> {
    const mode = options.mode ?? DEFAULT_MODE;

    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });

    if (installationId) {
      params.append('installation_id', installationId.toString());
    }

    if (mode !== DEFAULT_MODE) {
      params.append('mode', mode);
    }

    const response = await fetch(
      `${config.apiUrl}/api/github/repositories?${params.toString()}`,
      {
        headers: getAuthHeaders(),
        credentials: 'include',
      },
    );

    if (!response.ok) {
      throw new Error('Failed to fetch repositories');
    }

    return response.json();
  },

  // 프로젝트 동기화 상태
  async getProjectSyncStatus(projectId: string): Promise<ProjectSyncStatus> {
    const response = await fetch(
      `${config.apiUrl}/api/github/projects/${projectId}/sync/status`,
      {
        headers: getAuthHeaders(),
        credentials: 'include',
      },
    );

    if (!response.ok) {
      throw new Error('Failed to fetch project sync status');
    }

    return response.json();
  },

  // 동기화 활성화
  async enableProjectSync(
    projectId: string,
    installationId: string,
    options?: { repositoryName?: string; private?: boolean },
  ): Promise<{ repository: { url: string; fullName: string } }> {
    const response = await fetch(
      `${config.apiUrl}/api/github/projects/${projectId}/sync/enable`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          installationId,
          ...options,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to enable project sync (${response.status}): ${errorText}`);
    }

    return response.json();
  },

  // 동기화 비활성화
  async disableProjectSync(projectId: string): Promise<void> {
    const response = await fetch(
      `${config.apiUrl}/api/github/projects/${projectId}/sync/disable`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      },
    );

    if (!response.ok) {
      throw new Error('Failed to disable project sync');
    }
  },
};
