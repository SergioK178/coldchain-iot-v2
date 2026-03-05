# IoT Sensor Platform — Unified API Reference

Этот документ объединяет API-контракты по фазам и показывает, что относится к P1, что к P2, и что является общим актуальным контрактом.

## 1. Как читать документ

- P1 source of truth: `docs/MASTER-SPEC.md`
- P1 OpenAPI: `docs/openapi-p1.json`
- P2 source of truth: `docs/P2/P2-EVOLUTION.md`
- P2 OpenAPI (current implementation draft): `docs/P2/openapi-p2.json`
- Combined актуальный OpenAPI (P1 + P2): `openapi-relevant.json`

## 2. Базовые правила (общие)

- Base URL: `http://{host}:{HTTP_PORT}/api/v1`
- Response envelope:
  - success: `{ "ok": true, "data": ... }`
  - error: `{ "ok": false, "error": { "code": "...", "message": "..." } }`
- `GET /health` публичный.
- Остальные endpoints требуют авторизацию по своему режиму (см. ниже).

## 3. Auth и actor (P1 vs P2)

### P1

- Auth: `Authorization: Bearer {API_TOKEN}`
- `?actor=` — historical P1 behavior (в текущем P2 runtime override отключён для audit integrity).
- Исключение: acknowledge использует `acknowledgedBy` из body.

### P2

- UI auth: JWT access token + refresh token в HTTP-only cookie.
- M2M fallback: `API_TOKEN` (deprecated, но поддерживается).
- Auth endpoints `/auth/login` и `/auth/refresh` защищены rate-limit (429 + `Retry-After`).
- Cookie policy controlled by `AUTH_COOKIE_SECURE` (`true|false|auto`, default `auto`).
- Actor:
  - JWT-запросы: `actor = users.email`
  - API_TOKEN-запросы: `actor = "api_token"`
  - `?actor=` не влияет на audit actor.

## 4. Endpoint-каталог

### 4.1 P1 endpoints (core)

- `GET /health`
- `POST /devices/provision`
- `GET /devices`
- `GET /devices/:serial`
- `PATCH /devices/:serial`
- `DELETE /devices/:serial`
- `GET /devices/:serial/readings`
- `GET /devices/:serial/alert-rules`
- `POST /devices/:serial/alert-rules`
- `PATCH /alert-rules/:id`
- `DELETE /alert-rules/:id`
- `GET /alert-events`
- `PATCH /alert-events/:id/acknowledge`
- `GET /audit-log`

Подробная P1-форма запросов/ответов: `docs/openapi-p1.json`.

### 4.2 P2 new endpoints

#### Auth

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

#### Users

- `GET /users/me`
- `PATCH /users/me/password`
- `POST /users/me/telegram-code` (SHOULD/F4)
- `PATCH /users/me/telegram` (SHOULD/F4)
- `GET /users`
- `POST /users`
- `PATCH /users/:id`
- `DELETE /users/:id`

#### Locations / Zones

- `GET /locations`
- `POST /locations`
- `PATCH /locations/:id`
- `DELETE /locations/:id`
- `GET /locations/:id/zones`
- `POST /locations/:id/zones`
- `PATCH /zones/:id`
- `DELETE /zones/:id`

#### Webhooks

- `GET /webhooks`
- `POST /webhooks`
- `PATCH /webhooks/:id`
- `DELETE /webhooks/:id`
- `GET /webhooks/:id/deliveries`
- `POST /webhooks/:id/test`
- URL policy: только `http/https`, private/local/metadata targets отклоняются.

#### Calibrations (SHOULD/F10)

- `POST /devices/:serial/calibrations`
- `GET /devices/:serial/calibrations`

#### Export (SHOULD/F9)

- `GET /export/readings?deviceSerial=<serial>|locationId=<id>&since=<iso>&until=<iso>&format=csv|pdf`
- Статус: `csv` реализован, `pdf` остаётся backlog.

#### Readings pagination (SHOULD/F11)

- `GET /devices/:serial/readings?limit=<1..100>&cursor=<opaque>&since=<iso>&until=<iso>`
- Ответ list endpoints может содержать top-level `cursor`.

Подробная P2-форма запросов/ответов: `docs/P2/openapi-p2.json`.

## 5. Матрица контрактов

- `docs/openapi-p1.json`: только P1 контракт, замороженный baseline.
- `docs/P2/openapi-p2.json`: только P2-добавления/изменения.
- `openapi-relevant.json`: объединённый актуальный контракт для текущей кодовой базы (P1 + P2).

## 6. Совместимость

- P1 endpoints сохранены в P2.
- Envelope остаётся совместимым.
- Для P2 может появляться additive поле `cursor` в list endpoints (где включена пагинация).
