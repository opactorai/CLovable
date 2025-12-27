# Quick Start Guide to Claude Memory System

Welcome to Claudable's organized documentation system! This guide helps you navigate and use the rules effectively.

## Visual Structure

```
Your Claudable Project
│
├── CLAUDE.md                    ← Main architecture guide (auto-loaded)
│
└── .claude/                     ← Claude Code memory system
    ├── README.md                ← System overview
    ├── RULES-SUMMARY.md         ← All rules at a glance
    ├── QUICK-START.md           ← This file
    │
    └── rules/                   ← Modular, auto-loading rules
        ├── api-routes.md        ← Working on endpoints? Use this
        ├── pages.md             ← Working on pages? Use this
        ├── components.md        ← Building React UI? Use this
        ├── hooks-contexts.md    ← Custom hooks? Use this
        ├── services.md          ← Service layer work? Use this
        ├── database.md          ← Database changes? Use this
        ├── types.md             ← Type definitions? Use this
        ├── typescript.md        ← General TS best practices
        ├── utilities.md         ← Utilities & constants
        └── configuration.md     ← Config file changes
```

## The Magic: Automatic Rule Loading

When you open a file in Claude Code:

```typescript
// You open this file: components/chat/ChatInput.tsx
```

Claude Code automatically:
1. ✅ Loads `components.md` (for .tsx files in components/)
2. ✅ Loads `hooks-contexts.md` (if you import hooks)
3. ✅ Loads `typescript.md` (general TS rules)
4. ✅ Loads `../CLAUDE.md` (project context)

All relevant rules are now available in your context!

## Quick Answer Lookup

**Q: How do I structure an API endpoint?**
A: Open any file in `app/api/` → `api-routes.md` loads automatically

**Q: What's the right way to write a React component?**
A: Open any `.tsx` file in `components/` → `components.md` loads automatically

**Q: How do I query the database?**
A: Open `prisma/schema.prisma` or `lib/db/` files → `database.md` loads automatically

**Q: What type patterns should I use?**
A: Open any file in `types/` → `types.md` loads automatically

**Q: What about TypeScript best practices?**
A: Open any `.ts` or `.tsx` file → `typescript.md` loads automatically

**Q: How do services work?**
A: Open any file in `lib/services/` → `services.md` loads automatically

## How to Use a Rule File

Once a rule file is loaded:

1. **Read the section title** that matches what you're doing
2. **Follow the code examples** - they show the pattern to use
3. **Check the "do's and don'ts"** - avoid common mistakes
4. **Ask Claude** - "What does [rule name] say about this?"

## Example: Building a New Feature

Let's say you need to add a GitHub integration feature:

### Step 1: Plan the Database Changes
```
Open: prisma/schema.prisma
Rules loaded: database.md
Action: Review Prisma patterns, add new model
```

### Step 2: Create the Service
```
Open: lib/services/github.ts
Rules loaded: services.md, typescript.md
Action: Follow service organization patterns
```

### Step 3: Create API Endpoint
```
Open: app/api/github/[action]/route.ts
Rules loaded: api-routes.md, typescript.md
Action: Use response formatting patterns
```

### Step 4: Add React Component
```
Open: components/modals/GitHubModal.tsx
Rules loaded: components.md, hooks-contexts.md, typescript.md
Action: Follow component structure, use Framer Motion
```

### Step 5: Add Types
```
Open: types/shared/github.ts
Rules loaded: types.md, typescript.md
Action: Follow namespace organization
```

All rules activate automatically as you work! 🎯

## File Types That Activate Rules

| File Pattern | Activated Rules |
|---|---|
| `app/api/**/*.ts` | api-routes.md, typescript.md |
| `app/**/page.tsx` | pages.md, typescript.md |
| `app/**/layout.tsx` | pages.md, typescript.md |
| `components/**/*.tsx` | components.md, typescript.md |
| `hooks/**/*.ts` | hooks-contexts.md, typescript.md |
| `contexts/**/*.tsx` | hooks-contexts.md, typescript.md |
| `lib/services/**/*.ts` | services.md, typescript.md |
| `lib/db/**/*.ts` | database.md, typescript.md |
| `lib/utils/**/*.ts` | utilities.md, typescript.md |
| `types/**/*.ts` | types.md, typescript.md |
| `prisma/**` | database.md |
| `any/*.config.*` | configuration.md |
| `**/*.ts` or `**/*.tsx` | typescript.md (always) |

## Pro Tips

### Tip 1: Use the README.md
```
Open: .claude/README.md
Learn: How the entire system works
Time: 5 minutes well spent
```

### Tip 2: Reference RULES-SUMMARY.md
```
Open: .claude/RULES-SUMMARY.md
Learn: What each rule covers
Time: Quick lookup table
```

### Tip 3: Create CLAUDE.local.md
```
Create: .claude/CLAUDE.local.md (not in git)
Use for: Your personal preferences
Example: "I always prefer this coding style"
```

### Tip 4: Ask Claude
```
In Claude Code, just ask:
"What does the rules say about [topic]?"
"How should I structure this?"
"Show me the pattern for [task]"
```

Claude automatically considers the rules!

## Rule Files by Topic

### 🎨 Frontend & UI
- `components.md` - React components
- `hooks-contexts.md` - Custom hooks
- `pages.md` - Page structure

### 🔌 Backend & APIs
- `api-routes.md` - API endpoints
- `services.md` - Business logic layer
- `database.md` - Data persistence

### 📝 Code Organization
- `typescript.md` - Language best practices
- `types.md` - Type system
- `utilities.md` - Helper functions

### ⚙️ Project Setup
- `configuration.md` - Build config
- `../CLAUDE.md` - Architecture overview

## Workflow: Adding a New CLI

When adding support for a new AI CLI:

1. **Create service**: `lib/services/cli/newcli.ts`
   - Rules: `services.md`, `typescript.md`

2. **Add models**: `lib/constants/newCliModels.ts`
   - Rules: `utilities.md`, `typescript.md`

3. **Update types**: `types/shared/cli.ts`
   - Rules: `types.md`, `typescript.md`

4. **Create API endpoint**: `app/api/chat/[id]/cli/route.ts`
   - Rules: `api-routes.md`, `typescript.md`

All rules load automatically as you work through each file!

## Checking Your Work

Before committing:

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Build
npm run build

# These enforce the rules in code
```

## Getting Help

1. **Open a relevant file** → Rules load automatically
2. **Ask Claude** about the rules
3. **Reference the rule files** directly
4. **Check RULES-SUMMARY.md** for quick lookup
5. **Read ../CLAUDE.md** for architecture context

## Key Principles (Remembered Everywhere)

These principles appear in all rules:

✅ **Type Safety** - TypeScript strict mode, explicit types
✅ **Separation** - API → Service → Database layers
✅ **Reusability** - Services are stateless and composable
✅ **Security** - Encrypted secrets, validated inputs
✅ **Real-time** - WebSocket-first architecture

## Next Steps

1. ✅ Read `README.md` to understand the system (you are here)
2. ✅ Skim `RULES-SUMMARY.md` to see all rules
3. ✅ Open a file you'll be working on → Watch rules load
4. ✅ Ask Claude questions about the rules
5. ✅ Create `CLAUDE.local.md` for your personal prefs

You're now ready to develop efficiently with full context!

---

**Pro Tip**: The first time you work on different file types, take 2 minutes to skim the relevant rule. It'll save you hours later!

**Questions?** Ask Claude directly in your editor:
- "What do the rules say about [topic]?"
- "Show me an example from [rule name]"
- "How should I structure [feature]?"

Enjoy coding! 🚀
