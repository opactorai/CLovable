/**
 * Message Service - Message processing logic
 */

import { prisma } from '@/lib/db/client';
import type { Message, CreateMessageInput } from '@/types/backend';
import type { Message as PrismaMessage } from '@prisma/client';

function mapPrismaMessage(message: PrismaMessage): Message {
  const updatedAt =
    (message as unknown as { updatedAt?: Date }).updatedAt ?? message.createdAt;

  // Access requestId directly from message (Prisma Client should include it after regeneration)
  const requestId = (message as any).requestId ?? null;

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
    updatedAt,
    requestId,
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
      requestId: input.requestId,
    },
  });

  console.log(`[MessageService] Created message: ${message.id} (${input.role})${input.requestId ? ` [requestId: ${input.requestId}]` : ''}`);
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
