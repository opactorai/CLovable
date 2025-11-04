import { create } from 'zustand';
import { githubClient } from '@/lib/github-client';
import { supabaseClient } from '@/lib/supabase-client';
import { clientLogger } from '@/lib/client-logger';

// GitHub Types
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
  permissions?: Record<string, unknown>;
}

interface GitHubProjectSyncStatus {
  isSynced: boolean;
  repository?: {
    url: string;
    fullName: string;
  };
}

// Supabase Types
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
  projectCount: number;
  status: string;
}

interface SupabaseProjectStatus {
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

interface IntegrationsState {
  // GitHub State
  github: {
    connectionStatus: GitHubConnectionStatus | null;
    projectSyncStatus: Record<string, GitHubProjectSyncStatus>; // projectId -> status
    installations: GitHubInstallation[];
    isLoading: boolean;
    error: string | null;
    lastFetched: number | null;
  };

  // Supabase State
  supabase: {
    connectionStatus: SupabaseConnectionStatus | null;
    projectStatus: Record<string, SupabaseProjectStatus>; // projectId -> status
    organizations: SupabaseOrganization[];
    isLoading: boolean;
    error: string | null;
    lastFetched: number | null;
  };

  // GitHub Actions
  fetchGitHubStatus: (
    projectId: string,
    forceRefresh?: boolean,
  ) => Promise<void>;
  fetchGitHubInstallations: () => Promise<void>;
  invalidateGitHubStatus: (projectId: string) => void;
  resetGitHub: () => void;

