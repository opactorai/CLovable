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
