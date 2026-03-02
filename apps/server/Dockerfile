FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/server/package.json apps/server/
COPY ui/package.json ui/

RUN pnpm install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY packages/db/ packages/db/
COPY apps/server/ apps/server/
COPY ui/ ui/

RUN pnpm --filter @sensor/shared build && \
    pnpm --filter @sensor/db build && \
    pnpm --filter @sensor/server build && \
    pnpm --filter @sensor/ui build

# --- Runner ---
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/shared/dist packages/shared/dist/
COPY --from=builder /app/packages/db/package.json packages/db/
COPY --from=builder /app/packages/db/dist packages/db/dist/
COPY --from=builder /app/packages/db/migrations packages/db/migrations/
COPY --from=builder /app/apps/server/package.json apps/server/
COPY --from=builder /app/apps/server/dist apps/server/dist/
COPY --from=builder /app/ui/dist ui/dist/

RUN pnpm install --frozen-lockfile --prod

EXPOSE 8080

CMD ["node", "apps/server/dist/index.js"]
