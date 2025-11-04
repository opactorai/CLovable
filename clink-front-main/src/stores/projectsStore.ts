import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';
import { ProjectSummary } from '@/types/project';

interface ProjectsState {
  projects: ProjectSummary[];
  isLoading: boolean;
  error: string | null;
  isFetched: boolean;
  fetchProjects: () => Promise<void>;
  refetch: () => Promise<void>;
  addProject: (project: ProjectSummary) => void;
  removeProject: (projectId: string) => void;
  updateProject: (projectId: string, updates: Partial<ProjectSummary>) => void;
  reset: () => void;
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  isLoading: false,
  error: null,
  isFetched: false,

  fetchProjects: async () => {
    // 이미 가져왔으면 스킵
    if (get().isFetched) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const data = await apiClient.getProjects();

      if (!Array.isArray(data)) {
        throw new Error('Unexpected response format');
      }

      const normalized = data
        .map((project: any) => {
          const rawLastModified =
            project?.lastModified ?? project?.updatedAt ?? project?.createdAt;
          const lastModified =
            typeof rawLastModified === 'string'
              ? rawLastModified
              : rawLastModified instanceof Date
                ? rawLastModified.toISOString()
                : rawLastModified
                  ? new Date(rawLastModified).toISOString()
                  : null;

          return {
            id: project?.id ?? '',
            name: project?.name ?? 'Untitled Project',
            lastModified,
            description: project?.description ?? null,
            cli: project?.cli ?? null,
            model: project?.model ?? null,
          } as ProjectSummary;
        })
        .filter((project: ProjectSummary) => Boolean(project.id))
        .sort((a: ProjectSummary, b: ProjectSummary) => {
          const aTime = a.lastModified
            ? new Date(a.lastModified).getTime()
            : 0;
          const bTime = b.lastModified
            ? new Date(b.lastModified).getTime()
            : 0;
          return bTime - aTime;
        });

      set({ projects: normalized, isLoading: false, isFetched: true });
    } catch (error) {
      console.error('Failed to load projects:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load projects',
        isLoading: false,
        isFetched: true,
      });
    }
  },

  refetch: async () => {
    set({ isFetched: false });
    await get().fetchProjects();
  },

  // Optimistic updates for instant UI feedback
  addProject: (project: ProjectSummary) => {
    set((state) => ({
      projects: [project, ...state.projects].sort((a, b) => {
        const aTime = a.lastModified ? new Date(a.lastModified).getTime() : 0;
        const bTime = b.lastModified ? new Date(b.lastModified).getTime() : 0;
        return bTime - aTime;
      }),
    }));
  },

  removeProject: (projectId: string) => {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== projectId),
    }));
  },

  updateProject: (projectId: string, updates: Partial<ProjectSummary>) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, ...updates } : p
      ),
    }));
  },

  reset: () => {
    set({
      projects: [],
      isLoading: false,
      error: null,
      isFetched: false,
    });
  },
}));
