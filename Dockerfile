# syntax=docker/dockerfile:1.7
#
# FieldRunner — single-image production build.
#   1. `builder` : install all deps, build the Vite client (dist/) and tsx-run
#                  the server directly from .ts sources (no separate emit).
#   2. `runtime` : minimal Node 22 image, prod deps + tsx, ships dist/ +
#                  server/ + src/shared. Express serves both API and the
#                  built client on a single port (3001).
#
# Build:  docker build -t fieldrunner:local .
# Run:    docker run --rm -p 3001:3001 fieldrunner:local
# Health: curl http://localhost:3001/api/health

ARG NODE_VERSION=22-bookworm-slim

# ---------- builder ----------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

# Install all deps (incl. devDeps) for the build.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Bring in the rest of the source and build the client.
COPY . .
RUN npm run build

# ---------- runtime ----------
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    NPM_CONFIG_LOGLEVEL=warn
WORKDIR /app

# Production deps only, then add tsx (used to run the server's .ts files
# directly — no separate tsc emit needed). --no-save keeps package.json clean.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev \
 && npm install --no-save tsx@4.19.2 \
 && npm cache clean --force

# Pull in the artifacts we need at runtime.
COPY --from=builder /app/dist      ./dist
COPY --from=builder /app/server    ./server
COPY --from=builder /app/src       ./src
COPY --from=builder /app/public    ./public

# Drop privileges. The `node` user/group already exists in the base image.
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["./node_modules/.bin/tsx", "server/index.ts"]
