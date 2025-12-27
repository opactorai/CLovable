---
paths: types/**/*.ts
---

# TypeScript Types Development Rules

## Type Organization Structure

The type system uses path-based namespaces to maintain clear separation:

### Type Namespaces

**1. Shared Types** (`types/shared/*`)
- Used across both client and server
- Import as: `import type { X } from '@/types/shared'` or `'@/types/shared/chat'`
- Examples: ChatMessage, Project, CLI options, service definitions
- Must not depend on client-only or server-only types

**2. Client Types** (`types/client/*`)
- Client-side only (browser-specific)
- Import as: `import type { X } from '@/types/client'`
- Examples: Modal state, UI component props, client-only contexts
- Cannot be imported on server

**3. Server Types** (`types/server/*`)
- Server-side only (Node.js specific)
- Import as: `import type { X } from '@/types/server'`
- Examples: Database responses, server configuration
- Cannot be sent to client

**4. Backend Types** (`types/backend/*`)
- Internal backend-only types (not exposed to frontend)
- Import as: `import type { X } from '@/types/backend'`
- Examples: CLI configuration, internal data structures, service parameters
- Reserved for internal implementation details

## Type Definition Guidelines

### Interfaces vs Types
- Use `interface` for object shapes that may be extended
- Use `type` for unions, primitives, and complex types
- Use `interface` for exported API contracts

### Naming Conventions
- Suffix with data structure: `ChatMessage`, `ProjectSettings`, `CliResponse`
- Use `Result` suffix for operation outcomes: `CliCommandResult`
- Use `Config` suffix for configuration: `VercelConfig`
- Use discriminated unions for variant types: `{ type: 'success'; data: T } | { type: 'error'; error: E }`

### Generic Types
- Keep generics simple and clear
- Document generic constraints
- Avoid deeply nested generics

### Zod Schemas (Validation)
Use Zod for runtime validation of API inputs:
```typescript
import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
```

## Common Type Patterns

### API Request/Response
```typescript
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### CLI Integration
```typescript
export interface CliResponse {
  type: 'success' | 'error' | 'streaming';
  content: string;
  metadata?: Record<string, unknown>;
}
```

### Database Models
Import from Prisma for database types:
```typescript
import type { Project, Message } from '@prisma/client';
```

## Type Re-exports
The `/types/index.ts` file provides convenient exports of commonly used types.

## Serialization
Types in `shared/` are used for both database records and API responses.
Use serializers in `lib/serializers/` to convert between:
- Database Prisma types
- API/wire format types
- Client display types

## Union Types & Discriminators
Use discriminated unions extensively:
```typescript
export type MessageType =
  | { kind: 'text'; content: string }
  | { kind: 'tool'; toolName: string; result: unknown };
```

## Generic Constraints
Document constraints clearly:
```typescript
export type ServiceResult<T extends Record<string, unknown>> = {
  data: T;
  timestamp: Date;
};
```

## Breaking Changes
- Types are public API contracts
- Changes to `shared/*` types may break clients
- Document deprecations before removing types
- Use type extensions to maintain compatibility
