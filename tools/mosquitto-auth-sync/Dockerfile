# syntax=docker/dockerfile:1.7
# Mosquitto + auth-sync — только db и mosquitto-auth-sync
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
ENV PNPM_STORE_DIR=/pnpm/store

WORKDIR /app

# Манифесты
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY tools/mosquitto-auth-sync/package.json tools/mosquitto-auth-sync/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

COPY packages/shared/ packages/shared/
COPY packages/db/ packages/db/
COPY tools/mosquitto-auth-sync/ tools/mosquitto-auth-sync/

RUN pnpm --filter @sensor/shared build && \
    pnpm --filter @sensor/db build && \
    pnpm --filter @sensor/mosquitto-auth-sync build

# --- Runner (с Mosquitto) ---
FROM node:22-alpine AS runner

RUN apk add --no-cache mosquitto ca-certificates

WORKDIR /app

COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/shared/dist packages/shared/dist/
COPY --from=builder /app/packages/shared/node_modules packages/shared/node_modules/
COPY --from=builder /app/packages/db/package.json packages/db/
COPY --from=builder /app/packages/db/dist packages/db/dist/
COPY --from=builder /app/packages/db/node_modules packages/db/node_modules/
COPY --from=builder /app/tools/mosquitto-auth-sync/package.json tools/mosquitto-auth-sync/
COPY --from=builder /app/tools/mosquitto-auth-sync/dist tools/mosquitto-auth-sync/dist/
COPY --from=builder /app/tools/mosquitto-auth-sync/node_modules tools/mosquitto-auth-sync/node_modules/
COPY --from=builder /app/tools/mosquitto-auth-sync/mosquitto.conf tools/mosquitto-auth-sync/mosquitto.conf

ENV MOSQUITTO_CONF=/app/tools/mosquitto-auth-sync/mosquitto.conf
ENV MOSQUITTO_DATA_DIR=/data
ENV RELOAD_PORT=9080

EXPOSE 1883 9080

CMD ["node", "tools/mosquitto-auth-sync/dist/index.js"]
