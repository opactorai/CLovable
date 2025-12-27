---
paths: lib/services/**/*.ts
---

# Services Layer Development Rules

## Overview
Services in `/lib/services` handle business logic, database operations, and external integrations. They're called from API routes or other services.

## Service Organization

### CLI Services (`lib/services/cli/`)
Each CLI has a dedicated service module:
- `claude.ts` - Claude Agent SDK integration (primary)
- `cursor.ts` - Cursor CLI integration
- `codex.ts` - OpenAI Codex integration
- `qwen.ts` - Qwen Code integration
- `glm.ts` - Z.AI GLM integration

**Pattern**: Each CLI service exports main execution functions that:
1. Connect to the CLI process
2. Handle streaming/non-streaming responses
3. Record messages and tool usage
4. Update project status

### Core Services
- **project.ts** - Project CRUD, status updates, schema
- **message.ts** - Chat message creation and retrieval
- **chat-sessions.ts** - Session lifecycle management
- **file-browser.ts** - Repository file operations (read, list, tree)
- **preview.ts** - Live preview server management
- **env.ts** - Environment variable encryption/decryption
- **tokens.ts** - Secure token storage and retrieval
- **stream.ts** - Streaming responses and WebSocket broadcasts
- **websocket-manager.ts** - WebSocket connection management
- **user-requests.ts** - User request queue and tracking

### Integration Services
- **github.ts** - GitHub API operations
- **vercel.ts** - Vercel deployment
- **supabase.ts** - Supabase database setup
- **service-integration.ts** - Orchestrates multi-service workflows

## Error Handling
- Throw descriptive errors with context
- Include error messages that help debugging
- Services should not handle HTTP responses (leave that to API routes)
- Catch and re-throw with additional context as needed

## Database Access
- Use Prisma client: `import { prisma } from '@/lib/db/client'`
- Use parameterized queries (Prisma handles this)
- Handle unique constraint violations
- Use transactions for multi-step operations

## Async/Await Patterns
- All database operations are async
- All CLI invocations are async and may emit streams
- Use proper error handling with try-catch
- Don't swallow errors; let them propagate or handle explicitly

## Message Recording
When CLI services execute:
1. Create initial message record in database
2. Stream responses as they arrive
3. Record tool usage for each tool call
4. Update message with final status
5. Broadcast via WebSocket for real-time updates

## Common Service Exports
Services should export functions following this pattern:

```typescript
export async function serviceName(
  projectId: string,
  ...args: Parameters
): Promise<ReturnType> {
  // Implementation
}
```

## Type Imports
Services use types from multiple sources:
- `@/types/backend/*` - Internal backend types
- `@/types/shared/*` - Shared client/server types
- `@/types/server/*` - Server-only types

## Caching Considerations
- Some data can be cached (project config, models list)
- CLI responses should not be cached (always fresh)
- Environment variables are retrieved fresh each time
