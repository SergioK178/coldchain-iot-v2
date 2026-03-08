

# P2-EVOLUTION.md

## IoT Sensor Platform — P2 Architecture / Evolution Spec

**Статус:** FROZEN — source of truth для P2 (F6 зафиксирован и реализован через sidecar `mosquitto-auth-sync`)
**Привязка:** archive/MASTER-SPEC.md v3.1 (P1), фактическая реализация P1
**Scope:** Только P2. Всё за пределами P2 — в разделе Not In P2.

---

## 1. Цель P2

Превратить работающий пилотный прототип (P1) в продукт, который можно тиражировать на десятки инсталляций без ручного сопровождения каждой.

**Критерии завершения P2:**

1. На инсталляции могут работать несколько операторов с разными правами, через логин/пароль
2. Оператор работает через полноценный UI (навигация, графики, управление зонами), а не через curl
3. Интегратор подписывается на события через webhook с retry и HMAC-подписью
4. Установка нового датчика возможна через UI-форму (manual provisioning), без curl
5. Mosquitto auth не зависит от docker.sock
6. Каждый релиз проходит автоматическую проверку (CI pipeline)

**Примечание:** QR-onboarding (F8b), CSV/PDF export (F9), calibration records (F10), pagination (F11), HTTPS/Caddy (F12) остаются SHOULD-треком и не блокируют формальное закрытие P2.

---

## 2. Инварианты из P1

Нижеперечисленное не ломаем в P2. Исключения явно помечены.

| # | Инвариант | P2 статус |
|---|---|---|
| 1 | Self-hosted / local-first. Никаких внешних облачных зависимостей | Сохраняется. Telegram-бот (если включён) — единственное допущенное исключение: исходящий трафик к api.telegram.org |
| 2 | Один `docker compose up` поднимает всё | Сохраняется. Новые контейнеры (web, опционально caddy) поднимаются тем же compose |
| 3 | Fastify — основной серверный процесс для business logic и API | Сохраняется. **P2-расширение:** отдельный UI runtime (Next.js, контейнер `web`) разрешён как presentation layer. Business logic и API остаются только в Fastify. Next.js не дублирует сервисный слой |
| 4 | PostgreSQL + TimescaleDB — единственная БД | Сохраняется |
| 5 | Mosquitto как MQTT broker | Сохраняется |
| 6 | Payload contract v1 (`DevicePayloadSchema`, `v=1`) | Сохраняется. Firmware P1 работает без изменений |
| 7 | MQTT topic scheme (`d/{serial}/t`, `d/{serial}/s`) | Сохраняется |
| 8 | Serial как device identity (`SENS-{TYPE}-{NNNNN}`) | Сохраняется |
| 9 | Audit log append-only | Сохраняется |
| 10 | API response envelope: `{ ok, data }` / `{ ok, error }` | Сохраняется. **P2-уточнение:** paginated endpoints добавляют top-level поле `cursor` рядом с `data`. Это additive расширение envelope, не breaking change. Формат: `{ ok: true, data: [...], cursor: "..." \| null }` |
| 11 | Bind mounts для данных (`./data/`) | Сохраняется. Все новые stateful компоненты (caddy) тоже используют bind mounts |
| 12 | Domain hierarchy: Organization → Location → Zone → Device | Сохраняется |

---

## 3. Ограничения P1, которые снимаем

| # | Ограничение P1 | Проблема | P2 решение |
|---|---|---|---|
| L1 | Один статический bearer token | Нельзя различить операторов, нельзя отозвать доступ | Auth с users и roles (F1) |
| L2 | UI — одна таблица, без истории | Нет динамики, нет диагностики, нет ХАССП-отчёта | Next.js UI с графиками и экспортом (F2, F9) |
| L3 | Только HTTP callback, без retry | Потерянный callback = пропущенная тревога | Webhook engine v2 (F5) |
| L4 | Provisioning только через curl/CLI | Установщик на объекте должен знать curl | UI provisioning form (F8a), QR как optional ускоритель (F8b) |
| L5 | Location/Zone — только seed, нет CRUD | Нельзя добавить зону без прямого SQL | CRUD API + UI (F3) |
| L6 | docker.sock mount для Mosquitto reload | Привилегированный доступ, не работает в rootless/Podman | Internal sidecar auth-sync без docker.sock (F6) |
| L7 | Calibration — только offset поле | Нет истории, нет доказательности для проверок | Calibration records (F10) |
| L8 | Нет CI/CD | Ручная сборка и деплой | GitHub Actions (F7) |
| L9 | Нет HTTPS | Проблема при удалённом доступе | Caddy (F12, опционально) |
| L10 | Нет пагинации | Неконтролируемый размер ответов | Cursor-based pagination (F11) |

