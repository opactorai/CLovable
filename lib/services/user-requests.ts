import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';

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

export type UserRequestStatus =
  | 'pending'
  | 'processing'
  | 'active'
  | 'running'
  | 'completed'
  | 'failed';

interface UpsertUserRequestOptions {
  id: string;
  projectId: string;
  instruction: string;
  cliPreference?: string | null;
}

async function handleNotFound(error: unknown, context: string): Promise<void> {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[UserRequests] ${context}: record not found`);
    }
    return;
  }

  throw error;
}

/**
 * Create or update a user request record.
 * Uses the client-provided requestId as the primary key.
 */
export async function upsertUserRequest({
  id,
  projectId,
  instruction,
  cliPreference,
}: UpsertUserRequestOptions) {
  return prisma.userRequest.upsert({
    where: { id },
    create: {
      id,
      projectId,
      instruction,
      status: 'pending',
      ...(cliPreference !== undefined ? { cliPreference } : {}),
    },
    update: {
      instruction,
      ...(cliPreference !== undefined ? { cliPreference } : {}),
    },
  });
}

async function updateStatus(
  id: string,
  status: UserRequestStatus,
  options: { errorMessage?: string | null; setCompletionTimestamp?: boolean } = {}
) {
  try {
    const data: Prisma.UserRequestUpdateInput = {
      status,
    };

    if (options.setCompletionTimestamp ?? (status === 'completed' || status === 'failed')) {
      data.completedAt = new Date();
    } else if (status === 'pending' || status === 'processing' || status === 'running' || status === 'active') {
      data.completedAt = null;
    }

    if ('errorMessage' in options) {
      data.errorMessage = options.errorMessage ?? null;
    } else if (status !== 'failed') {
      data.errorMessage = null;
    }

    await prisma.userRequest.update({
      where: { id },
      data,
    });
  } catch (error) {
    await handleNotFound(error, `update status to ${status}`);
  }
}

export async function markUserRequestAsRunning(id: string): Promise<void> {
  await updateStatus(id, 'running');
}

export async function markUserRequestAsProcessing(id: string): Promise<void> {
  await updateStatus(id, 'processing');
}

export async function markUserRequestAsCompleted(id: string): Promise<void> {
  await updateStatus(id, 'completed', {
    errorMessage: null,
    setCompletionTimestamp: true,
  });
}

export async function markUserRequestAsFailed(
  id: string,
  errorMessage?: string,
): Promise<void> {
  await updateStatus(id, 'failed', {
    errorMessage: errorMessage ?? 'Request failed',
    setCompletionTimestamp: true,
  });
}
