/**
 * Typed REST client for the Claudable Cloud orchestration backend.
 * Every request carries the Supabase access token as a Bearer credential.
 */
import { getAccessToken } from './supabase-client';

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

export interface CloudProject {
  id: string;
  user_id: string;
  project_name: string;
  description: string | null;
  status: string;
  workspace_path: string | null;
  claude_session_id: string | null;
  selected_model: string | null;
  latest_artifact_path: string | null;
  created_at: string;
  updated_at: string;
  last_active_at: string;
}

export interface CloudMessage {
  id: string;
  project_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  message: string;
  metadata: Record<string, unknown> | null;
  request_id: string | null;
  created_at: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  children?: FileNode[];
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text().catch(() => res.statusText);
    }
    const message =
      (detail as { error?: { message?: string } })?.error?.message ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const cloudApi = {
  listProjects: () => request<{ projects: CloudProject[] }>('/api/projects'),

  createProject: (input: { projectName: string; description?: string; initialPrompt?: string }) =>
    request<{ project: CloudProject }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getProject: (id: string) => request<{ project: CloudProject }>(`/api/projects/${id}`),

  deleteProject: (id: string) =>
    request<{ ok: true }>(`/api/projects/${id}`, { method: 'DELETE' }),

  act: (id: string, input: { instruction: string; isInitialPrompt?: boolean; selectedModel?: string }) =>
    request<{ ok: true; requestId: string; userMessageId: string }>(`/api/projects/${id}/act`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listMessages: (id: string) => request<{ messages: CloudMessage[] }>(`/api/projects/${id}/messages`),

  listFiles: (id: string) => request<{ files: FileNode[] }>(`/api/projects/${id}/files`),

  readFile: (id: string, path: string) =>
    request<{ path: string; content: string }>(
      `/api/projects/${id}/files/content?path=${encodeURIComponent(path)}`,
    ),

  stop: (id: string) => request<{ ok: true }>(`/api/projects/${id}/stop`, { method: 'POST' }),

  getDownloadUrl: (id: string) => request<{ url: string }>(`/api/projects/${id}/download`),

  // --- BYOK Anthropic API key (write-only; never returned) ---
  getKeyStatus: () => request<{ configured: boolean }>('/api/settings/anthropic-key'),

  setKey: (apiKey: string) =>
    request<{ ok: true; configured: true; masked: string }>('/api/settings/anthropic-key', {
      method: 'PUT',
      body: JSON.stringify({ apiKey }),
    }),

  deleteKey: () =>
    request<{ ok: true; configured: false }>('/api/settings/anthropic-key', { method: 'DELETE' }),
};
