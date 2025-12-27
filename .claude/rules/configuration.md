---
paths: "*.config.js,*.config.ts,tsconfig.json,package.json,.eslintrc*,postcss.config.js,tailwind.config.ts"
---

# Configuration Files Development Rules

## Next.js Configuration (`next.config.js`)
- Webpack customization
- Environment variable configuration
- Build optimization settings
- Module resolution

## TypeScript Configuration (`tsconfig.json`)
- Compiler settings with strict mode enabled
- Path aliases for imports
- Module resolution strategy
- No emit (compilation only, no output)

## Tailwind CSS (`tailwind.config.ts`)
- Theme customization
- Color palette
- Spacing/sizing defaults
- Plugin configuration

## PostCSS (`postcss.config.js`)
- Autoprefixer for vendor prefixes
- CSS processing pipeline
- Used by Tailwind CSS

## ESLint (`.eslintrc.json`)
- Code quality rules
- Plugin configuration
- Next.js recommended rules
- No opinionated formatting (use Prettier)

## Prettier (`.prettierrc` - if exists)
- Code formatting
- Line length
- Quote style
- Tab configuration

## Environment Configuration
- `.env` - Created by `npm run ensure:env`
- `.env.local` - Local overrides (gitignored)
- `claude_code_zai_env.sh` - Z.AI GLM environment setup

Never commit:
- `.env.local`
- `.env` with sensitive values
- API keys or tokens

## Package Configuration (`package.json`)
Scripts must be runnable via `npm run`:
- `dev` - Start development
- `build` - Build for production
- `lint` - Run linter
- `type-check` - TypeScript checking
- `prisma:*` - Database operations

## Prisma Configuration (`prisma/schema.prisma`)
- Data source (SQLite)
- Generator (Prisma Client)
- Model definitions
- Relationships and constraints

**Key rules**:
- Use `@default(cuid())` for IDs (cryptographic random)
- Use `@default(now())` for timestamps
- Use `@map()` for database column names
- Use `@@index` for frequently queried fields
- Use `onDelete: Cascade` for relationships

## Build Output Configuration
In `package.json` build field:
- Electron configuration
- Asset inclusion
- Target platforms (mac, win, linux)
- Code signing (if needed)

## Environment Variables
Create `.env` with:
```
NEXT_PUBLIC_API_BASE=http://localhost:3000
DATABASE_URL=file:./data/cc.db
PORT=3000
```

`NEXT_PUBLIC_*` prefix makes variables available in browser.

## Database URLs
- Development: `file:./data/cc.db` (SQLite file)
- Production: Platform-specific path
- Never commit actual credentials

## Validation
When modifying configurations:
1. Verify syntax (JSON, JS, YAML as applicable)
2. Test with `npm run build` and `npm run dev`
3. Run type checking: `npm run type-check`
4. Check linting: `npm run lint`

Most configuration changes don't require restart, but:
- `tsconfig.json` - Restart needed
- `.env` - Restart needed
- `tailwind.config.ts` - Restart recommended
- `next.config.js` - Restart needed