---

## 4. P2 Shortlist

### MUST

| ID | Фича | Снимает | Объём |
|---|---|---|---|
| F1 | Auth: users, login, JWT, roles (admin/operator/viewer) | L1 | M |
| F2 | UI: Next.js, device detail, графики (Recharts), навигация | L2 | L |
| F3 | Locations/Zones CRUD (API + UI) | L5 | S |
| F5 | Webhook engine v2 (retry, HMAC-SHA256, multiple URLs, delivery log) | L3 | M |
| F6 | Mosquitto auth без docker.sock (sidecar `mosquitto-auth-sync`) | L6 | M |
| F7 | CI/CD (GitHub Actions) | L8 | S |
| F8a | Manual provisioning form in UI | L4 | S |

### SHOULD

| ID | Фича | Снимает | Объём |
|---|---|---|---|
| F4 | Telegram-бот уведомлений | L3 (дополнительный канал) | M |
| F8b | QR onboarding (надстройка над manual form) | L4 | S |
| F9 | CSV/PDF export для ХАССП | L2 | M |
| F10 | Calibration records (отдельная таблица, история, audit) | L7 | S |
| F11 | Cursor-based pagination | L10 | S |
| F12 | HTTPS через Caddy (опциональный контейнер) | L9 | S |

### NOT IN P2

| Фича | Почему |
|---|---|
| Multi-tenant | Один инстанс = одна организация, нет давления |
| Cloud SaaS / hosted | Стратегически отложено до P3+ |
| SDK npm-пакет | OpenAPI + curl достаточно |
| SDK Python/Go | Нет интеграторов |
| OTA firmware | Firmware team стабилизирует прошивку |
| White-label | Нет B2B-партнёров |
| Коннекторы iiko/1С | Нет конкретных запросов |
| Kubernetes | Docker Compose покрывает масштаб |
| Billing | Self-hosted, нет подписки |
| Anomaly detection / ML | Нет объёма данных |
| Redis | Webhook retry и очереди на PostgreSQL (polling). Если spike S2 покажет проблему — пересмотреть |
| MQTT over TLS | Датчики в LAN. Если появится конкретный запрос от пилота — отдельное решение |

---

## 5. Resolved Decisions

Все развилки закрыты. Ниже — финальные решения.

| # | Вопрос | Решение | Обоснование |
|---|---|---|---|
| D1 | Telegram-бот: часть server или отдельный контейнер? | **Часть server (Fastify process)** | Проще deploy, доступ к БД и сервисам без IPC. Telegram Bot API polling не конфликтует с Fastify |
| D2 | Next.js: один порт (через Caddy) или два? | **Два порта по умолчанию. Caddy опционален (profile `https`)** | Не навязываем лишний контейнер для LAN. Клиент может использовать Caddy если хочет единую точку входа или HTTPS |
| D3 | Первый admin: env seed или UI wizard? | **Env seed only** (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) | Консистентно с P1 моделью (всё через env). Wizard — лишняя ветка кода с edge cases |
| D4 | Auth transport for API calls | **JWT-only** for all authenticated API requests in P2 runtime |
| D5 | MQTT over TLS | **Не входит в P2** | Только если появится конкретный запрос от пилота |
| D6 | Mosquitto auth mechanism | **Final: sidecar `mosquitto-auth-sync` (implemented).** `server` использует `MOSQUITTO_RELOAD_URL`, docker.sock не используется |
| D7 | Refresh token storage | **HTTP-only cookie. Hash хранится в БД (таблица `refresh_tokens`)** | Безопаснее чем localStorage. Стандартный паттерн |
| D8 | Password hashing | **argon2id** | Рекомендован OWASP. `argon2` npm package |
| D9 | Webhook secret policy | **Secret обязателен для каждого webhook.** `webhooks.secret` NOT NULL, все доставки подписываются HMAC | Единообразие: все webhooks всегда подписаны. Нет nullable secret |
| D10 | Auth/cookie topology при split-origin (`:3000` + `:8080`) | **Вариант A (фиксировано): Next.js (`web`) — auth gateway для браузера.** Браузер работает с auth только через UI-origin (`:3000` или Caddy same-origin), а `web` route handlers/server actions проксируют auth-запросы в Fastify `/api/v1/auth/*` по внутренней сети | Явно фиксирует владельца refresh-cookie и устраняет неоднозначность при двух портах |

