import { prisma } from '@/lib/db/client';

export interface ActiveRequestSummary {
  hasActiveRequests: boolean;
  activeCount: number;
}

export async function getActiveRequests(projectId: string): Promise<ActiveRequestSummary> {
  const count = await prisma.userRequest.count({
    where: {
      projectId,
      status: {
        in: ['pending', 'processing', 'active', 'running'],
      },
    },
  });

  return {
    hasActiveRequests: count > 0,
    activeCount: count,
  };
}
