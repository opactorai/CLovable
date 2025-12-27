# Claude Code Memory System for Claudable

This directory contains organized documentation and rules for developing in the Claudable codebase. The Claude Code editor uses these files to provide context-aware guidance based on what files you're working with.

## How This Works

When you open any file in Claude Code:
1. It scans the `.claude/rules/` directory
2. Finds rule files with matching path patterns
3. Loads and applies those rules to guide your work
4. Rules use glob patterns to target specific file types

All rules are loaded automatically - you don't need to do anything special.

## File Organization

### Main Project Guide
- **`../CLAUDE.md`** - High-level project architecture and overview (loaded by default)

### Modular Rules (in `rules/` directory)

Rules are organized by code domain and apply based on file path patterns:

| Rule File | Applies To | Purpose |
|-----------|-----------|---------|
| **api-routes.md** | `app/api/**/*.ts` | API endpoint conventions and patterns |
| **pages.md** | `app/**/*.tsx`, `app/**/*.ts` | Next.js pages and layout structure |
| **components.md** | `components/**/*.tsx` | React component development guidelines |
| **hooks-contexts.md** | `hooks/**/*`, `contexts/**/*` | Custom hooks and Context API patterns |
| **services.md** | `lib/services/**/*.ts` | Service layer architecture and patterns |
| **database.md** | `prisma/schema.prisma`, `lib/db/**/*.ts` | Prisma and database operations |
| **types.md** | `types/**/*.ts` | TypeScript type system organization |
| **typescript.md** | `**/*.ts`, `**/*.tsx` | General TypeScript best practices |
| **utilities.md** | `lib/utils/**/*.ts`, `lib/config/**/*.ts`, `lib/constants/**/*.ts` | Utility functions and constants |
| **configuration.md** | Configuration files (tsconfig, next.config, etc.) | Build and framework configuration |

### Personal Preferences (Optional)

Create a `CLAUDE.local.md` file (gitignored) for your personal project preferences:
```markdown
# My Personal Preferences

- Preferred code organization style
- Local development tips
- Project-specific shortcuts
```

## Rule Format

Each rule file uses YAML frontmatter to specify which files it applies to:

```markdown
---
paths: app/api/**/*.ts
---

# Rule Title

Content explaining the guidelines...
```

The `paths` field uses glob patterns:
- `app/api/**/*.ts` - All TypeScript files under app/api
- `components/**/*.tsx` - React components
- `**/*.ts` - All TypeScript files (general rules)

## Using the Rules

### When Working on Code
1. Open a file in Claude Code
2. Relevant rules automatically appear in context
3. Claude suggests patterns that match the rules
4. Request guidance: "What conventions should I follow here?"

### Searching Rules
To find rules for a specific topic:
- **API work**: Check `api-routes.md`
- **React components**: Check `components.md`
- **Database**: Check `database.md`
- **Type definitions**: Check `types.md`
- **General**: Check `../CLAUDE.md`

### Updating Rules
To modify a rule:
1. Edit the file in `.claude/rules/`
2. Changes apply immediately in new Claude Code sessions
3. Share rule changes with team (they're in source control)

## Quick Reference

### Common Questions & Rules

**"What conventions should I follow for API endpoints?"**
→ See `api-routes.md`

**"How do I structure a React component?"**
→ See `components.md`

**"What's the database access pattern?"**
→ See `database.md`

**"How are types organized?"**
→ See `types.md`

**"What about TypeScript best practices?"**
→ See `typescript.md`

**"What services are available?"**
→ See `services.md`

**"How do I add a new CLI integration?"**
→ See `services.md` (CLI Services section) and `constants/` section in `utilities.md`

## Key Principles

These rules enforce the core principles of Claudable development:

1. **Type Safety** - Strict TypeScript with full type coverage
2. **Separation of Concerns** - Clear layers (API, Service, Database)
3. **Multi-CLI Support** - Abstract CLI differences in services
4. **Real-time Capability** - WebSocket-first architecture
5. **Security** - Encrypted secrets, validated inputs, safe paths
6. **Maintainability** - Clear structure, consistent patterns, good documentation

## Architecture Reminder

Always remember the data flow:

```
Frontend (React Components)
    ↓ API Call
API Routes (app/api)
    ↓ Call Service
Service Layer (lib/services)
    ↓ Database/External
Database (Prisma) / External APIs
```

Keep this separation clean:
- Components don't touch database
- API routes don't do business logic (that's services)
- Services are stateless and reusable
- Types flow from database through services to frontend

## Contributing to Rules

When you discover a pattern or best practice:
1. Document it in the appropriate rule file
2. Use clear examples
3. Add to the glob pattern if it applies to more files
4. Commit the change
5. Share with team

## Learning More

- **Project Overview**: See `../CLAUDE.md`
- **Codebase Structure**: Browse `/lib`, `/components`, `/app`
- **Type System**: Read `/types` directory structure
- **Prisma Schema**: Study `/prisma/schema.prisma`

---

**Last Updated**: December 27, 2025
**Project**: Claudable v2.0.0
