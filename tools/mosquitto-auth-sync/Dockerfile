FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends mosquitto ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN corepack enable pnpm && pnpm install --no-frozen-lockfile --prefer-offline

RUN pnpm --filter @sensor/db build && pnpm --filter @sensor/mosquitto-auth-sync build

ENV MOSQUITTO_CONF=/app/tools/mosquitto-auth-sync/mosquitto.conf
ENV MOSQUITTO_DATA_DIR=/data
ENV RELOAD_PORT=9080

EXPOSE 1883 9080

CMD ["node", "tools/mosquitto-auth-sync/dist/index.js"]
