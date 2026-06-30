/**
 * Centralized, validated environment configuration.
 *
 * Loaded once at process start. Any missing/invalid required variable
 * fails fast with a readable error rather than surfacing deep in a request.
 */
import 'dotenv/config';
import { z } from 'zod';

const booleanish = z
  .string()
  .optional()
  .transform((v) => v === '1' || v?.toLowerCase() === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),

  // --- Supabase ---
  SUPABASE_URL: z.string().url(),
  // service-role key: server only, full DB access. NEVER expose to the browser.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // anon key: only used to verify user JWTs / build user-scoped clients.
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().default('project-artifacts'),

  // --- Claude Code credential ---
  // BYOK model: each user supplies their own Anthropic API key (stored
  // encrypted, injected per workspace). These optional operator-level values
  // act only as a fallback when a user has not set their own key.
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_CODE_OAUTH_TOKEN: z.string().optional(),
  CLAUDE_DEFAULT_MODEL: z.string().default('claude-sonnet-4-6'),

  // 32-byte key (64 hex chars) for AES-256-GCM encryption of stored user secrets.
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes)'),

  // --- Workspace containers ---
  WORKSPACE_IMAGE: z.string().default('claudable-workspace:latest'),
  // Max concurrent running containers before new work is queued.
  MAX_CONCURRENT_WORKSPACES: z.coerce.number().int().positive().default(10),
  // Idle TTL (ms) after which a container is archived + stopped by the reaper.
  WORKSPACE_IDLE_TTL_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  WORKSPACE_REAPER_INTERVAL_MS: z.coerce.number().int().positive().default(60 * 1000),
  // Per-container resource caps.
  WORKSPACE_CPU_LIMIT: z.coerce.number().positive().default(1),
  WORKSPACE_MEMORY_LIMIT_MB: z.coerce.number().int().positive().default(2048),
  // Hard cap on a single Claude Code execution (ms).
  EXECUTION_TIMEOUT_MS: z.coerce.number().int().positive().default(20 * 60 * 1000),

  // Host-side root for project workspaces that are bind-mounted into containers.
  WORKSPACES_ROOT: z.string().default('/var/lib/claudable/workspaces'),

  // Execution backend: 'docker' = one container per project (needs host Docker
  // daemon); 'process' = Claude Code as a subprocess in this container (works on
  // PaaS like Railway/Render that don't expose the Docker socket).
  WORKSPACE_MODE: z.enum(['docker', 'process']).default('docker'),
  // When WORKSPACE_MODE=process and this server runs as root, Claude Code child
  // processes are dropped to this uid/gid (Claude Code refuses
  // --dangerously-skip-permissions as root). HOME must be writable by that uid.
  WORKSPACE_RUN_UID: z.coerce.number().int().nonnegative().default(1000),
  WORKSPACE_RUN_GID: z.coerce.number().int().nonnegative().default(1000),
  WORKSPACE_RUN_HOME: z.string().default('/home/coder'),

  // --- CORS / frontend ---
  FRONTEND_ORIGIN: z.string().default('*'),

  // --- Feature flags ---
  ENABLE_GOOGLE_OAUTH: booleanish,
  // Disable Docker (useful for local dev / CI where no daemon is present).
  DISABLE_DOCKER: booleanish,
});

export type AppEnv = z.infer<typeof schema>;

/**
 * Operator-level fallback credential, used only when a user hasn't supplied
 * their own key (BYOK). Empty object = no fallback configured.
 */
export function operatorCredentialEnv(): Record<string, string> {
  if (env.CLAUDE_CODE_OAUTH_TOKEN) return { CLAUDE_CODE_OAUTH_TOKEN: env.CLAUDE_CODE_OAUTH_TOKEN };
  if (env.ANTHROPIC_API_KEY) return { ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY };
  return {};
}

function loadEnv(): AppEnv {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(`\n❌ Invalid environment configuration:\n${issues}\n`);
    process.exit(1);
  }
  return parsed.data;
}

export const env: AppEnv = loadEnv();

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
