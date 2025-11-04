/**
 * Server-side Project Types
 */

import type { BaseProject, TemplateType } from '../shared/project';

/**
 * Server Project (with database fields)
 */
export interface ServerProject extends BaseProject {
  repoPath?: string | null;
  templateType?: TemplateType;
  activeClaudeSessionId?: string | null;
  activeCursorSessionId?: string | null;
  settings?: string; // JSON string
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
}

/**
 * Create Project Input
 */
export interface CreateProjectInput {
  project_id: string;
  name: string;
  initialPrompt: string;
  preferredCli?: string;
  selectedModel?: string;
  description?: string;
}

/**
 * Update Project Input
 */
export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: string;
  previewUrl?: string | null;
  previewPort?: number | null;
  preferredCli?: string;
  selectedModel?: string;
  settings?: string;
  activeClaudeSessionId?: string;
  activeCursorSessionId?: string;
  repoPath?: string | null;
}
