---
paths: lib/utils/**/*.ts,lib/config/**/*.ts,lib/constants/**/*.ts
---

# Utilities & Constants Development Rules

## Utility Modules (`lib/utils/`)

### api-response.ts
Provides consistent API response formatting:
```typescript
import { successResponse, errorResponse } from '@/lib/utils/api-response';

// Both return properly formatted JSON responses with status codes
successResponse(data, 200);
errorResponse(error, 500);
```

### path.ts
Path utilities for repository operations:
- Resolves project paths safely
- Prevents directory traversal attacks
- Use for file operations with `lib/services/file-browser.ts`

### ports.ts
Port detection and management:
- Auto-detects available ports
- Updates `.env` with assigned ports
- Used during `npm run ensure:env`

### cliOptions.ts
CLI option building and validation:
- Builds model options for each CLI
- Validates CLI preferences
- Provides CLI brand colors and names
- Type-safe CLI selection

### scaffold.ts
Project scaffolding utilities:
- Generates initial project structure
- Creates Next.js boilerplate
- Sets up basic files

### index.ts
General utility exports:
- Commonly used helper functions
- String/format utilities
- File path helpers

## Configuration Modules (`lib/config/`)

### constants.ts
Application-level constants:
- Default values
- Magic strings (avoided where possible)
- Configuration limits

## Model Constants (`lib/constants/`)

Each CLI has a dedicated models file:

### claudeModels.ts
Claude Agent SDK models:
- `CLAUDE_MODELS` array with model IDs
- `CLAUDE_DEFAULT_MODEL` current default
- Display names for each model
- `normalizeClaudeModelId()` for ID formatting
- `getClaudeModelDisplayName()` for UI display

### cursorModels.ts, codexModels.ts, qwenModels.ts, glmModels.ts
Same structure as Claude models but for each CLI variant.

### cliModels.ts
Unified CLI model interface:
- `getDefaultModelForCli()` - Returns default for given CLI
- `getModelDisplayName()` - Unified display name function
- `normalizeModelForCli()` - Normalizes model ID per CLI
- Acts as router to CLI-specific functions

## Usage Guidelines

### Importing Constants
```typescript
// Do this:
import { CLAUDE_DEFAULT_MODEL } from '@/lib/constants/claudeModels';

// Not this:
const DEFAULT_MODEL = 'claude-opus-4-5-20251101'; // Avoid magic strings
```

### Adding New Constants
When adding new constants:
1. Choose appropriate location (config/ or constants/)
2. Use SCREAMING_SNAKE_CASE for constants
3. Document the purpose
4. Export from index files for convenience

### Utility Functions
Keep utilities focused and single-purpose:
- Each file handles one domain
- Export multiple related functions, not single utilities
- Include JSDoc comments for public exports
- Use TypeScript strict mode

## Example: Adding CLI Support
To add a new CLI:
1. Create `lib/constants/newCliModels.ts` with model list
2. Create `lib/services/cli/newcli.ts` with integration
3. Add to `cliModels.ts` router
4. Update type definitions in `types/`

## Testing Utilities
Some utilities are tested in integration:
- Port detection: runs during `npm install`
- Path utilities: used by file operations
- Scaffolding: creates valid project structures

Mock these in unit tests rather than in production code.
