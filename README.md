# Claudable

<img src="https://storage.googleapis.com/claudable-assets/Claudable.png" alt="Claudable" style="width: 100%;" />
<div align="center">
<h3>Connect CLI Agent • Build what you want • Deploy instantly</h3>

<p>Available as a web service at <a href="https://clink.new">clink.new</a></p>
</div>
<p align="center">
<a href="https://discord.gg/NJNbafHNQC">
<img src="https://img.shields.io/badge/Discord-Join%20Community-7289da?style=flat&logo=discord&logoColor=white" alt="Join Discord Community">
</a>
<a href="https://clink.new">
<img src="https://img.shields.io/badge/Clink-Web%20Service-000000?style=flat&logo=web&logoColor=white" alt="Clink Web Service">
</a>
<a href="https://twitter.com/aaron_xong">
<img src="https://img.shields.io/badge/Follow-@aaron__xong-000000?style=flat&logo=x&logoColor=white" alt="Follow Aaron">
</a>
</p>

## What is Claudable?

Claudable is a powerful Next.js-based web app builder that combines **C**laude Code's (Cursor CLI also supported!) advanced AI agent capabilities with **Lovable**'s simple and intuitive app building experience. Just describe your app idea - "I want a task management app with dark mode" - and watch as Claudable instantly generates the code and shows you a live preview of your working app. You can deploy your app to Vercel and integrate database with Supabase for free.

This open-source project empowers you to build and deploy professional web applications easily for **free**.

How to start? Simply login to Claude Code (or Cursor CLI), start Claudable, and describe what you want to build. That's it. There is no additional subscription cost for app builder.

## Try Clink - Web Service
<div align="center">
<a href="https://clink.new">
<img src="https://storage.googleapis.com/claudable-assets/clink.png" alt="Clink - Link, Click, Ship" style="width: 100%; max-width: 800px;">
</a>
<p>Don't want to set up locally? Try <a href="https://clink.new"><strong>Clink</strong></a> - the web-based version with instant access!</p>
</div>

## Features
<img src="https://storage.googleapis.com/claudable-assets/gif/Claudable_v2_cc_4_1080p.gif" alt="Claudable Demo" style="width: 100%; max-width: 800px;">

- **Powerful Agent Performance**: Leverage the full power of Claude Code and Cursor CLI Agent capabilities
- **Natural Language to Code**: Simply describe what you want to build, and Claudable generates production-ready Next.js code
- **Instant Preview**: See your changes immediately with hot-reload as AI builds your app
- **Zero Setup, Instant Launch**: No complex sandboxes, no API key, no database headaches - just start building immediately
- **Beautiful UI**: Generate beautiful UI with Tailwind CSS and shadcn/ui
- **Deploy to Vercel**: Push your app live with a single click, no configuration needed
- **GitHub Integration**: Automatic version control and continuous deployment setup
- **Supabase Database**: Connect production PostgreSQL with authentication ready to use

## Demo Examples

### Codex CLI Example
<img src="https://storage.googleapis.com/claudable-assets/gif/Claudable_v2_codex_1_1080p.gif" alt="Codex CLI Demo" style="width: 100%; max-width: 800px;">

### Qwen Code Example
<img src="https://storage.googleapis.com/claudable-assets/gif/Claudable_v2_qwen_1_1080p.gif" alt="Qwen Code Demo" style="width: 100%; max-width: 800px;">

## Supported AI Coding Agents

Claudable supports multiple AI coding agents, giving you the flexibility to choose the best tool for your needs:

- **Claude Code** - Anthropic's advanced AI coding agent
- **Codex CLI** - OpenAI's lightweight coding agent
- **Cursor CLI** - Powerful multi-model AI agent
- **Qwen Code** - Alibaba's open-source coding CLI
- **GLM CLI** - Zhipu AI's open-source coding agent

