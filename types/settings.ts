export type MCPTransport = 'stdio' | 'sse' | 'websocket';

export interface MCPServerConfig {
  /** Unique identifier for the MCP server (used as key when wiring into CLI configs). */
  id: string;
  /** Optional human-friendly label. */
  label?: string;
  /** Longer description or notes about how this server is used. */
  description?: string;
  /** Transport used to communicate with the MCP server. Defaults to stdio if omitted. */
  transport?: MCPTransport;
  /**
   * Command to launch the MCP server when using stdio transport.
   * When omitted, the CLI is expected to resolve the binary on its own.
   */
  command?: string;
  /** Arguments to pass to the command. */
  args?: string[];
  /** Optional working directory for the process. */
  cwd?: string;
  /** Environment variables injected when spawning the MCP server process. */
  env?: Record<string, string>;
  /**
   * Remote endpoint when using SSE / WebSocket transports.
   * Expected to be an absolute URL.
   */
  url?: string;
  /** Additional headers for remote transports. */
  headers?: Record<string, string>;
  /** Whether this server should be started automatically. */
  autoStart?: boolean;
  /** Allows temporarily disabling a server without deleting it. */
  enabled?: boolean;
  /** Miscellaneous metadata for future extensions. */
  metadata?: Record<string, unknown>;
}

export interface CLISettingsEntry {
  model?: string;
  apiKey?: string;
  mcpServers?: MCPServerConfig[];
  [key: string]: unknown;
}

export interface GlobalSettingsState {
  default_cli: string;
  cli_settings: Record<string, CLISettingsEntry>;
}
