# Claude Memory Rules Summary

This document provides a quick overview of all the rules configured for Claudable development.

## Complete Rule Structure

```
.claude/
├── README.md                    # Overview of the Claude memory system
├── RULES-SUMMARY.md             # This file - quick reference
├── CLAUDE.md                    # (See ../CLAUDE.md) - Project architecture
└── rules/
    ├── api-routes.md            # API endpoint development patterns
    ├── components.md            # React component guidelines
    ├── configuration.md         # Config file best practices
    ├── database.md              # Prisma & database operations
    ├── hooks-contexts.md        # React hooks & Context patterns
    ├── pages.md                 # Next.js pages & layout structure
    ├── services.md              # Service layer architecture
    ├── typescript.md            # General TypeScript guidelines
    ├── types.md                 # Type system organization
    └── utilities.md             # Utility functions & constants
```

## Rule Activation Rules

Each rule file activates automatically when you open matching files:

### Frontend Development

| When you open... | Rules that activate |
|---|---|
| `.tsx` files in `components/` | `components.md`, `typescript.md` |
| `.tsx` files in `app/` pages | `pages.md`, `typescript.md` |
| `.ts` files in `hooks/` | `hooks-contexts.md`, `typescript.md` |
| `.ts` files in `contexts/` | `hooks-contexts.md`, `typescript.md` |

### Backend Development

| When you open... | Rules that activate |
|---|---|
| `.ts` files in `app/api/` | `api-routes.md`, `typescript.md` |
| `.ts` files in `lib/services/` | `services.md`, `typescript.md` |
| `.ts` files in `lib/utils/`, `lib/config/`, `lib/constants/` | `utilities.md`, `typescript.md` |
| `.ts` files in `types/` | `types.md`, `typescript.md` |
| `prisma/schema.prisma` or `lib/db/**/*` | `database.md` |

### Configuration

| When you open... | Rules that activate |
|---|---|
| Configuration files (tsconfig, next.config, etc.) | `configuration.md` |

### Always Active

| Rule | Applies to |
|---|---|
| `typescript.md` | All `.ts` and `.tsx` files (general best practices) |
| `../CLAUDE.md` | Project root (architecture overview) |

## Rule Contents Quick Reference

### api-routes.md
- Response formatting with `api-response.ts`
- Error handling patterns
- Database access in routes
- Authentication & validation
- Common endpoint patterns
- WebSocket & real-time updates

### pages.md
- File structure (page.tsx, layout.tsx, route.ts)
- Root layout configuration
- Project pages organization
- Dynamic route patterns
- Server vs Client components
- Data fetching strategies
- Navigation patterns

### components.md
- Functional components with hooks
- Client vs Server components
- Framer Motion animations
- react-icons stubbed imports
- State management with hooks/Context
- TypeScript prop types
- Tailwind CSS styling
- Accessibility guidelines

### hooks-contexts.md
- Custom hook patterns (naming, structure)
- useEffect with cleanup
- useMemo and useCallback optimization
- Context API setup and usage
- Provider placement strategies
- Built-in hooks reference
- ESLint rules-of-hooks

### services.md
- Service organization by domain
- CLI services (Claude, Cursor, Codex, Qwen, GLM)
- Core services (project, message, sessions, etc.)
- Integration services (GitHub, Vercel, Supabase)
- Error handling in services
- Database access patterns
- Async/await patterns
- Message recording workflow

### database.md
- SQLite provider configuration
- Prisma schema modifications workflow
- CRUD operations patterns
- Relationships and includes
- Common patterns (projects, env vars, messages, tools)
- Error handling (Prisma errors)
- Transactions
- Performance optimization
- Data encryption for secrets
- Migration management

### types.md
- Type namespace organization (shared, client, server, backend)
- Naming conventions
- Generic types
- Zod validation schemas
- Type re-exports
- Discriminated unions
- API request/response patterns
- Breaking changes

### typescript.md
- Strict mode enforcement
- Path alias usage
- Type annotations guide
- Null/undefined handling
- Inferring types
- Generic constraints
- Type guards
- Const assertions
- Module organization
- Async/await patterns
- Error handling

### utilities.md
- `api-response.ts` - Response formatting
- `path.ts` - Path utilities
- `ports.ts` - Port detection
- `cliOptions.ts` - CLI option building
- `scaffold.ts` - Project scaffolding
- `index.ts` - General utilities
- Model constants per CLI
- `cliModels.ts` - Unified CLI interface
- Adding new constants

### configuration.md
- Next.js config
- TypeScript config
- Tailwind CSS config
- PostCSS setup
- ESLint configuration
- Prettier formatting
- Environment variables
- Database URLs
- Build output config
- Validation procedures

## Development Workflows by Task

### Creating a New API Endpoint
1. Open `app/api/[domain]/route.ts` → Loads `api-routes.md`
2. Reference response format patterns
3. Use error handling guidelines
4. Implement database access from `database.md` rules

### Adding a React Component
1. Create `components/[feature]/ComponentName.tsx` → Loads `components.md`
2. Use styling patterns from `components.md`
3. Apply hooks from `hooks-contexts.md` if needed
4. Reference TypeScript rules from `typescript.md`

### Modifying Database Schema
1. Edit `prisma/schema.prisma` → Loads `database.md`
2. Follow relationship patterns
3. Reference migration workflow
4. Update services if needed

### Adding a New Service
1. Create `lib/services/[domain].ts` → Loads `services.md`
2. Follow organization patterns
3. Reference error handling
4. Update types from `types.md`

### Implementing CLI Integration
1. Create service in `lib/services/cli/[name].ts` → Loads `services.md`
2. Reference CLI services section
3. Create models in `lib/constants/[cli]Models.ts` → Loads `utilities.md`
4. Update type definitions in `types/` → Loads `types.md`

## Glob Pattern Reference

Rules use glob patterns to match files:

```
**/*.ts           # All TypeScript files
app/api/**/*.ts   # All TypeScript under app/api
components/**/*.tsx  # React components
types/**/*.ts     # All type definition files
prisma/**         # Prisma-related files
lib/services/cli/*.ts  # CLI service modules
```

See individual rule files for exact patterns.

## Customization

### For Your Personal Preferences
Create `.claude/CLAUDE.local.md` (gitignored):
```markdown
# My Personal Preferences for Claudable

- My preferred code style decisions
- Local development setup notes
- Project-specific shortcuts I use
- Tools I always install
```

### Extending Rules
To add a new rule for a specific area:
1. Create `rules/[feature].md`
2. Add YAML frontmatter with `paths:` glob patterns
3. Document the guidelines
4. Commit to version control (sharable with team)

## Performance Notes

- Rules are loaded lazily only when matching files are opened
- All rules are evaluated against every file
- Avoid overly broad glob patterns (use specific paths when possible)
- Each rule file is small and fast to load

## For Team Development

These rules are in version control (except `.claude/CLAUDE.local.md`), so:
- All team members get the same rules
- Rule changes are tracked in git
- Documentation is always up-to-date
- New developers get context immediately

## Related Documentation

- **Architecture**: See `../CLAUDE.md`
- **Prisma Models**: See `prisma/schema.prisma`
- **Type Organization**: See `types/` directory structure
- **Service Organization**: See `lib/services/` directory structure

---

**Created**: December 27, 2025
**Project**: Claudable v2.0.0
**Status**: Complete and ready for use