---

## 6. Изменения по блокам

### 6.1 Auth и roles (F1)

**Новые таблицы:**

```
users
  id              uuid PK
  email           varchar(255) UNIQUE NOT NULL
  passwordHash    varchar(255) NOT NULL        — argon2id
  name            varchar(255)
  role            varchar(20) NOT NULL          — 'admin' | 'operator' | 'viewer'
  telegramChatId  varchar(50)                   — nullable, заполняется при привязке Telegram (F4/SHOULD)
  createdAt       timestamptz DEFAULT now()

refresh_tokens
  id              uuid PK
  userId          uuid FK → users ON DELETE CASCADE
  tokenHash       varchar(255) NOT NULL
  expiresAt       timestamptz NOT NULL
  createdAt       timestamptz DEFAULT now()
  INDEX (userId)
```

**Auth flow:**

1. `POST /auth/login` → email + password → verify argon2id → issue JWT access token (15 min TTL) + refresh token (HTTP-only cookie, 7 day TTL, hash в БД)
2. `POST /auth/refresh` → refresh token из cookie → verify hash → issue new access + rotate refresh token
3. `POST /auth/logout` → delete refresh token из БД

**Runtime topology (mandatory for split-origin mode):**

- Browser auth-flow идёт через `web` origin (`:3000`): `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout` (Next.js route handlers / server actions).
- Next.js проксирует эти запросы в Fastify `/api/v1/auth/*` по внутренней Docker-сети (`server:8080`).
- Fastify остаётся source of truth для auth-логики и токенов; Next.js не дублирует auth domain model.
- Прямой browser путь с refresh-cookie к `:8080` в split-origin режиме не является целевым контрактом.

**Refresh cookie contract:**

- `HttpOnly=true`
- `SameSite=Lax`
- `Path=/`
- `Secure=true` при HTTPS (Caddy), `Secure=false` только в локальном HTTP dev/LAN
- TTL: 7 дней

**CSRF policy:**

- Refresh/logout выполняются только через same-origin UI-route handlers.
- Для cross-origin browser вызовов auth endpoints доступ закрывается CORS-политикой.

**JWT payload:** `{ sub: userId, email, role, iat, exp }`

**Fastify auth plugin resolution order:**
1. `Authorization: Bearer <JWT>` → verify JWT → extract user
2. Neither → 401

**Actor resolution (replaces P1 `?actor=` mechanism):**
- JWT requests: `actor = users.email`
- `?actor=` query parameter does not affect audit actor

**Role enforcement:**

| Action | admin | operator | viewer |
|---|---|---|---|
| Manage users | ✓ | – | – |
| Provision / decommission devices | ✓ | – | – |
| Manage locations / zones | ✓ | – | – |
| Configure webhooks | ✓ | – | – |
| Create / edit / delete alert rules | ✓ | ✓ | – |
| Acknowledge alerts | ✓ | ✓ | – |
| View devices, readings, alerts, audit | ✓ | ✓ | ✓ |
| Export CSV/PDF | ✓ | ✓ | ✓ |

**Seed:** server при старте: если `users` пуста и env `ADMIN_EMAIL` + `ADMIN_PASSWORD` заданы → создать admin user. Если `users` пуста и env не задан → log warning, login disabled until admin credentials are set.

**New API endpoints:**

```
POST   /api/v1/auth/login              → { accessToken }  + Set-Cookie: refreshToken
POST   /api/v1/auth/refresh            → { accessToken }  + Set-Cookie: refreshToken (rotated)
POST   /api/v1/auth/logout             → clear cookie, delete refresh token
GET    /api/v1/users                   → list (admin)
POST   /api/v1/users                   → create (admin)
PATCH  /api/v1/users/:id               → update role, name (admin)
DELETE /api/v1/users/:id               → delete (admin, cannot delete self)
GET    /api/v1/users/me                → current user
PATCH  /api/v1/users/me/password       → change own password
```

