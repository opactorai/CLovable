# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claudable is an AI-powered web app builder that enables users to create production-ready Next.js applications through natural language descriptions. It integrates with multiple AI coding agents (Claude Code, Cursor CLI, Codex, Qwen, Z.AI GLM) to generate code, manage projects, and deploy to Vercel with database integration via Supabase.

## Development Commands

### Core Development
- `npm run dev` or `npm run dev:web` - Start the Next.js web development server (auto-detects port)
- `npm run type-check` - Run TypeScript type checking without emitting files
- `npm run lint` - Run ESLint on the codebase
- `npm run build` - Build the Next.js application for production
- `npm start` - Start the production Next.js server

### Database Management (Prisma)
- `npm run prisma:generate` - Generate Prisma client (required after schema changes)
- `npm run prisma:push` - Push schema changes to SQLite database
- `npm run prisma:migrate` - Create and apply migrations
- `npm run prisma:studio` - Open Prisma Studio for database inspection
- `npm run prisma:reset` - Drop and recreate database (use if schema conflicts occur)

### Desktop Development (Electron)
- `npm run dev:desktop` - Run Claudable as an Electron desktop app
- `npm run build:desktop` - Build desktop app for current platform
- `npm run package:mac` - Package for macOS (dmg, zip)
- `npm run package:win` - Package for Windows (NSIS installer)
- `npm run package:linux` - Package for Linux (AppImage)

### Setup & Environment
- `npm run setup` - Complete setup (install deps, generate Prisma, push schema)
- `npm run ensure:env` - Configure environment variables and detect available ports
- `npm run check-cli` - Verify Claude Code CLI is installed and accessible

## Architecture & Data Flow

### High-Level Architecture

**Frontend → Backend → External Services**

```
User Interface (React/Next.js)
    ↓
Next.js API Routes (/app/api)
    ↓
Service Layer (/lib/services)
    ↓
Database (SQLite via Prisma)
    ↓
External APIs (GitHub, Vercel, Supabase, AI CLIs)
```

### Key Layers

**1. Frontend (React Components)**
- Main interface: `/app/[project_id]/chat/page.tsx`
- Components: `/components` (Chat, Settings, Modals)
- Global state: React Context for global settings
- Real-time updates: WebSocket connections for live chat updates

**2. API Layer (`/app/api`)**
- Handles HTTP requests from frontend
- Routes organized by domain:
  - `/chat/[project_id]/*` - Chat/AI interactions
  - `/projects/*` - Project CRUD and management
  - `/env/*` - Environment variable management
  - `/github/*` - GitHub integration
  - `/vercel/*` - Vercel deployment
  - `/supabase/*` - Supabase setup
  - `/repo/[project_id]/*` - Repository file operations

**3. Service Layer (`/lib/services`)**
- **CLI Services** (`/cli`): Integrations with AI coding agents
  - `claude.ts` - Claude Agent SDK (primary)
  - `cursor.ts`, `codex.ts`, `qwen.ts`, `glm.ts` - Other CLI integrations
- **Core Services**:
  - `project.ts` - Project CRUD operations
  - `message.ts` - Chat message management
  - `chat-sessions.ts` - Session lifecycle management
  - `user-requests.ts` - User request tracking
  - `file-browser.ts` - Repository file access
  - `preview.ts` - Live preview server management
  - `service-integration.ts` - GitHub/Vercel/Supabase orchestration
  - `tokens.ts` - Secure token management
  - `env.ts` - Environment variable handling
  - `websocket-manager.ts` - Real-time communication

**4. Database Layer (Prisma)**
- Schema: `/prisma/schema.prisma`
- SQLite for local development (auto-creates at `data/cc.db`)
- Models: Project, Message, Session, EnvVar, Commit, ToolUsage, UserRequest, ProjectServiceConnection

### Data Flow for a Typical Build Cycle

1. **User Input** → Frontend sends message via WebSocket
2. **Request Routing** → API route receives and queues request
3. **CLI Service** → Calls appropriate AI CLI (Claude Code, Cursor, etc.)
4. **Tool Execution** → AI agent reads/writes files, executes commands
5. **Message Recording** → Messages and tool usages stored in database
6. **Live Preview** → Preview server auto-reloads with generated code
7. **Real-time Updates** → WebSocket broadcasts changes to frontend

