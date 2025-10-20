# Claudable

<img src="./assets/Claudable_main.png" alt="CLovable" style="border-radius: 12px; width: 100%;" />
<div align="center">
<h3>Connect Claude Code. Build what you want. Deploy instantly.</h3>

<p>Powered by <a href="https://opactor.ai">OPACTOR</a></p>
</div>
<p align="center">
<a href="https://discord.gg/NJNbafHNQC">
<img src="https://img.shields.io/badge/Discord-Join%20Community-7289da?style=flat&logo=discord&logoColor=white" alt="Join Discord Community">
</a>
<a href="https://opactor.ai">
<img src="https://img.shields.io/badge/OPACTOR-Website-000000?style=flat&logo=web&logoColor=white" alt="OPACTOR Website">
</a>
<a href="https://twitter.com/aaron_xong">
<img src="https://img.shields.io/badge/Follow-@aaron__xong-000000?style=flat&logo=x&logoColor=white" alt="Follow Aaron">
</a>
</p>

## What is Claudable?

Claudable is a powerful Next.js-based web app builder that combines **C**laude Code's (Cursor CLI also supported!) advanced AI agent capabilities with **Lovable**'s simple and intuitive app building experience. Just describe your app idea - "I want a task management app with dark mode" - and watch as Claudable instantly generates the code and shows you a live preview of your working app. You can deploy your app to Vercel and integrate database with Supabase for free.

This open-source project empowers you to build and deploy professional web applications easily for **free**.

How to start? Simply login to Claude Code (or Cursor CLI), start Claudable, and describe what you want to build. That's it. There is no additional subscription cost for app builder. 

## Features
<img src="./assets/Claudable_short.gif" alt="Claudable Demo" style="width: 100%; max-width: 800px;">

- **Powerful Agent Performance**: Leverage the full power of Claude Code and Cursor CLI Agent capabilities with native MCP support
- **Natural Language to Code**: Simply describe what you want to build, and Claudable generates production-ready Next.js code
- **Instant Preview**: See your changes immediately with hot-reload as AI builds your app
- **Zero Setup, Instant Launch**: No complex sandboxes, no API key, no database headaches - just start building immediately
- **Beautiful UI**: Generate beautiful UI with Tailwind CSS and shadcn/ui
- **Deploy to Vercel**: Push your app live with a single click, no configuration needed
- **GitHub Integration**: Automatic version control and continuous deployment setup
- **Supabase Database**: Connect production PostgreSQL with authentication ready to use
- **Automated Error Detection**: Detect errors in your app and fix them automatically

## Technology Stack
**AI Cooding Agent:**
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code/setup)**: Advanced AI coding agent. We strongly recommend you to use Claude Code for the best experience.
  ```bash
  # Install
  npm install -g @anthropic-ai/claude-code
  # Login
  claude  # then > /login
  ```