### 6.2 Locations / Zones CRUD API (F3)

**Снимает ограничение L5.** В P1 location/zone создавались seed, CRUD API не было.
Organization остаётся single-tenant инвариантом (один инстанс = одна organization); отдельный multi-org CRUD в P2 не вводится.

**New API endpoints:**

```
GET    /api/v1/locations                    → list
POST   /api/v1/locations                    → create (admin)
PATCH  /api/v1/locations/:id                → update name, address (admin)
DELETE /api/v1/locations/:id                → delete (admin, fails if has devices)

GET    /api/v1/locations/:id/zones          → list zones
POST   /api/v1/locations/:id/zones          → create zone (admin)
PATCH  /api/v1/zones/:id                    → update name (admin)
DELETE /api/v1/zones/:id                    → delete (admin, fails if has devices)
```

**Constraints:**
- Cannot delete location with devices attached (through zones)
- Cannot delete zone with devices attached
- Error: 409 `HAS_ATTACHED_DEVICES`

**Audit:** `location.created`, `location.updated`, `location.deleted`, `zone.created`, `zone.updated`, `zone.deleted`

### 6.3 Webhook engine v2 (F5)

**New tables:**

```
webhooks
  id              uuid PK
  url             varchar(500) NOT NULL
  secret          varchar(255) NOT NULL        — always generated, always signs
  events          varchar(100)[] NOT NULL       — e.g. ['alert.triggered', 'device.offline']
  isActive        boolean DEFAULT true
  createdBy       uuid FK → users              — nullable (for legacy migration)
  createdAt       timestamptz DEFAULT now()

webhook_deliveries
  id              uuid PK
  webhookId       uuid FK → webhooks ON DELETE CASCADE
  event           varchar(100) NOT NULL
  payload         jsonb NOT NULL
  attempt         integer NOT NULL DEFAULT 1
  responseCode    integer                       — nullable
  error           text                          — nullable
  nextRetryAt     timestamptz                   — nullable
  deliveredAt     timestamptz                   — nullable
  createdAt       timestamptz DEFAULT now()
  INDEX (nextRetryAt) WHERE nextRetryAt IS NOT NULL AND delivered_at IS NULL
```

**Events P2:**

```
alert.triggered
alert.acknowledged
device.online
device.offline
device.provisioned
device.decommissioned
```

**HMAC signing:**

All webhooks are signed. Header: `X-Signature-256: sha256=<hex(HMAC-SHA256(rawBody, secret))>`

Same format as GitHub webhooks.

**Retry policy:** max 5 attempts. Backoff: 10s, 30s, 2m, 10m, 30m. Implementation: `setInterval` every 10 seconds queries `webhook_deliveries WHERE nextRetryAt < now() AND deliveredAt IS NULL AND attempt < 5`. No Redis.

**Delivery success:** HTTP 2xx → `deliveredAt = now()`, no more retries. Non-2xx or network error → increment attempt, set `nextRetryAt`.

All webhook delivery goes only through webhook CRUD configuration (no `ALERT_CALLBACK_URL` migration path).

**Integration:** alert service calls webhook service instead of direct HTTP callback. P1's `lib/callback.ts` replaced by webhook service.

**New API endpoints:**

```
GET    /api/v1/webhooks                     → list (admin)
POST   /api/v1/webhooks                     → create (admin)
PATCH  /api/v1/webhooks/:id                 → update url, events, isActive (admin)
DELETE /api/v1/webhooks/:id                 → delete (admin)
GET    /api/v1/webhooks/:id/deliveries      → delivery log (admin)
POST   /api/v1/webhooks/:id/test            → send test event (admin)
```

### 6.4 Mosquitto auth без docker.sock (F6)

**Status: implemented (P2).**  
Подробности: `docs/P2/F6-DECISION.md`.

**Final mechanism in current runtime:**
- Sidecar `mosquitto-auth-sync` (combined `mqtt` image).
- `server` при provisioning/decommission/rotation вызывает `MOSQUITTO_RELOAD_URL` (`POST /reload`) внутри compose-сети.
- Rebuild `passwd`/`acl` и `SIGHUP` выполняются внутри mqtt/auth-sync контейнера.

**Security/ops constraints:**
- docker.sock не монтируется в `server`.
- reload-port не публикуется на host (internal-only control plane).
- runtime files `passwd`/`acl` выставляются с безопасными правами/владельцем.

