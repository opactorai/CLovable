---
paths: prisma/schema.prisma,lib/db/**/*.ts
---

# Database & Prisma Development Rules

## Database Provider
- **Type**: SQLite (both development and production)
- **Location**: `data/cc.db` (development) or environment-specified (production)
- **ORM**: Prisma

## Schema Modifications
Always follow this workflow when changing `prisma/schema.prisma`:

1. Edit `prisma/schema.prisma`
2. Run `npm run prisma:migrate` to create migration
3. Review generated migration file in `prisma/migrations/`
4. Migration applies automatically
5. Run `npm run prisma:generate` if types don't update

For development resets:
- `npm run prisma:reset` - Drops and recreates database (⚠️ data loss)
- `npm run prisma:studio` - Opens Prisma Studio for inspection

## Prisma Client Usage

Import the client:
```typescript
import { prisma } from '@/lib/db/client';
```

### CRUD Operations

**Create**:
```typescript
const project = await prisma.project.create({
  data: { name: 'My Project', description: '...' }
});
```

**Read**:
```typescript
const project = await prisma.project.findUnique({
  where: { id: projectId }
});

const projects = await prisma.project.findMany({
  where: { status: 'active' },
  include: { messages: true }
});
```

**Update**:
```typescript
const updated = await prisma.project.update({
  where: { id: projectId },
  data: { status: 'running' }
});
```

**Delete**:
```typescript
await prisma.project.delete({
  where: { id: projectId }
});
```

## Relationships

When querying related data, use `include`:
```typescript
const project = await prisma.project.findUnique({
  where: { id: projectId },
  include: {
    messages: true,
    sessions: true,
    envVars: true
  }
});
```

## Common Patterns

### Project Operations
- Always validate project exists before operations
- Use `onDelete: Cascade` for related records
- Messages and sessions automatically deleted when project deleted

### Environment Variables
- **Encryption**: Values stored encrypted as `valueEncrypted`
- **Decryption**: Use `lib/services/env.ts` for decryption
- **Never** store plaintext secrets in database

### Messages & Sessions
- Messages belong to Sessions and Projects
- Sessions track CLI type and status
- Use indexes on `projectId`, `sessionId`, `createdAt` for queries

### Tool Usage Tracking
- Recorded automatically by CLI services
- Links to message and project
- Includes tool name, input, output, duration
- Used for analytics and debugging

## Error Handling

Handle Prisma-specific errors:
```typescript
try {
  await prisma.envVar.create({
    data: { projectId, key, valueEncrypted }
  });
} catch (error) {
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      // Unique constraint violation
      throw new Error(`Env var '${key}' already exists`);
    }
  }
  throw error;
}
```

Common error codes:
- `P2002` - Unique constraint violation
- `P2025` - Record not found
- `P2003` - Foreign key constraint failure

## Transactions

Use transactions for multi-step operations:
```typescript
const result = await prisma.$transaction(async (tx) => {
  const project = await tx.project.create({ data: {...} });
  await tx.session.create({ data: {...} });
  return project;
});
```

## Performance

### Indexes
Existing indexes on:
- `projects.id`, `messages.projectId`, `messages.sessionId`, `messages.createdAt`, `messages.cliSource`, `messages.requestId`
- `sessions.projectId`, `sessions.cliType`
- `envVars.projectId`
- Add custom indexes for frequently filtered columns

### Query Optimization
- Select only needed fields with `select`
- Use `include` only for related data you need
- Filter at database level, not in application
- Use `take/skip` for pagination

## Type Safety
Prisma generates types automatically:
```typescript
import type { Project, Message } from '@prisma/client';
```

These are safe to use in types but should be serialized before sending to client (see `lib/serializers/`).

## Data Encryption
The `EnvVar` model uses AES-256 encryption:
- Values encrypted before storage
- Decrypted on retrieval in services
- Never access `valueEncrypted` directly; use service functions

## Migrations
Migrations are stored in `prisma/migrations/` and tracked in version control.
Always review migration SQL before running on production.
