/**
 * Utility functions for Claudable
 */

/**
 * Format date to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} days ago`;
  if (hours > 0) return `${hours} hours ago`;
  if (minutes > 0) return `${minutes} minutes ago`;
  return `just now`;
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Generate a unique project ID
 */
export function generateProjectId(): string {
  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Validate project name
 */
export function validateProjectName(name: string): boolean {
  // Allow alphanumeric, hyphens, underscores, spaces
  // Min length: 1, Max length: 50
  const regex = /^[a-zA-Z0-9-_ ]{1,50}$/;
  return regex.test(name);
}

/**
 * Sleep utility (async delay)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if string is valid JSON
 */
export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}
