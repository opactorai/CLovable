/**
 * Shared Project Types
 * Used by both client and server
 */

import type { CLIType } from './cli';

/**
 * Unified Project Status
 * Consolidates frontend and backend status types
 */
export type ProjectStatus =
  | 'idle'
  | 'running'
  | 'stopped'
  | 'error'
  | 'preview_running'
  | 'building'
  | 'initializing'
  | 'active'
  | 'failed';

export type TemplateType = 'nextjs' | 'react' | 'vue' | 'custom';

/**
 * Service Connection Status
 */
export interface ServiceConnection {
  connected: boolean;
  status: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Base Project Interface
 * Contains fields common to both client and server representations
 */
export interface BaseProject {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  previewUrl?: string | null;
  previewPort?: number | null;
  initialPrompt?: string | null;
  preferredCli?: CLIType | null;
  selectedModel?: string | null;
  fallbackEnabled: boolean;
}

/**
 * Project Settings
 */
export interface ProjectSettings {
  preferredCli: CLIType;
  fallbackEnabled: boolean;
  selectedModel?: string | null;
  theme?: 'light' | 'dark' | 'system';
  autoSave?: boolean;
}
