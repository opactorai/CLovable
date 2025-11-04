/**
 * Modal-specific Types for Client
 */

export interface CreateProjectCLIOption {
  id: string;
  name: string;
  icon: string;
  description: string;
  models: Array<{
    id: string;
    name: string;
    description?: string;
    supportsImages?: boolean;
  }>;
  color: string;
  features: string[];
  downloadUrl?: string;
  installCommand?: string;
  enabled?: boolean;
}

export interface CLIConfig {
  enabled?: boolean;
  model?: string;
}

export interface GlobalSettings {
  apiKeys?: {
    anthropic?: string;
    github?: string;
    vercel?: string;
    supabase?: string;
  };
  preferences?: {
    theme?: 'light' | 'dark' | 'system';
    autoSave?: boolean;
  };
  cli_settings?: {
    [cliId: string]: CLIConfig;
  };
  default_cli?: string;
  fallback_enabled?: boolean;
}