**Migration from P1:** остаётся совместимой — источником прав является БД, reconcile выполняется через sidecar reload-path.

### 6.5 Telegram-бот (F4) — SHOULD

**Decision:** part of Fastify server process, not separate container. Telegram Bot API polling mode. Env-gated: if `TELEGRAM_BOT_TOKEN` not set → bot does not start, no error.

**Local-first exception:** outgoing HTTPS to `api.telegram.org`. Only alert notification data sent (serial, name, value, threshold). No bulk data export.

**Documentation must explicitly state:** when Telegram bot is enabled, alert notification data (device serial, name, reading value, threshold) is sent to Telegram API servers.

**Functionality:**

```
/start              → user enters one-time code from UI → bot verifies → stores chatId in users table
/status             → current values of all (or selected) devices
/mute 30m           → mute notifications for duration
[automatic]         → alert notification on alert.triggered for users with linked Telegram
```

**Linking flow:** UI (Settings → Telegram) generates one-time code (6 digits, 5 min expiry, stored in-memory or short-lived DB record). User sends code to bot. Bot verifies, writes `telegramChatId` to `users` table.

### 6.6 Calibration records (F10) — SHOULD

**New table:**

```
calibration_records
  id                uuid PK
  deviceId          uuid FK → devices NOT NULL
  calibratedAt      timestamptz NOT NULL
  referenceValueC   real NOT NULL                — reference thermometer reading
  deviceValueC      real NOT NULL                — sensor reading
  offsetC           real NOT NULL                — applied correction
  calibratedBy      uuid FK → users              — nullable (system/backfill compatibility)
  notes             text
  createdAt         timestamptz DEFAULT now()
  INDEX (deviceId, calibratedAt DESC)
```

`devices.calibrationOffsetC` remains as cache of current offset. Updated automatically when new calibration record is created.

**API:**

```
POST   /api/v1/devices/:serial/calibrations    → create (admin, operator)
GET    /api/v1/devices/:serial/calibrations    → history
```

**Audit:** `calibration.recorded`

### 6.7 UI: Next.js (F2)

**Architecture:**

Next.js as separate container (`apps/web`). Fastify continues on `:8080` (API only, no static serving). Next.js on `:3000`.
UI implementation baseline (approved stack and design rules): `docs/P2/UI-SPEC.md`.

Without Caddy: two ports exposed. With Caddy (F12): single port, path routing.

```
Browser → :3000 (Next.js) → server-side fetch → :8080 (Fastify API, internal Docker network)
         → :8080 directly (for CLI, webhooks, SDK consumers)
```

**What is removed from P1:**
- `ui/` directory (Vite SPA) → deleted
- `@fastify/static` plugin → removed
- `/config.js` endpoint → removed

**New workspace:** `apps/web/`

**Pages:**

| Route | Description | Priority |
|---|---|---|
| `/login` | Auth | MUST (F1) |
| `/` | Dashboard: locations → zones → device summary | MUST |
| `/devices` | Device list (improved P1 screen) | MUST |
| `/devices/[serial]` | Device detail (MUST core): current values, chart (Recharts), alert rules; calibrations — optional section if F10 enabled | MUST + optional |
| `/locations` | Location/zone management CRUD | MUST (F3) |
| `/alerts` | Alert events with filters, acknowledge | MUST |
| `/settings` | User management (admin), webhooks config | MUST |
| `/settings/telegram` | Telegram linking | SHOULD (F4) |
| `/onboard` | Manual provision form (MUST, F8a) + QR scan (SHOULD, F8b) | Mixed |
| `/export` | Device + period selection → CSV/PDF download | SHOULD (F9) |

**Charts:** Recharts. Data source: `GET /devices/:serial/readings?since=&until=&limit=`.

### 6.8 CI/CD (F7)

**GitHub Actions pipeline:**

