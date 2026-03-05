# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
ENV PNPM_STORE_DIR=/pnpm/store

WORKDIR /app

# Copy manifests first for layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/server/package.json apps/server/
COPY ui/package.json ui/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/db/ packages/db/
COPY apps/server/ apps/server/
COPY ui/ ui/

# Build all
RUN pnpm --filter @sensor/shared build && \
    pnpm --filter @sensor/db build && \
    pnpm --filter @sensor/server build && \
    pnpm --filter @sensor/ui build

# Prune dev dependencies
RUN pnpm prune --prod

# --- Runner ---
FROM node:22-alpine AS runner

WORKDIR /app

# Copy built artifacts + production node_modules
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/shared/dist packages/shared/dist/
COPY --from=builder /app/packages/shared/node_modules packages/shared/node_modules/
COPY --from=builder /app/packages/db/package.json packages/db/
COPY --from=builder /app/packages/db/dist packages/db/dist/
COPY --from=builder /app/packages/db/node_modules packages/db/node_modules/
COPY --from=builder /app/packages/db/migrations packages/db/migrations/
COPY --from=builder /app/apps/server/package.json apps/server/
COPY --from=builder /app/apps/server/dist apps/server/dist/
COPY --from=builder /app/apps/server/node_modules apps/server/node_modules/
COPY --from=builder /app/ui/dist ui/dist/

EXPOSE 8080

CMD ["node", "apps/server/dist/index.js"]
