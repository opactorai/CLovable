/**
 * Application-wide constants
 * Centralized configuration values
 */

// Preview Server Configuration
export const PREVIEW_CONFIG = {
  LOG_LIMIT: 400,
  FALLBACK_PORT_START: 3_100,
  FALLBACK_PORT_END: 3_999,
  DEFAULT_PORT: 3000,
  STARTUP_TIMEOUT: 30000, // 30 seconds
  HEALTH_CHECK_INTERVAL: 2000, // 2 seconds
} as const;

// WebSocket Configuration
export const WEBSOCKET_CONFIG = {
  MAX_RECONNECT_ATTEMPTS: 10,
  BASE_RECONNECT_DELAY: 1000, // 1 second
  MAX_RECONNECT_DELAY: 30000, // 30 seconds
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  CONNECTION_TIMEOUT: 10000, // 10 seconds
} as const;

// Stream Manager Configuration
export const STREAM_CONFIG = {
  INACTIVE_CONNECTION_TIMEOUT: 3600000, // 1 hour
  CLEANUP_INTERVAL: 300000, // 5 minutes
  MAX_CONNECTIONS: 100,
} as const;

// API Timeout Configuration
export const API_TIMEOUTS = {
  DEFAULT: 30000, // 30 seconds
  LONG_RUNNING: 300000, // 5 minutes (for deploy, git push, etc.)
  FILE_UPLOAD: 60000, // 1 minute
  PREVIEW_START: 60000, // 1 minute
} as const;

// File Browser Configuration
export const FILE_BROWSER_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
  ALLOWED_EXTENSIONS: [
    '.js', '.ts', '.jsx', '.tsx',
    '.css', '.scss', '.sass',
    '.html', '.json', '.md',
    '.py', '.java', '.go', '.rs',
    '.txt', '.yml', '.yaml',
  ],
  IGNORED_DIRECTORIES: [
    'node_modules',
    '.next',
    '.git',
    'dist',
    'build',
    'coverage',
  ],
} as const;

// Database Configuration
export const DB_CONFIG = {
  CONNECTION_POOL_SIZE: 10,
  QUERY_TIMEOUT: 30000, // 30 seconds
} as const;
