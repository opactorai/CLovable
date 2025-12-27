---
paths: app/api/**/*.ts
---

# API Routes Development Rules

## Location & Structure
All API endpoints are in `/app/api` organized by domain. Each endpoint is a `route.ts` file handling specific HTTP methods.

## Response Format
All API responses must use the `lib/utils/api-response.ts` utilities:

```typescript
import { successResponse, errorResponse } from '@/lib/utils/api-response';

// Success
return Response.json(successResponse(data, statusCode));

// Error
return Response.json(errorResponse(error.message, statusCode));
```

## Error Handling
- Use try-catch blocks around all async operations
- Return appropriate HTTP status codes (400, 401, 404, 500)
- Include detailed error messages in responses
- Log errors for debugging

## Database Operations
- Use Prisma client: `import { prisma } from '@/lib/db/client'`
- Always handle Prisma exceptions (unique constraints, missing relations)
- Use `findUnique` with `where` clauses, not `find`

## Authentication & Validation
- Validate incoming data early in the handler
- Check project ownership for project-specific endpoints
- Use TypeScript types from `/types` for request/response bodies

## Common Patterns
- Extract project_id from params/query
- Use `/chat/[project_id]/...` for chat-related operations
- Use `/projects/[project_id]/...` for project management
- Use `/env/[project_id]/...` for environment variables
- Use `/services/[service_id]/...` for service integrations

## WebSocket & Real-Time
For endpoints that support real-time updates:
- Import `streamManager` from `@/lib/services/stream`
- Use broadcast methods to send updates to connected clients
- Include proper error handling for disconnections
