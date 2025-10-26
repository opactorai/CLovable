/**
 * Messages API Route
 * GET /api/chat/[project_id]/messages - Get message history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMessagesByProjectId, createMessage, deleteMessagesByProjectId, getMessagesCountByProjectId } from '@/lib/services/message';
import type { CreateMessageInput } from '@/types/backend';
import { serializeMessages, serializeMessage } from '@/lib/serializers/chat';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

/**
 * GET /api/chat/[project_id]/messages
 * Get project message history
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { project_id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const [messages, totalCount] = await Promise.all([
      getMessagesByProjectId(project_id, limit, offset),
      getMessagesCountByProjectId(project_id),
    ]);
    const serialized = serializeMessages(messages);

    const res = NextResponse.json({
      success: true,
      data: serialized,
      totalCount,
      pagination: {
        limit,
        offset,
        count: serialized.length,
        hasMore: offset + serialized.length < totalCount,
      },
    });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (error) {
    console.error('[API] Failed to get messages:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch messages',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/[project_id]/messages
 * Create new message (for system/user logging)
 */
export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { project_id } = await params;
    const payload = await request.json();

    const content =
      typeof payload.content === 'string' ? payload.content.trim() : '';
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'content is required' },
        { status: 400 }
      );
    }

    const role = typeof payload.role === 'string' ? payload.role : 'user';
    const rawMessageType = typeof payload.message_type === 'string' ? payload.message_type.toLowerCase() : undefined;
    const messageType: CreateMessageInput['messageType'] = ((): CreateMessageInput['messageType'] => {
      switch (rawMessageType) {
        case 'chat':
        case 'tool_use':
        case 'error':
        case 'info':
          return rawMessageType;
        default:
          return role === 'system' ? 'info' : 'chat';
      }
    })();

    const conversationIdValue =
      typeof payload.conversationId === 'string'
        ? payload.conversationId
        : typeof payload.conversation_id === 'string'
        ? payload.conversation_id
        : undefined;
    const sessionIdValue =
      typeof payload.sessionId === 'string'
        ? payload.sessionId
        : typeof payload.session_id === 'string'
        ? payload.session_id
        : undefined;
    const cliSourceValue =
      typeof payload.cliSource === 'string'
        ? payload.cliSource
        : typeof payload.cli_source === 'string'
        ? payload.cli_source
        : undefined;

    const input: CreateMessageInput = {
      projectId: project_id,
      role,
      messageType,
      content,
      conversationId: conversationIdValue,
      sessionId: sessionIdValue,
      cliSource: cliSourceValue,
    };

    const message = await createMessage(input);
    const res = NextResponse.json({ success: true, data: serializeMessage(message) }, { status: 201 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (error) {
    console.error('[API] Failed to create message:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create message',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat/[project_id]/messages
 * Delete all messages (optionally filter by conversation)
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { project_id } = await params;
    const { searchParams } = new URL(request.url);
    const conversationId =
      searchParams.get('conversationId') ?? searchParams.get('conversation_id') ?? undefined;

    const deleted = await deleteMessagesByProjectId(project_id, conversationId || undefined);

    return NextResponse.json({
      success: true,
      deleted,
    });
  } catch (error) {
    console.error('[API] Failed to delete messages:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete messages',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


// Force dynamic and Node runtime to avoid caching and ensure DB freshness
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