```yaml
on: [push, pull_request]

jobs:
  check:
    steps:
      - pnpm install --frozen-lockfile
      - pnpm -r run typecheck
      - pnpm -r run lint
      - pnpm --filter @sensor/shared run test      # unit: parseSerial, schemas
      - pnpm --filter @sensor/server run test       # unit + integration: auth, webhooks, provisioning, ingestion
      - pnpm --filter @sensor/web run build         # Next.js build (catches type/import errors)

  e2e-smoke:
    needs: check
    steps:
      - docker compose -f deploy/docker-compose.yml up -d
      - wait for healthy
      - run e2e smoke script (provision → simulate → alert → acknowledge)
      - docker compose down

  release:
    if: startsWith(github.ref, 'refs/tags/v')
    needs: [check, e2e-smoke]
    steps:
      - docker build + push server image to ghcr.io (tag from package.json)
      - docker build + push web image to ghcr.io
```

### 6.9 Pagination (F11) — SHOULD

Cursor-based pagination for list endpoints that can grow unbounded:

```
GET /api/v1/devices/:serial/readings?limit=100&cursor=...
GET /api/v1/alert-events?limit=100&cursor=...
GET /api/v1/audit-log?limit=100&cursor=...
GET /api/v1/webhooks/:id/deliveries?limit=100&cursor=...
```

Response format (additive extension of envelope per invariant #10):
```json
{
  "ok": true,
  "data": [ ... ],
  "cursor": "eyJ0cyI6MTc1MjU4ODYwMH0="
}
```

`cursor`: opaque string (base64-encoded `{ ts, id }`). `null` when no more data.

`GET /api/v1/devices` — no pagination in P2. Scale: hundreds of devices max per install.

### 6.10 HTTPS / Caddy (F12) — SHOULD

Optional container, profile-based:

```yaml
services:
  caddy:
    image: caddy:2.9
    profiles: ["https"]
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./config/caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - ./data/caddy:/data
```

Bind mount `./data/caddy` (not named volume) — consistent with operational model.

Caddyfile:
```
{$DOMAIN:localhost} {
    handle /api/* {
        reverse_proxy server:8080
    }
    handle {
        reverse_proxy web:3000
    }
}
```

Usage: `docker compose --profile https up -d`

---

## 7. API Changes Summary

### Backwards compatibility

All P1 endpoints remain. No breaking changes to existing request/response shapes.

| Existing endpoint | P2 change | Breaking? |
|---|---|---|
| All mutating endpoints | Auth: JWT bearer only | No |
| `?actor=` on mutating endpoints | Ignored for audit actor in P2 hardening. Actor is derived from auth context only | No |
| `GET /devices` response | Added `calibrationOffsetC` field | No (additive) |
| `GET .../readings` | Added `cursor` in response | No (additive) |
| `GET /alert-events` | Added `cursor` in response | No (additive) |
| `GET /audit-log` | Added `cursor` in response | No (additive) |
| Alert webhook payload | Added HMAC header `X-Signature-256` | No (header, not body) |

### New endpoints

```
# Auth
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout

# Users
GET    /api/v1/users
POST   /api/v1/users
PATCH  /api/v1/users/:id
DELETE /api/v1/users/:id
GET    /api/v1/users/me
PATCH  /api/v1/users/me/password

# Locations CRUD
GET    /api/v1/locations
POST   /api/v1/locations
PATCH  /api/v1/locations/:id
DELETE /api/v1/locations/:id

# Zones CRUD
GET    /api/v1/locations/:id/zones
POST   /api/v1/locations/:id/zones
PATCH  /api/v1/zones/:id
DELETE /api/v1/zones/:id

# Webhooks
GET    /api/v1/webhooks
POST   /api/v1/webhooks
PATCH  /api/v1/webhooks/:id
DELETE /api/v1/webhooks/:id
GET    /api/v1/webhooks/:id/deliveries
POST   /api/v1/webhooks/:id/test

# Calibrations
POST   /api/v1/devices/:serial/calibrations
GET    /api/v1/devices/:serial/calibrations
```

### New audit actions

```
location.created, location.updated, location.deleted
zone.created, zone.updated, zone.deleted
user.created, user.updated, user.deleted
webhook.created, webhook.updated, webhook.deleted
calibration.recorded
```

---

## 8. Database Migration

Single migration `0001_p2.sql`:

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('admin', 'operator', 'viewer')),
  telegram_chat_id VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Refresh tokens
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens(user_id);

