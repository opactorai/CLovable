/**
 * Path utility functions for displaying file paths in the UI
 */

/**
 * Converts an absolute file path to a project-relative path
 * Removes the system path prefix and shows only the path relative to the project root
 *
 * @param absolutePath - The absolute file path (e.g., /Users/jjh/Downloads/Claudable-v2/src/app/page.tsx)
 * @returns The relative path from project root (e.g., /src/app/page.tsx)
 *
 * @example
 * toRelativePath('/Users/jjh/Downloads/Claudable-v2/src/app/page.tsx')
 * // Returns: '/src/app/page.tsx'
 */
export function toRelativePath(absolutePath: string): string {
  if (!absolutePath) return absolutePath;

  // If the string looks like plain text (contains whitespace), return as-is
  if (/\s/.test(absolutePath)) {
    return absolutePath;
  }

  // Check if this is an absolute path
  const isAbsolutePath =
    absolutePath.startsWith('/') ||
    absolutePath.startsWith('\\') ||
    /^[A-Za-z]:[\\\/]/.test(absolutePath); // Windows path like C:\

  if (!isAbsolutePath) {
    // Handle relative paths - check for user project directory pattern
    // Pattern: data/projects/project-{id}/...
    const userProjectPattern = /^data\/projects\/project-[^\/]+\/(.*)/;
    const match = absolutePath.match(userProjectPattern);
    if (match && match[1]) {
      // Extract the path after the project directory
      return `/${match[1]}`;
    }

    // Other relative paths: just add leading slash
    return absolutePath.startsWith('/') ? absolutePath : `/${absolutePath}`;
  }

  // Get the project root from environment variable (injected by next.config.js)
  const projectRoot = process.env.NEXT_PUBLIC_PROJECT_ROOT;

  if (projectRoot) {
    // Normalize both paths to use forward slashes for comparison
    const normalizedPath = absolutePath.replace(/\\/g, '/');
    const normalizedRoot = projectRoot.replace(/\\/g, '/');

    if (normalizedPath.startsWith(normalizedRoot)) {
      // Remove the project root and return with leading slash
      let relativePath = normalizedPath.substring(normalizedRoot.length);

      // Check if this is a user project path
      const userProjectPattern = /^\/data\/projects\/project-[^\/]+\/(.*)/;
      const projectMatch = relativePath.match(userProjectPattern);
      if (projectMatch && projectMatch[1]) {
        return `/${projectMatch[1]}`;
      }

      return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    }
  }

  // Fallback: Try to find common project directory patterns
  const projectPatterns = [
    '/Claudable-v2/',
    '\\Claudable-v2\\',
  ];

  for (const pattern of projectPatterns) {
    const index = absolutePath.indexOf(pattern);
    if (index !== -1) {
      let relativePath = absolutePath.substring(index + pattern.length - 1);

      // Check if this is a user project path
      const userProjectPattern = /^\/data\/projects\/project-[^\/]+\/(.*)/;
      const projectMatch = relativePath.match(userProjectPattern);
      if (projectMatch && projectMatch[1]) {
        return `/${projectMatch[1]}`;
      }

      return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    }
  }

  // Last resort: Return just the last few segments of the path
  // This handles paths like /Users/jjh/package.json -> /package.json
  const parts = absolutePath.split(/[/\\]/);
  if (parts.length > 0) {
    // Return the filename with a leading slash
    return `/${parts[parts.length - 1]}`;
  }

  return absolutePath;
}

/**
 * Extracts the filename from a file path
 *
 * @param path - The file path
 * @returns The filename (last segment of the path)
 *
 * @example
 * getFileName('src/app/page.tsx')
 * // Returns: 'page.tsx'
 */
export function getFileName(path: string): string {
  if (!path) return path;
  const parts = path.split(/[/\\]/); // Handle both / and \ separators
  return parts[parts.length - 1] || path;
}

/**
 * Extracts the directory path (without the filename)
 *
 * @param path - The file path
 * @returns The directory path
 *
 * @example
 * getDirectoryPath('src/app/page.tsx')
 * // Returns: 'src/app'
 */
export function getDirectoryPath(path: string): string {
  if (!path) return path;
  const parts = path.split(/[/\\]/); // Handle both / and \ separators
  parts.pop(); // Remove the filename
  return parts.join('/') || '/';
}
