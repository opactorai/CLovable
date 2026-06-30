# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Claudable is an AI web-app builder: a Next.js 15 (App Router) application that drives external AI coding-agent CLIs (Claude Code, Codex, Cursor, Qwen, GLM) to scaffold and edit *generated user projects*, then runs each generated project in a live preview server. The Claudable app itself, the agent orchestration, and the generated apps are three distinct layers — keep them straight when editing.

> **Two editions in this repo.** The original **desktop** app (this Next.js root + Electron + Prisma/SQLite, agents running on the user's machine) and a newer **cloud** edition (`server/` — a Node/TS backend that runs Claude Code inside per-project Docker containers, backed by Supabase). The cloud backend is independent of the Next.js API routes/Prisma; don't cross-wire them. Cloud entry points: [CLOUD_README.md](CLOUD_README.md), [CLOUD_BUILD_PROMPTS.md](CLOUD_BUILD_PROMPTS.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). The cloud frontend integration lives in `lib/cloud/` (isolated, additive). Build/check the backend from `server/` (`npm run type-check`, `npm run dev`).

## Commands

```bash
npm install          # also runs scripts/setup-env.js (postinstall): creates .env/.env.local, picks ports, ENCRYPTION_KEY
npm run dev          # scripts/run-web.js: sets up env, runs `prisma db push` if needed, starts `next dev`
npm run dev:desktop  # Electron shell (scripts/run-desktop.js)
npm run build        # next build (output: 'standalone')
npm run lint         # next lint
npm run type-check   # tsc --noEmit  -- there is no test suite; this + lint are the checks
```

Prisma / DB (SQLite at `data/cc.db`):
```bash
npm run prisma:generate   # regenerate client after editing prisma/schema.prisma
npm run prisma:push       # apply schema to the DB (dev uses db push, not migrations)
npm run prisma:studio
npm run prisma:reset      # drop + recreate DB (destructive; fixes schema drift after upgrades)
npm run db:backup         # data/backups/cc_backup_<ts>.db
```

There are **no automated tests**. Verify changes with `npm run type-check` and `npm run lint`, and by exercising flows in the running app.

## Ports & environment

- `scripts/setup-env.js` is the source of truth for env. It auto-generates `.env` + `.env.local`, choosing the Claudable web port (default 3000, scans up to ~3099) and reserving a **separate** pool (`PREVIEW_PORT_START`..`PREVIEW_PORT_END`, default 3100–3999) for per-project preview servers. Don't hardcode ports — the web app and previews must not collide.
- Generated user projects live under `PROJECTS_DIR` (default `./data/projects/<projectId>`); a project's `repoPath` overrides this.
- `ENCRYPTION_KEY` (hex) backs AES-256-CBC encryption of env vars in `lib/crypto.ts`. Service tokens (`ServiceToken`) are stored plaintext — this is local-dev-only by design.

## Architecture

**Request → agent → preview flow.** The UI calls `POST /api/chat/[project_id]/act` ([app/api/chat/[project_id]/act/route.ts](app/api/chat/[project_id]/act/route.ts)). That route normalizes the instruction + image attachments, persists a `UserRequest` and user `Message`, auto-starts the preview, then **dispatches to a CLI adapter** based on `cliPreference` (`claude` | `codex` | `cursor` | `qwen` | `glm`). It fires the adapter asynchronously (does not await) and returns a `requestId` immediately. Each adapter exposes the same pair: `initializeNextJsProject(...)` for the first prompt and `applyChanges(...)` for follow-ups.

**CLI adapters** live in [lib/services/cli/](lib/services/cli/) (`claude.ts`, `codex.ts`, `cursor.ts`, `qwen.ts`, `glm.ts`). Each one spawns/streams its respective external CLI, parses that CLI's distinct event format, and normalizes tool actions into a common vocabulary (`Read`/`Created`/`Edited`/`Deleted`/`Executed`/`Searched`/`Generated`). Only `claude` and `cursor` track resumable sessions (`activeClaudeSessionId` / `activeCursorSessionId` on `Project`). When changing agent behavior, mirror the change across all adapters — the dispatch in `act/route.ts` assumes a uniform interface. The agents are *external CLIs the user has logged into*, not the `@anthropic-ai/claude-agent-sdk` import alone.

**Real-time output** flows through two transports that mirror each other. `streamManager` ([lib/services/stream.ts](lib/services/stream.ts), SSE) and `websocketManager` ([lib/server/websocket-manager.ts](lib/server/websocket-manager.ts)) are both per-project singletons stored on `globalThis` to survive Next.js HMR/route reloads. `streamManager.publish()` writes to SSE clients **and** calls `websocketManager.broadcast()`, so adapters publish once and both transports get it. The WebSocket server is bootstrapped lazily in the Pages-router endpoint [pages/api/ws/[projectId].ts](pages/api/ws/[projectId].ts), which hooks the HTTP `upgrade` event (only `/api/ws/*`; HMR upgrades pass through). When adding a singleton manager, follow the `globalThis.__claudable_*__` pattern or it will be re-instantiated on every reload.

**Preview servers.** `previewManager` ([lib/services/preview.ts](lib/services/preview.ts)) spawns one dev server per generated project (detects npm/pnpm/yarn/bun), allocates a port from the preview pool, scaffolds a basic Next app if the directory is empty, and tails logs. Lifecycle is driven by `app/api/projects/[project_id]/preview/{start,stop,status}`.

**Data layer.** Prisma + SQLite. The Prisma client is a `globalThis` singleton in [lib/db/client.ts](lib/db/client.ts). Schema ([prisma/schema.prisma](prisma/schema.prisma)) centers on `Project` (with per-CLI session IDs, `preferredCli`, `selectedModel`) and its cascades: `Message`, `Session`, `EnvVar` (encrypted), `Commit`, `ToolUsage`, `UserRequest`, `ProjectServiceConnection`. Dev uses `prisma db push` (no migration history) — after schema edits run `prisma:generate` + `prisma:push`; if a teammate hits drift, `prisma:reset`.

**Service integrations** ([lib/services/](lib/services/)): `github.ts`, `vercel.ts`, `supabase.ts` push generated projects to those platforms. Tokens come from the `ServiceToken` table; per-project links are stored as `ProjectServiceConnection` rows with a JSON `serviceData` blob (shape documented inline in the schema).

**Model registries.** [lib/constants/](lib/constants/) (`claudeModels.ts`, `codexModels.ts`, `cursorModels.ts`, `qwenModels.ts`, `glmModels.ts`, aggregated by `cliModels.ts`) own model IDs, defaults, and normalization (`normalizeModelId`, `getDefaultModelForCli`). Add or rename a model here, not inline in adapters.

## Conventions

- Path alias `@/*` maps to repo root; `@/types/{shared,client,server,backend}` have dedicated mappings (see [tsconfig.json](tsconfig.json)).
- Server-only modules are kept out of the client bundle via the webpack `fs/path/os: false` fallback in [next.config.js](next.config.js). API routes that spawn processes or touch the DB set `runtime = 'nodejs'` and `dynamic = 'force-dynamic'` — keep that on new server routes.
- `react-icons` is stubbed in [stubs/](stubs/) (`react-icons-fa/si/vsc`) to trim bundle size; import icons through the existing stub pattern rather than pulling the full package.
- Frontend: App Router pages in [app/](app/), shared UI in [components/](components/) (`chat/`, `settings/`, `modals/`, `layout/`), React context in [contexts/](contexts/), data hooks in [hooks/](hooks/) (`useCLI`, `useWebSocket`, `useUserRequests`).
