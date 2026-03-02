# Sensor Platform

IoT Sensor Platform for cold chain monitoring.

See [MASTER-SPEC.md](docs/MASTER-SPEC.md) for full specification.

## Development

```bash
pnpm install
pnpm build
```

## Deploy

```bash
cd deploy
cp .env.example .env
# fill in .env
docker compose up -d
```
