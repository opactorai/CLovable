---
paths: "**/*.ts,**/*.tsx"
---

# TypeScript Development Rules

## TypeScript Compiler Settings
See `tsconfig.json` for configuration:
- Target: ES2020
- Strict mode: enabled
- Module resolution: bundler
- Requires JSX files to use `.tsx` extension
- Base URL: `.` (allow `@/` path imports)

## Path Aliases
Configure in `tsconfig.json`:
- `@/*` - Root directory
- `@/types/shared` - Shared types
- `@/types/client` - Client types
- `@/types/server` - Server types
- `@/types/backend` - Backend types

Always use `@/` imports, never relative paths.

## Strict Mode Requirements
With `strict: true`:
- All variables must have types
- All function parameters must be typed
- All function return values must be typed
- Null/undefined checking enforced
- No `any` type without explicit `@ts-expect-error` comment

## Type Annotations

### Variable Types
```typescript
const name: string = 'value';
const count: number = 0;
const items: string[] = [];
const map: Map<string, unknown> = new Map();
```

### Function Types
```typescript
function processData(input: string): Promise<Result> {
  // implementation
}

const arrow = (x: number): number => x * 2;
```

### Optional & Union Types
```typescript
const optional: string | undefined = undefined;
const union: 'active' | 'inactive' = 'active';
const nullable: Value | null = null;
```

### Generic Types
```typescript
const array: Array<string> = [];
const promise: Promise<Data> = fetch('/api/data').then(r => r.json());
```

## Null/Undefined Handling
Use strict null checks:
```typescript
// ❌ Don't do this
const value = data.property; // May be undefined

// ✅ Do this
const value = data?.property ?? defaultValue;
const value = data?.property || 'default';
```

## Never Use `any`
If you must use `any`, add explanation:
```typescript
// @ts-expect-error Library doesn't export types
import { unknownLibrary } from 'some-lib';
```

## Inferring Types
Let TypeScript infer types when obvious:
```typescript
// ✅ Type is clear from right side
const name = 'Alice';
const count = 42;
const items = ['a', 'b'];

// ❌ Explicit types are redundant
const name: string = 'Alice';
```

## Generic Constraints
Document constraints for readability:
```typescript
// Process array of objects with 'id' property
function findById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}
```

## Type Guards
Use type guards for narrowing:
```typescript
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

if (isString(data)) {
  console.log(data.toUpperCase()); // TypeScript knows it's string
}
```

## Discriminated Unions
Prefer discriminated unions over interfaces with optional fields:

```typescript
// ✅ Good - discriminated union
type Result =
  | { success: true; data: Data }
  | { success: false; error: string };

// ❌ Avoid - optional fields
interface Result {
  success: boolean;
  data?: Data;
  error?: string;
}
```

## Const Assertions
Use `as const` for literal types:
```typescript
const MODES = ['read', 'write', 'admin'] as const;
type Mode = (typeof MODES)[number]; // 'read' | 'write' | 'admin'
```

## Module Organization
Each file should export one main thing:
- One interface or one function
- Multiple related functions OK
- Use `index.ts` for barrel exports
- Keep modules focused

## Import/Export Style
Prefer named exports:
```typescript
// ✅ Named export
export function getData() {}

// Default only for pages/layouts
export default function Page() {}
```

## Async/Await
Prefer async/await over `.then()`:
```typescript
// ✅ Readable
async function load() {
  const data = await fetch('/api/data');
  return data.json();
}

// ❌ Less readable
function load() {
  return fetch('/api/data').then(r => r.json());
}
```

## Error Handling
Always handle promise rejections:
```typescript
try {
  const data = await fetch('/api/data');
} catch (error) {
  if (error instanceof TypeError) {
    // Network error
  }
  // Handle error
  throw error;
}
```

## Avoid Common Mistakes
- Don't use `string | any` (effectively `any`)
- Don't declare types for React hooks return values
- Don't import types without `import type`
- Don't use `Array<string>` when `string[]` is clearer

## Type Imports
Use `import type` for types:
```typescript
import type { DataType } from '@/types';
import { DataProvider } from '@/providers';
```

This helps bundlers distinguish types from runtime code.
