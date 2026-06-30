# Claudable Cloud — orchestration backend image.
#
# Supports two execution modes (WORKSPACE_MODE):
#   docker  — manages sibling workspace containers via the host Docker socket
#             (mounted at runtime via docker-compose on a VM).
#   process — runs Claude Code as a subprocess in THIS container (Railway/Render),
#             dropping each child to the non-root `coder` user. This image bundles
#             Claude Code + git + build tools so that mode works out of the box.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Tooling needed when WORKSPACE_MODE=process: git + native build deps + tini.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       git ca-certificates curl python3 build-essential tini \
  && rm -rf /var/lib/apt/lists/*

# Claude Code + package managers, available on PATH for spawned children.
ARG CLAUDE_CODE_VERSION=latest
RUN corepack enable \
  && npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
  && npm cache clean --force

# Claude Code child processes run as the base image's existing non-root `node`
# user (uid/gid 1000, home /home/node) — Claude Code refuses to run as root.

# Backend production deps.
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# Defaults for PaaS (Railway): in-process execution, workspaces on a mounted volume.
ENV WORKSPACE_MODE=process \
    WORKSPACES_ROOT=/data/workspaces \
    WORKSPACE_RUN_HOME=/home/node \
    PORT=8080

# The backend runs as root so it can chown workspace dirs and drop privileges for
# child Claude Code processes. Children never run as root.
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