-- Webhooks
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url VARCHAR(500) NOT NULL,
  secret VARCHAR(255) NOT NULL,
  events VARCHAR(100)[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Webhook deliveries
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  response_code INTEGER,
  error TEXT,
  next_retry_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX webhook_deliveries_retry_idx
  ON webhook_deliveries(next_retry_at)
  WHERE next_retry_at IS NOT NULL AND delivered_at IS NULL;

-- Calibration records
CREATE TABLE calibration_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id),
  calibrated_at TIMESTAMPTZ NOT NULL,
  reference_value_c REAL NOT NULL,
  device_value_c REAL NOT NULL,
  offset_c REAL NOT NULL,
  calibrated_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX calibration_records_device_idx
  ON calibration_records(device_id, calibrated_at DESC);
```

**Backwards compatibility:** migration is additive. No existing tables modified. No data loss.

**Startup seed logic (server):**
1. Run migration
2. If `users` empty AND `ADMIN_EMAIL` + `ADMIN_PASSWORD` in env → create admin user
3. No legacy webhook bootstrap from env; webhooks are configured via API/UI

---

## 9. Risks and Spikes

| # | Topic | Spike? | Blocks | Description |
|---|---|---|---|---|
| S1 | Mosquitto auth mechanism | **Completed** | F6 | Finalized to sidecar `mosquitto-auth-sync` without docker.sock; no additional spike work required for P2 closure |
| S2 | Webhook retry on PostgreSQL | **Yes** | F5 | Verify: polling `webhook_deliveries WHERE nextRetryAt < now()` every 10s — overhead with 100+ pending. Expected: fine at P2 scale. If not → consider `pg_cron` or accept Redis in P2 |
| R1 | Next.js SSR + Fastify API latency | No | – | Internal Docker network, expected <5ms. Monitor during development |
| R2 | argon2 native module in Docker | No | – | `argon2` npm requires native build. Ensure Dockerfile has build tools in builder stage |
| R3 | Telegram bot polling in same process | No | – | Telegram polling is non-blocking. Monitor event loop lag |

**Note:** S1 завершён и зафиксирован решением F6 (sidecar). S2 остаётся историческим риском, который учитывался в реализации webhook retry.

---

## 10. Implementation Sequence

### Phase 0: Spikes (2–3 days)

```
[x] S1: Mosquitto auth mechanism finalized (sidecar without docker.sock)
[x] S2: Webhook retry on PostgreSQL accepted for P2 scale
```

### Phase 1: Auth + DB migration (5 days)

```
Dependencies: none
Blocks: everything else

[ ] Migration 0001_p2.sql (all new tables)
[ ] Auth service: argon2id hashing, JWT issue/verify, refresh token rotation
[ ] Auth plugin: JWT verification and role extraction
[ ] Routes: /auth/login, /auth/refresh, /auth/logout
[ ] Routes: /users CRUD, /users/me
[ ] Actor resolution: JWT → email
[ ] Admin seed from env
[ ] Tests: login, role enforcement, token refresh
```

### Phase 2: Mosquitto auth without docker.sock (3 days)

```
Dependencies: S1 completed
Parallel with: Phase 1

[x] Sidecar `mosquitto-auth-sync` for rebuild/reload path
[x] Update provision.ts: reconcile via `MOSQUITTO_RELOAD_URL`
[x] Reconcile at startup and during provision/decommission/rotation
[x] Update docker-compose: remove docker.sock mount
[x] Migration path from P1 documented (F6 decision doc)
```

### Phase 3: Webhook engine v2 (4 days)

```
Dependencies: Phase 1 (auth for createdBy), S2 completed
Parallel with: Phase 2

[ ] Webhook service: create, HMAC sign, deliver, retry polling loop
[ ] Routes: /webhooks CRUD, deliveries, test
[ ] Integration: alert service → webhook service
[ ] No legacy webhook migration path in runtime
[ ] Remove lib/callback.ts
[ ] Tests: delivery, retry, HMAC verification, legacy migration
```

### Phase 4: Locations/Zones CRUD (MUST core) + optional Calibration track (3 days)

```
Dependencies: Phase 1 (auth for role check)

[ ] Routes: /locations CRUD, /zones CRUD
[ ] Constraint: cannot delete with attached devices (409)
[ ] (Optional / SHOULD F10) Routes: /calibrations POST, GET
[ ] (Optional / SHOULD F10) Auto-update devices.calibrationOffsetC on new calibration
[ ] Audit: all new actions
[ ] Tests: CRUD, constraint enforcement, calibration offset update
```

### Phase 5: Next.js UI (7 days)

```
Dependencies: Phases 1, 3, 4

