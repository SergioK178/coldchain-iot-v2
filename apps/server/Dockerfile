# syntax=docker/dockerfile:1.7
# Server — только shared, db, server
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
ENV PNPM_STORE_DIR=/pnpm/store

WORKDIR /app

# Манифесты (слой кэшируется при неизменных зависимостях)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/server/package.json apps/server/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

# Исходники (пересборка только при изменении кода)
COPY packages/shared/ packages/shared/
COPY packages/db/ packages/db/
COPY apps/server/ apps/server/

RUN pnpm --filter @sensor/shared build && \
    pnpm --filter @sensor/db build && \
    pnpm --filter @sensor/server build

RUN pnpm prune --prod

# --- Runner ---
FROM node:22-alpine AS runner

WORKDIR /app

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

EXPOSE 8080

CMD ["node", "apps/server/dist/index.js"]