  // Supabase Actions
  fetchSupabaseStatus: (
    projectId: string,
    forceRefresh?: boolean,
  ) => Promise<void>;
  fetchSupabaseOrganizations: () => Promise<void>;
  invalidateSupabaseStatus: (projectId: string) => void;
  resetSupabase: () => void;
}

const CACHE_TTL = 60 * 1000; // 60 seconds

export const useIntegrationsStore = create<IntegrationsState>((set, get) => ({
  github: {
    connectionStatus: null,
    projectSyncStatus: {},
    installations: [],
    isLoading: false,
    error: null,
    lastFetched: null,
  },

  supabase: {
    connectionStatus: null,
    projectStatus: {},
    organizations: [],
    isLoading: false,
    error: null,
    lastFetched: null,
  },

  // GitHub Actions
  fetchGitHubStatus: async (projectId: string, forceRefresh = false) => {
    const { github } = get();
    const now = Date.now();

    // Use cache if available and fresh
    if (
      !forceRefresh &&
      github.lastFetched &&
      now - github.lastFetched < CACHE_TTL &&
      github.connectionStatus &&
      github.projectSyncStatus[projectId]
    ) {
      clientLogger.debug('🎯 Using cached GitHub status');
      return;
    }

    set((state) => ({
      github: { ...state.github, isLoading: true, error: null },
    }));

    try {
      const [connectionStatus, syncStatus] = await Promise.allSettled([
        githubClient.getConnectionStatus({ forceRefresh }),
        githubClient.getProjectSyncStatus(projectId),
      ]);

      const newState: Partial<IntegrationsState['github']> & {
        isLoading: boolean;
        lastFetched: number;
      } = { isLoading: false, lastFetched: now };

      if (connectionStatus.status === 'fulfilled') {
        console.log('📥 [STORE] Setting connectionStatus:', connectionStatus.value);
        newState.connectionStatus = connectionStatus.value;
      } else {
        console.log('📥 [STORE] Setting connectionStatus to disconnected');
        newState.connectionStatus = { connected: false };
      }

      if (syncStatus.status === 'fulfilled') {
        console.log('📥 [STORE] Setting projectSyncStatus:', syncStatus.value);
        newState.projectSyncStatus = {
          ...github.projectSyncStatus,
          [projectId]: syncStatus.value,
        };
      } else {
        console.log('📥 [STORE] Setting projectSyncStatus to not synced');
        newState.projectSyncStatus = {
          ...github.projectSyncStatus,
          [projectId]: { isSynced: false },
        };
      }

      console.log('🔄 [STORE] Updating store with new state:', newState);
      set((state) => ({ github: { ...state.github, ...newState } }));
    } catch (error) {
      console.error('Failed to fetch GitHub status:', error);
      set((state) => ({
        github: {
          ...state.github,
          isLoading: false,
          error: 'Failed to load GitHub integration status',
        },
      }));
    }
  },

  fetchGitHubInstallations: async () => {
    try {
      console.log('📡 [STORE] Fetching GitHub installations from API...');
      const response = await githubClient.getInstallations();
      console.log('📥 [STORE] API response:', response);
      const { installations } = response;
      console.log('📥 [STORE] Received installations:', installations);
      set((state) => ({
        github: { ...state.github, installations },
      }));
      console.log('🔄 [STORE] Store updated with installations');
    } catch (error) {
      console.error('❌ [STORE] Failed to fetch GitHub installations:', error);
      set((state) => ({
        github: { ...state.github, installations: [] },
      }));
    }
  },

  invalidateGitHubStatus: (projectId: string) => {
    // Clear cache for this project to force refetch on next access
    set((state) => {
      const nextProjectSyncStatus = { ...state.github.projectSyncStatus };
      delete nextProjectSyncStatus[projectId];
      return {
        github: {
          ...state.github,
          lastFetched: null,
          projectSyncStatus: nextProjectSyncStatus,
        },
      };
    });
  },

  resetGitHub: () => {
    set({
      github: {
        connectionStatus: null,
        projectSyncStatus: {},
        installations: [],
        isLoading: false,
        error: null,
        lastFetched: null,
      },
    });
  },

  // Supabase Actions
  fetchSupabaseStatus: async (projectId: string, forceRefresh = false) => {
    const { supabase } = get();
    const now = Date.now();

    // Use cache if available and fresh
    if (
      !forceRefresh &&
      supabase.lastFetched &&
      now - supabase.lastFetched < CACHE_TTL &&
      supabase.connectionStatus &&
      supabase.projectStatus[projectId]
    ) {
      clientLogger.debug('🎯 Using cached Supabase status');
      return;
    }

    set((state) => ({
      supabase: { ...state.supabase, isLoading: true, error: null },
    }));

    try {
      const [connectionStatus, projectStatus] = await Promise.allSettled([
        supabaseClient.getConnectionStatus({ forceRefresh }),
        supabaseClient.getProjectStatus(projectId),
      ]);

      const newState: Partial<IntegrationsState['supabase']> & {
        isLoading: boolean;
        lastFetched: number;
      } = { isLoading: false, lastFetched: now };

      if (connectionStatus.status === 'fulfilled') {
        newState.connectionStatus = connectionStatus.value;
      } else {
        newState.connectionStatus = { connected: false };
      }

      if (projectStatus.status === 'fulfilled') {
        newState.projectStatus = {
          ...supabase.projectStatus,
          [projectId]: projectStatus.value,
        };
      } else {
        newState.projectStatus = {
          ...supabase.projectStatus,
          [projectId]: { connected: false },
        };
      }

      set((state) => ({ supabase: { ...state.supabase, ...newState } }));
    } catch (error) {
      console.error('Failed to fetch Supabase status:', error);
      set((state) => ({
        supabase: {
          ...state.supabase,
          isLoading: false,
          error: 'Failed to load Supabase integration status',
        },
      }));
    }
  },

  fetchSupabaseOrganizations: async () => {
    try {
      const { organizations } = await supabaseClient.getOrganizations();
      set((state) => ({
        supabase: { ...state.supabase, organizations },
      }));
    } catch (error) {
      console.error('Failed to fetch Supabase organizations:', error);
    }
  },

  invalidateSupabaseStatus: (projectId: string) => {
    // Clear cache for this project to force refetch on next access
    set((state) => {
      const nextProjectStatus = { ...state.supabase.projectStatus };
      delete nextProjectStatus[projectId];
      return {
        supabase: {
          ...state.supabase,
          lastFetched: null,
          projectStatus: nextProjectStatus,
        },
      };
    });
  },

  resetSupabase: () => {
    set({
      supabase: {
        connectionStatus: null,
        projectStatus: {},
        organizations: [],
        isLoading: false,
        error: null,
        lastFetched: null,
      },
    });
  },
}));
