/**
 * Hand-maintained row types mirroring supabase/migrations.
 * Keep in sync with the SQL; in CI you can regenerate with
 * `supabase gen types typescript` and diff against this file.
 */

export type ProjectStatus =
  | 'idle'
  | 'provisioning'
  | 'running'
  | 'executing'
  | 'stopped'
  | 'error';

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

export interface ProjectRow {
  id: string;
  user_id: string;
  project_name: string;
  description: string | null;
  status: ProjectStatus;
  workspace_path: string | null;
  container_id: string | null;
  claude_session_id: string | null;
  selected_model: string | null;
  initial_prompt: string | null;
  latest_artifact_path: string | null;
  created_at: string;
  updated_at: string;
  last_active_at: string;
}

export interface ChatSessionRow {
  id: string;
  project_id: string;
  role: ChatRole;
  message: string;
  metadata: Record<string, unknown> | null;
  request_id: string | null;
  created_at: string;
}

export interface ProjectFileRow {
  id: string;
  project_id: string;
  filename: string;
  language: string | null;
  storage_path: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
}
