import { apiClient } from './api-client';
import { clientLogger } from './client-logger';

interface ResumeOptions {
  timeout?: number; // milliseconds
  pollingInterval?: number; // milliseconds
}

interface ResumeResult {
  success: boolean;
  message?: string;
  urls?: {
    devServer?: string;
    preview?: string;
    codeServer?: string;
  };
}

/**
 * Poll for project status
 */
async function pollForStatus(
  projectId: string,
  timeout: number,
  interval: number
): Promise<ResumeResult> {
  const startTime = Date.now();
  const maxAttempts = Math.ceil(timeout / interval);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    // Check if we've exceeded timeout
    if (Date.now() - startTime > timeout) {
      throw new Error('Workspace activation timeout (polling)');
    }

    try {
      const project = await apiClient.request<any>(`/api/projects/${projectId}`);

      clientLogger.info(`[Resume] Polling status (${attempt + 1}/${maxAttempts}): ${project.status}`);

      if (project.status === 'active') {
        return {
          success: true,
          message: 'Workspace activated successfully',
          urls: {
            devServer: project.devServerUrl,
            preview: project.previewUrl,
            codeServer: project.codeServerUrl,
          },
        };
      }

      if (project.status === 'failed') {
        throw new Error('Workspace failed to start');
      }

      // Continue polling for 'creating', 'starting', 'stopped', 'archived'
    } catch (error) {
      // On last attempt, throw the error
      if (attempt === maxAttempts - 1) {
        throw error;
      }
      // Otherwise, continue polling
      clientLogger.warn(`[Resume] Polling attempt ${attempt + 1} failed:`, error);
    }
  }

  throw new Error('Workspace activation timeout');
}

/**
 * Resume a sandbox and wait for it to become active
 * Uses polling to check status
 * Note: WebSocket events are handled by the main page subscription
 */
export async function resumeSandboxAndWait(
  projectId: string,
  options: ResumeOptions = {}
): Promise<ResumeResult> {
  const {
    timeout = 60000, // 60 seconds
    pollingInterval = 2000, // 2 seconds
  } = options;

  clientLogger.info(`[Resume] Starting sandbox resume for project ${projectId}`);

  try {
    // Trigger sandbox start
    clientLogger.info('[Resume] Triggering sandbox start');
    await apiClient.request(`/api/projects/${projectId}/sandbox/start`, {
      method: 'POST',
    });

    // Poll for status (main page subscription handles WebSocket events)
    const result = await pollForStatus(projectId, timeout, pollingInterval);

    clientLogger.info('[Resume] Sandbox activated successfully', result);
    return result;
  } catch (error) {
    clientLogger.error('[Resume] Failed to resume sandbox:', error);
    throw error;
  }
}

/**
 * Check if a project needs to be resumed before opening
 */
export function needsResume(projectStatus: string | null | undefined): boolean {
  if (!projectStatus) return false;

  return projectStatus === 'stopped' ||
         projectStatus === 'archived' ||
         projectStatus === 'creating' ||
         projectStatus === 'starting';
}