- **[Cursor CLI](https://docs.cursor.com/en/cli/overview)**: Intelligent coding agent for complex coding tasks. It's little bit slower than Claude Code, but it's more powerful.
  ```bash
  # Install
  curl https://cursor.com/install -fsS | bash
  # Login
  cursor-agent login
  ```

**Database & Deployment:**
- **[Supabase](https://supabase.com/)**: Connect production-ready PostgreSQL database directly to your project.
- **[Vercel](https://vercel.com/)**: Publish your work immediately with one-click deployment

**There is no additional subscription cost and built just for YOU.**

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js 18+
- Python 3.10+
- Claude Code or Cursor CLI (already logged in)
- Git

## Quick Start

Get Claudable running on your local machine in minutes:

```bash
# Clone the repository
git clone https://github.com/opactorai/Claudable.git
cd Claudable

# Install all dependencies (Node.js and Python)
npm install

# Start development servers
npm run dev
```

Your application will be available at:
- Frontend: http://localhost:3000
- API Server: http://localhost:8080
- API Documentation: http://localhost:8080/docs

**Note**: Ports are automatically detected. If the default ports are in use, the next available ports will be assigned.

## Environment Variables

- Only example templates are committed. Real `.env` files are git‑ignored.
- Auto‑creation: `npm install` runs `scripts/setup-env.js` to create
  - `./.env` with local ports and SQLite path
  - `apps/web/.env.local` configured for same‑origin (empty `NEXT_PUBLIC_*`)
- Secrets: configure `ANTHROPIC_API_KEY` (or `CLAUDE_API_KEY`) in your shell or local `.env`. Never commit secrets.
- Next.js fullstack (this branch): leave `NEXT_PUBLIC_API_BASE` and `NEXT_PUBLIC_WS_BASE` empty to use same‑origin API and Socket.IO at `/ws`.
- Python API (main branch): set
  - `NEXT_PUBLIC_API_BASE=http://localhost:8080`
  - `NEXT_PUBLIC_WS_BASE=ws://localhost:8080`

Convenience
```bash
# Regenerate env files
npm run setup   # or: node scripts/setup-env.js

# Clean and reinstall if things drift
npm run clean && npm install
```

Fresh dev DB (default)
- On `npm run dev`, we start from a fresh SQLite database by default. Any existing `data/cc.db` is removed and Prisma schema is applied automatically.
- To keep your local data, set an env var before running dev:
```bash
export KEEP_DB=1   # or CC_KEEP_DB=1
npm run dev
```
- Manual clean reset (if you disabled auto-clean):
```bash
npm run db:backup   # optional
npm run db:reset    # y to confirm
cd apps/web && npx prisma db push
```

## Desktop App (Electron)

### Download Pre-built App

**macOS Users:** Download the ready-to-use desktop app directly!

- **Apple Silicon (M1/M2/M3):** [Download Claudable-0.1.0-arm64.dmg](https://github.com/opactorai/Claudable/releases/download/v0.1.0/Claudable-0.1.0-arm64.dmg) (292MB)
- **Intel Mac:** [Download Claudable-0.1.0.dmg](https://github.com/opactorai/Claudable/releases/download/v0.1.0/Claudable-0.1.0.dmg) (297MB)

**Installation:**
1. Download the DMG file for your Mac type
2. Open the DMG file
3. Drag Claudable to your Applications folder
4. Launch Claudable from Applications or Launchpad

### Build From Source

Build and distribute a desktop app that bundles the web UI and runs the local API automatically.

```bash
# Build production Next.js and package Electron app
npm run build:desktop

# Output installers
# - macOS: apps/desktop/dist/*.dmg
# - Windows: apps/desktop/dist/*.exe
# - Linux: apps/desktop/dist/*.AppImage
```

Notes:
- First launch will set up a Python virtual environment in your user data folder and install API dependencies (internet required). Subsequent launches are fast and offline.
- The desktop app serves the UI at http://localhost:8080 and proxies /api/* to the local Python API.
- If port 8080 is in use, close the conflicting app before launching the desktop app.

## Setup

### Manual Setup
You can also manually setup the project.
```bash
# Frontend setup
cd apps/web
npm install

# Backend setup
cd ../api
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

The `npm install` command automatically handles the complete setup:

1. **Port Configuration**: Detects available ports and creates `.env` files
2. **Node.js Dependencies**: Installs packages including workspace dependencies
3. **Python Environment**: Creates virtual environment in `apps/api/.venv`
4. **Python Dependencies**: Installs packages using `uv` (if available) or `pip`
5. **Database Setup**: SQLite database auto-creates at `data/cc.db` on first run

### Additional Commands
```bash
npm run db:backup   # Create a backup of your SQLite database
                    # Use when: Before major changes or deployments
                    # Creates: data/backups/cc_backup_[timestamp].db

npm run db:reset    # Reset database to initial state
                    # Use when: Need fresh start or corrupted data
                    # Warning: This will delete all your data!

npm run clean       # Remove all dependencies and virtual environments
                    # Use when: Dependencies conflict or need fresh install
                    # Removes: node_modules/, apps/api/.venv/, package-lock.json
                    # After running: npm install to reinstall everything
```

## Usage

### Getting Started with Development

1. **Connect Claude Code**: Link your Claude Code CLI to enable AI assistance
2. **Describe Your Project**: Use natural language to describe what you want to build
3. **AI Generation**: Watch as the AI generates your project structure and code
4. **Live Preview**: See changes instantly with hot reload functionality
5. **Deploy**: Push to production with Vercel integration

### API Development

Access the interactive API documentation at http://localhost:8080/docs to explore available endpoints and test API functionality.

### Database Operations

Claudable uses SQLite for local development and can be configured for PostgreSQL in production. The database automatically initializes on first run.

## Troubleshooting

### Port Already in Use

The application automatically finds available ports. Check the `.env` file to see which ports were assigned.

### Installation Failures

```bash
# Clean all dependencies and retry
npm run clean
npm install
```

### Permission Errors (macOS/Linux)

If you encounter permission errors:
```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Claude Code Permission Issues (Windows/WSL)

If you encounter the error: `Error output dangerously skip permissions cannot be used which is root sudo privileges for security reasons`

**Solution:**
1. Do not run Claude Code with `sudo` or as root user
2. Ensure proper file ownership in WSL:
   ```bash
   # Check current user
   whoami
   
   # Change ownership of project directory to current user
   sudo chown -R $(whoami):$(whoami) ~/Claudable
   ```
3. If using WSL, make sure you're running Claude Code from your user account, not root
4. Verify Claude Code installation permissions:
   ```bash
   # Reinstall Claude Code without sudo
   npm install -g @anthropic-ai/claude-code --unsafe-perm=false
   ```

## Integration Guide

### GitHub
**Get Token:** [GitHub Personal Access Tokens](https://github.com/settings/tokens) → Generate new token (classic) → Select `repo` scope

**Connect:** Settings → Service Integrations → GitHub → Enter token → Create or connect repository

### Vercel  
**Get Token:** [Vercel Account Settings](https://vercel.com/account/tokens) → Create Token

**Connect:** Settings → Service Integrations → Vercel → Enter token → Create new project for deployment

### Supabase
**Get Credentials:** [Supabase Dashboard](https://supabase.com/dashboard) → Your Project → Settings → API
- Project URL: `https://xxxxx.supabase.co`  
- Anon Key: Public key for client-side
- Service Role Key: Secret key for server-side

## Design Comparison

*Same prompt, different results*

### Claudable
<img src="./assets/Claudable_ex.png" alt="Claudable Design" style="border-radius: 12px; width: 100%;" />

[View Claudable Live Demo →](https://claudable-preview.vercel.app/)

### Lovable
<img src="./assets/Lovable_ex.png" alt="Lovable Design" style="border-radius: 12px; width: 100%;" />

[View Lovable Live Demo →](https://preview--goal-track-studio.lovable.app/)

## License

MIT License.

## Upcoming Features
These features are in development and will be opened soon.
- **New CLI Agents** - Trust us, you're going to LOVE this!
- **Checkpoints for Chat** - Save and restore conversation/codebase states
- **Advanced MCP Integration** - Native integration with MCP
- **Enhanced Agent System** - Subagents, AGENTS.md integration
- **Website Cloning** - You can start a project from a reference URL.
- Various bug fixes and community PR merges

We're working hard to deliver the features you've been asking for. Stay tuned!

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=opactorai/Claudable&type=Date)](https://www.star-history.com/#opactorai/Claudable&Date)