# Claudable Cloud — workspace container image.
# A complete, isolated coding environment for ONE project. The orchestration
# backend starts one container per project and execs headless Claude Code in it.
#
# ANTHROPIC_API_KEY is injected at `docker run` time (never baked in).
FROM node:20-bookworm-slim

# Pin tool versions for reproducibility.
ARG CLAUDE_CODE_VERSION=latest
ARG PNPM_VERSION=9.12.0

# System build tools + git. Keep the layer lean.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       git ca-certificates curl python3 build-essential tini \
  && rm -rf /var/lib/apt/lists/*

# Package managers + Claude Code (global).
RUN corepack enable \
  && corepack prepare pnpm@${PNPM_VERSION} --activate \
  && npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
  && npm cache clean --force

# Non-root user. Claude Code must never run as root.
RUN useradd --create-home --shell /bin/bash coder \
  && mkdir -p /workspace \
  && chown -R coder:coder /workspace

USER coder
WORKDIR /workspace

# Claude Code reads ANTHROPIC_API_KEY from the environment at runtime.
ENV NODE_ENV=development \
    CI=1 \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

# Expose the dev-server port range used by live preview (Phase B1).
EXPOSE 3000-3010

# tini reaps zombies; the long-sleep keeps the container alive so the backend
# can `docker exec` multiple Claude Code turns into it.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "echo 'workspace ready' && tail -f /dev/null"]
