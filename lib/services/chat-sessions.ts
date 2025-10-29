import { prisma } from '@/lib/db/client';

export async function getActiveSession(projectId: string) {
  const session = await prisma.session.findFirst({
    where: {
      projectId,
      status: { in: ['active', 'running'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  return session;
}

export async function getSessionById(projectId: string, sessionId: string) {
  return prisma.session.findFirst({
    where: {
      projectId,
      id: sessionId,
    },
  });
}