[ ] apps/web: Next.js App Router, Dockerfile
[ ] Login page
[ ] Layout: sidebar, nav, user menu
[ ] Dashboard: locations → zones → devices
[ ] Devices list
[ ] Device detail (MUST core): values, Recharts chart, alert rules
[ ] (Optional / SHOULD F10) Calibrations section on device detail
[ ] Locations/Zones management
[ ] Alert events: list, filter, acknowledge
[ ] Settings: users (admin), webhooks
[ ] Onboard page: manual provisioning form (MUST, F8a)
[ ] Remove ui/ directory
[ ] Remove @fastify/static plugin, /config.js endpoint
[ ] Update docker-compose: add web service
```

### Phase 6: SHOULD features (3–5 days)

```
Dependencies: Phases 1–5

[ ] F4: Telegram bot (polling, linking flow, alert notifications)
[ ] F8b: QR onboard (html5-qrcode) как ускоритель над F8a manual form
[ ] F9: CSV/PDF export (backend endpoint + UI page)
[ ] F11: Cursor-based pagination (readings, alert-events, audit-log, deliveries)
[ ] F12: Caddy profile in compose, Caddyfile, bind mount ./data/caddy
```

### Phase 7: CI/CD + polish (3 days)

```
[ ] GitHub Actions: typecheck, lint, test (shared + server), web build, e2e smoke
[ ] Updated documentation: install-guide (P2), security (no docker.sock), upgrade-from-p1
[ ] E2E test of full P2 flow
[ ] Tag v0.2.0, build and push images
```

**Total estimate:** 5–7 weeks, same team (1–2 fullstack + firmware on maintenance).

---

## 11. Docker Compose P2

```yaml
services:
  db:
    image: timescale/timescaledb:2.17.2-pg16
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME:-sensors}
      POSTGRES_USER: ${DB_USER:-sensors}
      POSTGRES_PASSWORD: ${DB_PASSWORD:?Set DB_PASSWORD}
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-sensors}"]
      interval: 5s
      retries: 5

  mqtt:
    image: eclipse-mosquitto:2.0.20
    restart: unless-stopped
    volumes:
      - ./config/mosquitto/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro
      - ./data/mosquitto:/mosquitto/data
    ports:
      - "${MQTT_PORT:-1883}:1883"

  server:
    image: ghcr.io/your-org/sensor-server:0.2.0
    restart: unless-stopped
    depends_on:
      db: { condition: service_healthy }
      mqtt: { condition: service_started }
    environment:
      DATABASE_URL: postgresql://${DB_USER:-sensors}:${DB_PASSWORD}@db:5432/${DB_NAME:-sensors}
      MQTT_URL: mqtt://mqtt:1883
      MQTT_ADMIN_USER: ${MQTT_ADMIN_USER:-server}
      MQTT_ADMIN_PASSWORD: ${MQTT_ADMIN_PASSWORD:?Set MQTT_ADMIN_PASSWORD}
      JWT_SECRET: ${JWT_SECRET:?Set JWT_SECRET}
      ADMIN_EMAIL: ${ADMIN_EMAIL:-}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-}
      DEVICE_OFFLINE_TIMEOUT_SEC: ${DEVICE_OFFLINE_TIMEOUT_SEC:-300}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN:-}
    ports:
      - "${API_PORT:-8080}:8080"
    # NO docker.sock mount

  web:
    image: ghcr.io/your-org/sensor-web:0.2.0
    restart: unless-stopped
    depends_on:
      - server
    environment:
      API_URL: http://server:8080
      NEXT_PUBLIC_API_URL: ${PUBLIC_API_URL:-http://localhost:8080}
    ports:
      - "${WEB_PORT:-3000}:3000"

  caddy:
    image: caddy:2.9
    profiles: ["https"]
    restart: unless-stopped
    depends_on:
      - server
      - web
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./config/caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - ./data/caddy:/data
```

**Changes from P1 compose:**
- `server`: no `docker.sock` mount, no `passwd/acl` mounts. Added `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TELEGRAM_BOT_TOKEN`
- `mqtt`: volumes simplified (no passwd/acl bind mounts if Dynamic Security)
- `web`: new container
- `caddy`: new container (profile-gated)
- JWT-only auth in runtime (`JWT_SECRET` required)
