/**
 * Shared CLI Types
 */

export type CLIType = 'claude' | 'cursor';

export type CLIStatus = 'available' | 'unavailable' | 'checking';

export interface CLIOption {
  value: CLIType;
  label: string;
  available: boolean;
}

export interface CLIPreference {
  type: CLIType;
  enabled: boolean;
}