### Claude Code (Recommended)
**[Claude Code](https://docs.anthropic.com/en/docs/claude-code/setup)** - Anthropic's advanced AI coding agent with Claude Opus 4.1
- **Features**: Deep codebase awareness, Unix philosophy, direct terminal integration
- **Context**: Native 256K tokens
- **Pricing**: Requires Anthropic API key or Claude Pro subscription
- **Installation**:
  ```bash
  npm install -g @anthropic-ai/claude-code
  claude  # then > /login
  ```

### Codex CLI
**[Codex CLI](https://github.com/openai/codex)** - OpenAI's lightweight coding agent with GPT-5 support
- **Features**: High reasoning capabilities, local execution, multiple operating modes (interactive, auto-edit, full-auto)
- **Context**: Varies by model
- **Pricing**: Included with ChatGPT Plus/Pro/Business/Edu/Enterprise plans
- **Installation**:
  ```bash
  npm install -g @openai/codex
  codex  # login with ChatGPT account
  ```

### Cursor CLI
**[Cursor CLI](https://cursor.com/en/cli)** - Powerful AI agent with access to cutting-edge models
- **Features**: Multi-model support (Anthropic, OpenAI, Gemini), AGENTS.md support
- **Context**: Model dependent
- **Pricing**: Free tier available, Pro plans for advanced features
- **Installation**:
  ```bash
  curl https://cursor.com/install -fsS | bash
  cursor-agent login
  ```

### Qwen Code
**[Qwen Code](https://github.com/QwenLM/qwen-code)** - Alibaba's open-source CLI for Qwen3-Coder models
- **Features**: 256K-1M token context, multiple model sizes (0.5B to 480B), Apache 2.0 license
- **Context**: 256K native, 1M with extrapolation
- **Pricing**: Completely free and open-source
- **Installation**:
  ```bash
  npm install -g @qwen-code/qwen-code@latest
  qwen --version
  ```

### GLM CLI
**[GLM CLI](https://github.com/THUDM/GLM-4)** - Zhipu AI's open-source coding agent with GLM-4 models
- **Features**: Strong reasoning capabilities, code generation and understanding, bilingual support (Chinese/English)
- **Context**: 128K tokens
- **Pricing**: Free tier available, API key required for advanced usage
- **Installation**:
  ```bash
  npm install -g @zhipuai/glm-cli
  glm --version
  ```

## Technology Stack

**Database & Deployment:**
- **[Supabase](https://supabase.com/)**: Connect production-ready PostgreSQL database directly to your project.
- **[Vercel](https://vercel.com/)**: Publish your work immediately with one-click deployment

**There is no additional subscription cost and built just for YOU.**

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js 18+
- Claude Code or Cursor CLI (already logged in)
- Git

## Quick Start

Get Claudable running on your local machine in minutes:

```bash
# Clone the repository
git clone https://github.com/opactorai/Claudable.git
cd Claudable

# Install all dependencies
npm install

# Start development server
npm run dev
```

Your application will be available at http://localhost:3000

**Note**: Ports are automatically detected. If the default port is in use, the next available port will be assigned.

## Setup

The `npm install` command automatically handles the complete setup:

1. **Port Configuration**: Detects available ports and creates `.env` files
2. **Dependencies**: Installs all required Node.js packages
3. **Database Setup**: SQLite database auto-creates at `data/cc.db` on first run

### Additional Commands
```bash
npm run db:backup   # Create a backup of your SQLite database
                    # Use when: Before major changes or deployments
                    # Creates: data/backups/cc_backup_[timestamp].db

npm run db:reset    # Reset database to initial state
                    # Use when: Need fresh start or corrupted data
                    # Warning: This will delete all your data!

npm run clean       # Remove all dependencies
                    # Use when: Dependencies conflict or need fresh install
                    # Removes: node_modules/, package-lock.json
                    # After running: npm install to reinstall everything
```

## Usage

### Getting Started with Development

1. **Connect Claude Code**: Link your Claude Code CLI to enable AI assistance
2. **Describe Your Project**: Use natural language to describe what you want to build
3. **AI Generation**: Watch as the AI generates your project structure and code
4. **Live Preview**: See changes instantly with hot reload functionality
5. **Deploy**: Push to production with Vercel integration

### Database Operations

Claudable uses SQLite for local development. The database automatically initializes on first run.

## Troubleshooting

### Port Already in Use

The application automatically finds available ports. Check the `.env` file to see which ports were assigned.

### Installation Failures

```bash
# Clean all dependencies and retry
npm run clean
npm install
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


## License

MIT License.

## Upcoming Features
These features are in development and will be opened soon.
- **New CLI Agents** - Trust us, you're going to LOVE this!
- **Native MCP Support** - Model Context Protocol integration for enhanced agent capabilities
- **Checkpoints for Chat** - Save and restore conversation/codebase states
- **Enhanced Agent System** - Subagents, AGENTS.md integration
- **Website Cloning** - You can start a project from a reference URL.
- Various bug fixes and community PR merges

We're working hard to deliver the features you've been asking for. Stay tuned!

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=opactorai/Claudable&type=Date)](https://www.star-history.com/#opactorai/Claudable&Date)
