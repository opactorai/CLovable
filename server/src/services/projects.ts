/**
 * Project data access. Uses the service-role client, so EVERY function that
 * takes a userId enforces ownership explicitly — RLS does not apply here.
 */
import { admin } from '../lib/supabase';
import { httpErrors } from '../lib/errors';
import type { ProjectRow, ProjectStatus } from '../types/db';

const TABLE = 'projects';

export async function createProject(input: {
  userId: string;
  projectName: string;
  description?: string;
  initialPrompt?: string;
  selectedModel?: string;
}): Promise<ProjectRow> {
  const { data, error } = await admin
    .from(TABLE)
    .insert({
      user_id: input.userId,
      project_name: input.projectName,
      description: input.description ?? null,
      initial_prompt: input.initialPrompt ?? null,
      selected_model: input.selectedModel ?? null,
      status: 'idle' satisfies ProjectStatus,
    })
    .select('*')
    .single();
  if (error || !data) {
    throw httpErrors.internal(`Failed to create project: ${error?.message}`);
  }
  return data as ProjectRow;
}

export async function listProjects(userId: string): Promise<ProjectRow[]> {
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('last_active_at', { ascending: false });
  if (error) {
    throw httpErrors.internal(`Failed to list projects: ${error.message}`);
  }
  return (data ?? []) as ProjectRow[];
}

/** Fetch a project, returning null if it does not exist. Does NOT check ownership. */
export async function getProject(projectId: string): Promise<ProjectRow | null> {
  const { data, error } = await admin.from(TABLE).select('*').eq('id', projectId).maybeSingle();
  if (error) {
    throw httpErrors.internal(`Failed to fetch project: ${error.message}`);
  }
  return (data as ProjectRow) ?? null;
}

/** Fetch a project and assert the given user owns it, else 404/403. */
export async function getOwnedProject(projectId: string, userId: string): Promise<ProjectRow> {
  const project = await getProject(projectId);
  if (!project) {
    throw httpErrors.notFound('Project not found');
  }
  if (project.user_id !== userId) {
    // 404 (not 403) to avoid leaking existence of other users' projects.
    throw httpErrors.notFound('Project not found');
  }
  return project;
}

export async function updateProject(
  projectId: string,
  patch: Partial<
    Pick<
      ProjectRow,
      | 'status'
      | 'workspace_path'
      | 'container_id'
      | 'claude_session_id'
      | 'selected_model'
      | 'latest_artifact_path'
      | 'project_name'
      | 'description'
      | 'last_active_at'
    >
  >,
): Promise<void> {
  const { error } = await admin.from(TABLE).update(patch).eq('id', projectId);
  if (error) {
    throw httpErrors.internal(`Failed to update project: ${error.message}`);
  }
}

export async function setProjectStatus(projectId: string, status: ProjectStatus): Promise<void> {
  await updateProject(projectId, { status });
}

export async function touchProject(projectId: string): Promise<void> {
  await updateProject(projectId, { last_active_at: new Date().toISOString() });
}

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await admin.from(TABLE).delete().eq('id', projectId);
  if (error) {
    throw httpErrors.internal(`Failed to delete project: ${error.message}`);
  }
}
