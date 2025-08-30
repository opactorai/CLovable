# multi-stage build for claudable app
FROM node:20-alpine AS base

# install python and dependencies
RUN apk add --no-cache python3 py3-pip python3-dev build-base git

# set working directory
WORKDIR /app

# copy package files and scripts
COPY package*.json ./
COPY scripts ./scripts
COPY apps/web/package*.json ./apps/web/
COPY apps/api/requirements.txt ./apps/api/

# install node dependencies without running postinstall
RUN npm ci --only=production --ignore-scripts

# build stage for next.js
FROM base AS builder
WORKDIR /app
COPY . .

# install all dependencies for build
RUN npm ci --ignore-scripts
WORKDIR /app/apps/web
RUN npm ci

# build next.js app
WORKDIR /app/apps/web
RUN npm run build

# production stage
FROM node:20-alpine AS runner
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# copy built application
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./apps/web/.next
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/package*.json ./apps/web/
COPY --from=builder --chown=nextjs:nodejs /app/apps/api ./apps/api
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# install production dependencies
RUN npm ci --only=production
WORKDIR /app/apps/web
RUN npm ci --only=production

# setup python environment
WORKDIR /app/apps/api
RUN python3 -m venv .venv && \
    .venv/bin/pip install --no-cache-dir -r requirements.txt

# create data directory for sqlite
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs

# expose ports
EXPOSE 3000 8080

# environment variables
ENV NODE_ENV=production \
    ANTHROPIC_API_KEY="" \
    NEXT_PUBLIC_API_URL=http://localhost:8080 \
    API_HOST=0.0.0.0 \
    API_PORT=8080 \
    WEB_PORT=3000

# start both services
WORKDIR /app
CMD ["sh", "-c", "cd /app/apps/api && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8080 & cd /app/apps/web && npm start"]