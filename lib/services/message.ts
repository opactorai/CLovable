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
  const metadataLength = metadataJson ? metadataJson.length : 0;
  const metadataPreview =
    metadataJson && metadataJson.length > 0
      ? `${metadataJson.substring(0, 500)}${metadataJson.length > 500 ? '...' : ''}`
      : '';
  let lastError: Error | null = null;

  console.log('[MessageService] Creating message with metadata:', {
    messageId: input.id,
    projectId: input.projectId,
    role: input.role,
    hasMetadata: !!input.metadata,
    metadataKeys: input.metadata ? Object.keys(input.metadata) : [],
    metadataJsonLength: metadataLength,
    metadataJson: metadataPreview,
  });

  // Retry logic with exponential backoff for database operations
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
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

      console.log(`[MessageService] Created message: ${message.id} (${input.role})${input.requestId ? ` [requestId: ${input.requestId}]` : ''} on attempt ${attempt}`);
      console.log('[MessageService] Stored metadataJson length:', metadataLength);

      const mappedMessage = mapPrismaMessage(message);
      const mappedMetadataLength = mappedMessage.metadataJson ? mappedMessage.metadataJson.length : 0;
      const mappedMetadataPreview =
        mappedMessage.metadataJson && mappedMetadataLength > 0
          ? `${mappedMessage.metadataJson.substring(0, 200)}${mappedMetadataLength > 200 ? '...' : ''}`
          : '';
      console.log('[MessageService] Mapped message metadata:', {
        hasMetadataJson: mappedMetadataLength > 0,
        metadataJsonLength: mappedMetadataLength,
        metadataJsonPreview: mappedMetadataPreview,
      });

      return mappedMessage;
    } catch (error) {
      lastError = error as Error;
      console.error(`[MessageService] Attempt ${attempt} failed to create message:`, error);

      if (attempt < 3) {
        // Exponential backoff: 200ms, 400ms
        const delayMs = Math.pow(2, attempt) * 100;
        console.log(`[MessageService] Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries failed
  console.error('[MessageService] All retry attempts failed to create message:', lastError);
  throw lastError || new Error('Failed to create message after 3 attempts');
}

/**
 * Get total count of messages for a project
 */
export async function getMessagesCountByProjectId(projectId: string): Promise<number> {
  const count = await prisma.message.count({
    where: { projectId },
  });

  return count;
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
