# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

Claudable is a full-stack web application that connects AI coding agents (Claude Code, Cursor CLI, etc.) with a web-based interface for building and deploying Next.js applications. The architecture consists of:

### Frontend (apps/web)
- **Next.js 14** application with TypeScript
- **App Router** architecture with pages in `app/` directory
- **Tailwind CSS** for styling with dark mode support
- **Framer Motion** for animations
- **React Context** for global state management (Auth, GlobalSettings)
- **Component Architecture**: Shared components for project management, modals, and UI elements

### Backend (apps/api) 
- **FastAPI** Python web framework
- **SQLAlchemy** for database operations with SQLite (local) / PostgreSQL (production)
- **WebSocket** support for real-time communication
- **Claude Code SDK** integration for AI agent communication
- **Modular structure**: 
  - `api/` - REST endpoints
  - `core/` - Configuration and utilities
  - `models/` - Database models
  - `services/` - Business logic
  - `db/` - Database connections

### Key Integrations
- **Multiple AI Agents**: Claude Code (primary), Cursor CLI, Codex CLI, Gemini CLI, Qwen Code
- **Deployment**: Vercel integration for hosting
- **Version Control**: GitHub integration for repositories
- **Database**: Supabase for production PostgreSQL
- **File Management**: Local SQLite database with project files stored in `data/`

## Development Commands

### Primary Development
```bash
# Start full development environment (both frontend and backend)
npm run dev

# Frontend only (Next.js dev server)
npm run dev:web

# Backend only (FastAPI with uvicorn) 
npm run dev:api
```

### Database Operations
```bash
# Reset database to initial state (WARNING: Deletes all data)
npm run db:reset

# Create backup of SQLite database
npm run db:backup

# Restore from backup (manual operation)
```

### Environment Management
```bash
# Setup environment files and Python venv
npm run setup

# Clean all dependencies and environments
npm run clean

# Ensure environment is properly configured
npm run ensure:env
npm run ensure:venv
```

### Testing and Quality
The project uses:
- Next.js built-in TypeScript checking
- FastAPI automatic OpenAPI documentation at `http://localhost:8080/docs`
- Manual testing through web interface

## Project Structure

```
Claudable/
├── apps/
│   ├── web/           # Next.js frontend
│   │   ├── app/       # App Router pages
│   │   ├── components/# Reusable React components  
│   │   ├── contexts/  # React Context providers
│   │   └── types/     # TypeScript type definitions
│   └── api/           # FastAPI backend
│       └── app/
│           ├── api/   # REST endpoints
│           ├── core/  # Configuration & utilities
│           ├── models/# Database models
│           └── services/ # Business logic
├── scripts/           # Build and development scripts
├── data/             # SQLite database and project files
└── assets/          # Static assets and documentation images
```

## Configuration

### Environment Setup
Copy `.env.example` to `.env` and configure:

**Required:**
- `ANTHROPIC_API_KEY` - For Claude Code SDK integration

**Optional:**
- `API_PORT` - Backend server port (default: 8080)
- `WEB_PORT` - Frontend server port (default: 3000) 
- `DATABASE_URL` - PostgreSQL connection (for production)
- Service integrations: GitHub, Vercel, Supabase tokens

### Port Configuration
The application automatically detects available ports:
- Frontend: http://localhost:3000 (or next available)
- Backend: http://localhost:8080 (or next available)
- API Documentation: http://localhost:8080/docs

## Development Workflow

1. **Project Creation**: Users describe their app idea through the web interface
2. **AI Agent Selection**: Choose from Claude Code, Cursor CLI, Codex CLI, Gemini CLI, or Qwen Code
3. **Code Generation**: Selected AI agent generates Next.js application code
4. **Live Preview**: Real-time preview with hot-reload during development
5. **Deployment**: One-click deployment to Vercel with GitHub integration

## Key Features Implementation

### Multi-Agent Support
- Agent detection and installation checking via `scripts/` utilities
- Per-project agent preference stored in database
- Model selection per agent (GPT-5, Claude Sonnet 4, etc.)

### Real-time Communication  
- WebSocket connection between frontend and backend
- Live code generation updates
- Preview server management

### Project Management
- SQLite database for local development
- Project files stored in `data/projects/`
- Preview servers run on dynamic port allocation
- Automatic cleanup and resource management

## Development Tips

- Backend API documentation is auto-generated at `/docs` endpoint
- Frontend builds use Next.js with Turbo for faster compilation
- Database schema changes require manual migration planning
- All AI agent communication goes through the Claude Code SDK wrapper