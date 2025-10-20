/**
 * Message Service - Message processing logic
 */

import { prisma } from '@/lib/db/client';
import type { Message, CreateMessageInput } from '@/backend-types';
import type { Message as PrismaMessage } from '@prisma/client';

function mapPrismaMessage(message: PrismaMessage): Message {
  return {
    id: message.id,
    projectId: message.projectId,
    conversationId: message.conversationId ?? null,
    sessionId: message.sessionId ?? null,
    role: message.role as Message['role'],
    content: message.content,
    messageType: message.messageType as Message['messageType'],
    metadataJson: message.metadataJson ?? null,
    parentMessageId: message.parentMessageId ?? null,
    cliSource: message.cliSource ?? null,
    createdAt: message.createdAt,
    updatedAt: message.createdAt,
    requestId: (message as unknown as { requestId?: string | null })?.requestId ?? null,
  };
}

/**
 * Retrieve project messages (with pagination)
 */
export async function getMessagesByProjectId(
  projectId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Message[]> {
  const messages = await prisma.message.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    skip: offset,
    take: limit,
  });

  return messages.map(mapPrismaMessage);
}

/**
 * Create new message
 */
export async function createMessage(input: CreateMessageInput): Promise<Message> {
  const metadataJson = input.metadata ? JSON.stringify(input.metadata) : undefined;

  const message = await prisma.message.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      projectId: input.projectId,
      role: input.role,
      messageType: input.messageType,
      content: input.content,
      metadataJson,
      sessionId: input.sessionId,
      conversationId: input.conversationId,
      cliSource: input.cliSource,
    },
  });

  console.log(`[MessageService] Created message: ${message.id} (${input.role})`);
  return mapPrismaMessage(message);
}

/**
 * Delete all project messages
 */
export async function deleteMessagesByProjectId(projectId: string, conversationId?: string): Promise<number> {
  const result = await prisma.message.deleteMany({
    where: {
      projectId,
      ...(conversationId ? { conversationId } : {}),
    },
  });
  const scopeLabel = conversationId ? ` (conversation ${conversationId})` : '';
  console.log(`[MessageService] Deleted ${result.count} messages for project: ${projectId}${scopeLabel}`);
  return result.count;
}