### Important File Relationships

- **Type Definitions** (`/types`): Three namespaces maintain separation:
  - `shared/*` - Types used across client and server
  - `client/*` - Client-only types
  - `server/*` - Server-only types
  - `backend/*` - Internal backend types

- **Serializers** (`/lib/serializers`): Convert between database/API representations
  - `chat.ts` - Message serialization
  - `project.ts` - Project serialization

- **Constants** (`/lib/constants`): CLI-specific configuration and model definitions
  - `claudeModels.ts`, `cursorModels.ts`, etc. - Model options per CLI
  - `cliModels.ts` - Unified CLI model interface

## Environment Setup

The project uses automatic environment configuration:
- `.env` created by `npm run ensure:env` with port assignments
- Database URL defaults to `file:./data/cc.db` (SQLite)
- All configuration is deterministic based on available system ports

## Type System

TypeScript strict mode is enabled. Key type patterns:
- API responses use discriminated unions (e.g., `{ success: true, data: ... } | { success: false, error: ... }`)
- Backend operations return server types; frontend receives serialized shared types
- CLI command options typed per CLI variant (Claude, Cursor, Codex, Qwen, GLM)

## Database

**Provider**: SQLite (local development and production)

**Key Tables**:
- `projects` - Application projects created by users
- `messages` - Chat history with role, content, metadata
- `sessions` - CLI session tracking per project
- `env_vars` - Encrypted environment variables (AES-256)
- `project_service_connections` - GitHub, Vercel, Supabase credentials
- `tool_usages` - Tool execution tracking (Read, Write, Edit, Bash, etc.)
- `user_requests` - User instruction queue with status tracking
- `commits` - Git commit history per project

**Schema Changes**: Run `npm run prisma:migrate` after modifying `/prisma/schema.prisma`

## Real-Time Communication

WebSocket connections established via `lib/server/websocket-manager.ts`:
- Messages streamed to client as AI generates code
- Tool results broadcast in real-time
- Supports multiple concurrent projects

## Multi-CLI Support

Claudable abstracts multiple AI coding agents through a consistent interface:
- Each CLI has a service module: `claude.ts`, `cursor.ts`, `codex.ts`, `qwen.ts`, `glm.ts`
- Models listed in `/lib/constants/[cli]Models.ts`
- CLI preference stored per project in database
- Fallback mechanism if primary CLI unavailable

## Integration Points

### GitHub
- OAuth/token-based authentication
- Automatic repo creation and management
- Commit history tracking

### Vercel
- Project deployment with environment variables
- Deployment status monitoring
- Auto-deployment configuration

### Supabase
- PostgreSQL database provisioning
- API key management
- Project-specific configuration

## Common Development Tasks

**Adding a new API endpoint**:
1. Create route file in `/app/api/[domain]/route.ts`
2. Use `lib/utils/api-response.ts` for consistent response formatting
3. Add database operations via Prisma client
4. Define types in `/types`

**Modifying database schema**:
1. Edit `/prisma/schema.prisma`
2. Run `npm run prisma:migrate` to generate migration
3. Serializers in `/lib/serializers` may need updates
4. Update types in `/types`

**Adding CLI support**:
1. Create service module in `lib/services/cli/[new_cli].ts`
2. Add models to `lib/constants/[new_cli]Models.ts`
3. Export from CLI service index
4. Update type definitions for new CLI options

**Testing real-time features**:
- WebSocket connections established automatically
- Use browser DevTools Network tab to monitor WebSocket frames
- Console logs available via `lib/server/websocket-manager.ts`

## Important Notes

- **Port Detection**: Application automatically detects available ports and updates `.env`
- **Security**: Environment variables containing secrets are AES-256 encrypted in database
- **Database Recovery**: If database conflicts occur, use `npm run prisma:reset` (warning: deletes all data)
- **File Paths**: Repository paths in projects point to `data/projects/[project_id]`
- **CLI Integration**: Direct execution of CLI commands via Node.js child processes
- **Electron Build**: Desktop app uses bundled `.next` build with Electron IPC bridge
