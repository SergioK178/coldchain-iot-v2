# syntax=docker/dockerfile:1.7
# Web app — только apps/web, без shared/db/server
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
ENV PNPM_STORE_DIR=/pnpm/store

WORKDIR /app

# Манифесты workspace (pnpm требует полную структуру)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/

# pnpm store cache (требует DOCKER_BUILDKIT=1)
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

# Только исходники web (shared/db не нужны — web standalone)
COPY apps/web/ apps/web/

# Next.js build cache для ускорения пересборок (DOCKER_BUILDKIT=1)
RUN --mount=type=cache,target=/app/apps/web/.next/cache \
    pnpm --filter @sensor/web run build

# --- Runner ---
FROM node:22-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/apps/web apps/web/

# Для /docs/hardware-provisioning (читает из ../../deploy/docs)
COPY deploy/docs deploy/docs

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
