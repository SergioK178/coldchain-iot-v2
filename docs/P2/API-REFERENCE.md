# P2 API Reference

Этот документ описывает P2-контракт поверх P1.
P1 baseline (archive): `docs/archive/openapi-p1.json`.
P2 OpenAPI: `docs/P2/openapi-p2.json`.
Combined актуальный OpenAPI: `docs/openapi.json`.

## Auth model (P2)

- UI path: login/refresh/logout через `POST /api/v1/auth/*`
- Access token: Bearer JWT (short TTL)
- Refresh token: HTTP-only cookie (`refreshToken`)
- Auth endpoints (`/auth/login`, `/auth/refresh`) защищены rate-limit; при превышении возвращается `429` и `Retry-After`.
- Cookie policy controlled by `AUTH_COOKIE_SECURE` (`true|false|auto`, default `auto`).

## New endpoint groups

### Auth

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

### Users (admin)

- `GET /api/v1/users`
- `POST /api/v1/users`
- `PATCH /api/v1/users/:id`
- `DELETE /api/v1/users/:id`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me/password`
- `POST /api/v1/users/me/telegram-code` (JWT only)
- `PATCH /api/v1/users/me/telegram` (JWT only, unlink via `telegramChatId: null`)

### Locations / Zones

- `GET /api/v1/locations`
- `POST /api/v1/locations` (admin)
- `PATCH /api/v1/locations/:id` (admin)
- `DELETE /api/v1/locations/:id` (admin)
- `GET /api/v1/locations/:id/zones`
- `POST /api/v1/locations/:id/zones` (admin)
- `PATCH /api/v1/zones/:id` (admin)
- `DELETE /api/v1/zones/:id` (admin)

### Webhooks

- `GET /api/v1/webhooks` (admin)
- `POST /api/v1/webhooks` (admin)
- `PATCH /api/v1/webhooks/:id` (admin)
- `DELETE /api/v1/webhooks/:id` (admin)
- `GET /api/v1/webhooks/:id/deliveries` (admin)
- `POST /api/v1/webhooks/:id/test` (admin)
- Webhook URL policy:
  - only `http/https`;
  - localhost/private/link-local/metadata targets are rejected;
  - redirects are not followed in delivery (`redirect: error`).

### Calibrations (SHOULD/F10)

- `POST /api/v1/devices/:serial/calibrations` (admin/operator)
- `GET /api/v1/devices/:serial/calibrations`

### Device MQTT credential rotation

- `POST /api/v1/devices/:serial/rotate-mqtt` (admin)
- Возвращает новые credentials в `data.mqtt` (plaintext показывается один раз).

### Cursor pagination (SHOULD/F11)

- `GET /api/v1/devices/:serial/readings?limit=<1..100>&cursor=<opaque>&since=<iso>&until=<iso>`
- Ответ: `{ ok: true, data: [...], cursor: string | null }`
- По текущей реализации cursor-вариант включён для readings.

### Export (SHOULD/F9)

- `GET /api/v1/export/readings?deviceSerial=<serial>|locationId=<id>&since=<iso>&until=<iso>&format=csv|pdf`
- Current status:
  - `format=csv` — implemented (production-ready)
  - `format=pdf` — not implemented yet (returns validation error)

## Actor rules (P2)

- JWT requests: actor = `users.email`
- `?actor=` не влияет на audit actor

## P1 compatibility

- P1 endpoints сохранены
- Envelope остаётся `{ ok, data } | { ok, error }`
- Для paginated endpoints может добавляться `cursor` (additive)
