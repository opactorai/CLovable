import { config } from './config';

interface SupabaseConnectionStatus {
  connected: boolean;
  account?: {
    email: string;
    name?: string;
    supabaseUserId: string;
  };
  organizationCount?: number;
}

interface SupabaseOrganization {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug?: string;
  role: 'owner' | 'admin' | 'member';
  permissions: {
    createProject?: boolean;
    deleteProject?: boolean;
    manageMembers?: boolean;
  };
  status: 'active' | 'suspended' | 'removed';
  projectCount: number;
  linkedAt: string;
}

interface SupabaseProject {
  id: string;
  ref: string;
  name: string;
  region: string;
  status: string;
  created_at: string;
}

interface ProjectConnectionStatus {
  connected: boolean;
  mapping?: {
    supabaseProjectId: string;
    supabaseProjectName: string;
    supabaseUrl: string;
    anonKey: string;
    organization: {
      id: string;
      name: string;
    };
    lastSyncedAt?: string;
    createdAt: string;
  };
}

const getAuthToken = () => localStorage.getItem('token') || '';

const getAuthHeaders = () => {
  const token = getAuthToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

const CONNECTION_STATUS_TTL = 60 * 1000; // 60 seconds cache window
let connectionStatusCache: SupabaseConnectionStatus | null = null;
let connectionStatusFetchedAt: number | null = null;
let connectionStatusCacheToken: string | null = null;

const shouldUseConnectionCache = (forceRefresh?: boolean) => {
  const token = getAuthToken();
  if (forceRefresh) return false;
  if (!connectionStatusCache || !connectionStatusFetchedAt) return false;
  if (!token || connectionStatusCacheToken !== token) return false;
  return Date.now() - connectionStatusFetchedAt < CONNECTION_STATUS_TTL;
};

const setConnectionStatusCache = (status: SupabaseConnectionStatus | null) => {
  connectionStatusCache = status;
  connectionStatusFetchedAt = status ? Date.now() : null;
  connectionStatusCacheToken = status ? getAuthToken() : null;
};

export const supabaseClient = {
  // 계정 연결 상태 확인
  async getConnectionStatus(
    options: { forceRefresh?: boolean } = {},
  ): Promise<SupabaseConnectionStatus> {
    if (shouldUseConnectionCache(options.forceRefresh)) {
      return connectionStatusCache as SupabaseConnectionStatus;
    }

    const response = await fetch(
      `${config.apiUrl}/api/supabase/connection/status`,
      {
        headers: getAuthHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error('Failed to fetch connection status');
    }

    const status = await response.json();
    setConnectionStatusCache(status);
    return status;
  },

  invalidateConnectionStatusCache(): void {
    setConnectionStatusCache(null);
  },

  // OAuth URL 받기
  async getOAuthUrl(): Promise<{ oauthUrl: string; state: string }> {
    const response = await fetch(`${config.apiUrl}/api/supabase/oauth/url`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch OAuth URL');
    }

    return response.json();
  },

  // Organization 목록
  async getOrganizations(): Promise<{
    organizations: SupabaseOrganization[];
  }> {
    const response = await fetch(
      `${config.apiUrl}/api/supabase/organizations`,
      {
        headers: getAuthHeaders(),
        credentials: 'include',
      },
    );

    if (!response.ok) {
      throw new Error('Failed to fetch organizations');
    }

    return response.json();
  },

  // Organization 동기화
  async syncOrganizations(): Promise<{
    addedCount: number;
    updatedCount: number;
    removedCount: number;
    organizations: SupabaseOrganization[];
  }> {
    const response = await fetch(
      `${config.apiUrl}/api/supabase/organizations/sync`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error('Failed to sync organizations');
    }

    return response.json();
  },

  // Organization 연결 해제
  async removeOrganization(organizationId: string): Promise<void> {
    const response = await fetch(
      `${config.apiUrl}/api/supabase/organizations/${organizationId}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error('Failed to remove organization');
    }
  },

  // Organization의 Supabase Project 목록
  async getOrganizationProjects(
    organizationId: string,
  ): Promise<{ projects: SupabaseProject[] }> {
    const response = await fetch(
      `${config.apiUrl}/api/supabase/organizations/${organizationId}/projects`,
      {
        headers: getAuthHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error('Failed to fetch organization projects');
    }

    return response.json();
  },

  // 프로젝트 연결 상태
  async getProjectStatus(projectId: string): Promise<ProjectConnectionStatus> {
    const response = await fetch(
      `${config.apiUrl}/api/supabase/projects/${projectId}/status`,
      {
        headers: getAuthHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error('Failed to fetch project status');
    }

    return response.json();
  },

  // 기존 Supabase 프로젝트에 연결
  async connectProject(
    projectId: string,
    organizationId: string,
    supabaseProjectId: string,
  ): Promise<{
    success: boolean;
    mapping: {
      id: string;
      supabaseProjectId: string;
      supabaseProjectName: string;
      supabaseUrl: string;
      anonKey: string;
      createdAt: string;
    };
  }> {
    const response = await fetch(
      `${config.apiUrl}/api/supabase/projects/${projectId}/connect`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          organizationId,
          supabaseProjectId,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to connect project');
    }

    return response.json();
  },

  // 새 Supabase 프로젝트 생성 및 연결
  async createAndConnectProject(
    projectId: string,
    organizationId: string,
    projectName: string,
    dbPassword: string,
    region?: string,
  ): Promise<{
    success: boolean;
    supabaseProject: {
      id: string;
      name: string;
      url: string;
      anonKey: string;
      serviceRoleKey: string;
    };
    mapping: {
      id: string;
      supabaseProjectId: string;
      supabaseProjectName: string;
      supabaseUrl: string;
      createdAt: string;
    };
  }> {
    const response = await fetch(
      `${config.apiUrl}/api/supabase/projects/${projectId}/create`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          organizationId,
          projectName,
          dbPassword,
          region,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to create project');
    }

    return response.json();
  },

  // 프로젝트 연결 해제
  async disconnectProject(projectId: string): Promise<void> {
    const response = await fetch(
      `${config.apiUrl}/api/supabase/projects/${projectId}/disconnect`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error('Failed to disconnect project');
    }
  },

  // Supabase 연결 완전 해제
  async revokeConnection(): Promise<void> {
    const response = await fetch(
      `${config.apiUrl}/api/supabase/connection`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error('Failed to revoke connection');
    }

    this.invalidateConnectionStatusCache();
  },
};
