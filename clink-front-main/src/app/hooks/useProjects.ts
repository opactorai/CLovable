import { useEffect } from 'react';
import { useProjectsStore } from '@/stores/projectsStore';

export const useProjects = (isAuthenticated: boolean) => {
  const { projects, isLoading, error, fetchProjects, refetch, reset } =
    useProjectsStore();

  useEffect(() => {
    if (!isAuthenticated) {
      reset();
      return;
    }

    // 로그인되어 있으면 즉시 프로젝트 목록 가져오기 (캐시된 경우 스킵)
    fetchProjects();
  }, [isAuthenticated, fetchProjects, reset]);

  return {
    projectsLoading: isLoading,
    projectsError: error,
    projects,
    refetch, // 필요시 수동으로 다시 불러오기
  };
};
