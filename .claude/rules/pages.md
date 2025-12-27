---
paths: app/**/*.tsx,app/**/*.ts
---

# Next.js Pages & Layout Development Rules

## File Structure
- `/app` - App Router pages and layouts (Next.js 13+)
- `page.tsx` - Page components
- `layout.tsx` - Layout components
- `route.ts` - API route handlers
- `error.tsx` - Error boundary (if needed)

## Root Layout
`app/layout.tsx`:
- Defines HTML structure (html, head, body)
- Wraps entire app
- Includes global styles
- Sets up providers/contexts
- Should be server component

## Main Pages

### Home Page (`app/page.tsx`)
- Project listing
- Create project modal
- Global settings access
- Should be client component (`"use client"`)

### Project Chat Page (`app/[project_id]/chat/page.tsx`)
- Main interface for building
- Chat input and message history
- Live preview
- Settings sidebar
- Heavy client component with hooks and state

## Dynamic Routes
Uses `[param]` syntax:
- `[project_id]` - Dynamic segment for project routes
- `useParams()` hook retrieves from URL
- `useRouter()` for navigation

## API Routes Pattern
```typescript
export async function GET(request, context) {}
export async function POST(request, context) {}
export async function PUT(request, context) {}
export async function DELETE(request, context) {}
```

All API routes:
1. Extract params from `context.params`
2. Validate input (query/body)
3. Call service layer
4. Return JSON response

## Layout Hierarchy
- `app/layout.tsx` - Root layout (global)
- `app/[project_id]/layout.tsx` - Project-specific layout (if needed)

Layouts wrap their children and persist across navigation.

## Server vs Client Components
- Layouts are server components by default
- Pages can be server or client
- Use `"use client"` when needing:
  - Browser APIs (localStorage, window)
  - React hooks (useState, useEffect)
  - Event handlers (onClick, onChange)

## Data Fetching
- Server components can directly fetch from database
- Client components must call API routes
- Use `fetch` API in server components
- Use custom hooks in client components

## TypeScript with Next.js
Use Next.js provided types:
```typescript
import type { NextRequest } from 'next/server';
import type { Metadata } from 'next';
```

## Context Params
API routes receive context with params:
```typescript
export async function GET(request, { params }) {
  const { project_id } = params;
  // params are string | string[]
}
```

## Redirects & Navigation
- Use `useRouter()` in client components
- Use `redirect()` in server components
- Prefer client-side navigation for UX

## Search Params
Access query parameters:
```typescript
const searchParams = useSearchParams(); // client
const query = searchParams.get('key');

// or in server components
async function Page({ searchParams }) {
  const page = searchParams.page;
}
```

## Error Handling
Wrap client components with ErrorBoundary from `@/components/ErrorBoundary`:
```typescript
<ChatErrorBoundary>
  <ChatComponent />
</ChatErrorBoundary>
```

## Performance
- Use dynamic imports for heavy components
- Use `lazy` loading for modals/complex UI
- Memoize expensive computations with `useMemo`
- Use `useCallback` for event handlers
- Avoid large bundle sizes

## Metadata
Set page metadata in server components:
```typescript
export const metadata: Metadata = {
  title: 'Project Builder',
  description: 'Build your project with AI'
};
```
