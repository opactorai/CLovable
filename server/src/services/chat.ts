/**
 * Chat history persistence (chat_sessions table).
 */
import { admin } from '../lib/supabase';
import { httpErrors } from '../lib/errors';
import type { ChatRole, ChatSessionRow } from '../types/db';

const TABLE = 'chat_sessions';

export async function appendMessage(input: {
  projectId: string;
  role: ChatRole;
  message: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
}): Promise<ChatSessionRow> {
  const { data, error } = await admin
    .from(TABLE)
    .insert({
      project_id: input.projectId,
      role: input.role,
      message: input.message,
      metadata: input.metadata ?? null,
      request_id: input.requestId ?? null,
    })
    .select('*')
    .single();
  if (error || !data) {
    throw httpErrors.internal(`Failed to append message: ${error?.message}`);
  }
  return data as ChatSessionRow;
}

export async function listMessages(
  projectId: string,
  opts: { limit?: number } = {},
): Promise<ChatSessionRow[]> {
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(opts.limit ?? 1000);
  if (error) {
    throw httpErrors.internal(`Failed to list messages: ${error.message}`);
  }
  return (data ?? []) as ChatSessionRow[];
}
