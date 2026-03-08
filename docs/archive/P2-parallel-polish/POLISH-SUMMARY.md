# P2 Parallel Polish — Change Summary

Date: 2026-03-07  
Tracks executed: Track 1 (THREE-TRACK-SPEC), C, D, E (PARALLEL-POLISH-SPEC)  
Tracks deferred: A, B (PARALLEL-POLISH-SPEC) — conflict with active hardening

## Track 1 (THREE-TRACK-SPEC): Core Platform and Security — Stage 1

Stage: Stage 1 (Foundation Lock).  
Owner contour: `apps/server`, `docs/P2/`.

### Code changes

**Security fix — `hashRefreshToken` (CRITICAL):**

- `apps/server/src/lib/auth.ts`: `hashRefreshToken(value, jwtSecret)` — was using hardcoded HMAC key `'refresh'`; now uses `JWT_SECRET`. Source code compromise alone no longer sufficient to forge or verify stored refresh token hashes.
- `apps/server/src/services/auth.ts`: updated all three call sites (login, refresh, logout) to pass `jwtSecret`.
- Migration impact: all existing refresh tokens invalidated on deploy. Users must re-authenticate once.

**Startup runtime hardening:**

- `apps/server/src/index.ts`: added deprecation warning when `MOSQUITTO_RELOAD_URL` is not set (indicates active P1 docker.sock fallback path).

**Config deprecation annotations:**

- `apps/server/src/config.ts`: `DOCKER_SOCKET`, `MOSQUITTO_CONTAINER_NAME`, `MOSQUITTO_DATA_DIR` marked `@deprecated` (P1 fallback; removal target P3).

### Documentation

- `docs/P2/API-COMPATIBILITY-POLICY.md` (new): formal compatibility policy — breaking vs additive change rules, deprecation table, frozen auth/session contract for Track 2 consumption, webhook contract, F6 auth-path contract, envelope invariant, migration note for hashRefreshToken fix.

### Stage 1 exit criteria

1. Auth/session and security assumptions fixed: **done** (hashRefreshToken fix + auth contract published in API-COMPATIBILITY-POLICY.md).
2. API compatibility rules explicitly documented: **done** (API-COMPATIBILITY-POLICY.md §1-3).
3. Runtime deployment constraints published: **done** (deploy docs updated in Track C; F6 constraints in API-COMPATIBILITY-POLICY.md §7).

### Contours NOT touched

- `apps/web` — not modified.
- `docs/api-reference.md`, `docs/openapi.json`, `docs/P2/API-REFERENCE.md` — not modified (in active hardening diff).
- No breaking changes to `/api/v1`.

## Контуры, которые не затронуты

- `apps/server` — не изменялся
- `apps/web` — не изменялся
- `docs/contracts` (`docs/api-reference.md`, `docs/openapi.json`, `docs/P2/API-REFERENCE.md`, etc.) — не изменялись

## Track C: Install / Deployment Polish

Контур: `deploy/`

Что изменено:

- `deploy/docs/security.md` — убраны P1-only секции (docker.sock, планы P2 «в будущем»); актуализировано под P2: JWT auth done, webhook HMAC done, auth-sync sidecar вместо docker socket.
- `deploy/docs/install-guide.md` — добавлена секция JWT-аутентификации; обновлены команды provisioning под P2 API (JWT Bearer); добавлен раздел webhook; ENV-таблица расширена.
- `deploy/.env.example` — добавлены `PUBLIC_API_URL` и `WEBHOOK_ALLOWLIST_HOSTS` (присутствовали в compose, отсутствовали в примере); структурированы секции.
- `deploy/docs/managed-cloud-checklist.md` — новый файл: чек-лист развёртывания managed cloud single-tenant инстанса.

Что не изменялось: deployment topology, docker-compose.yml, Caddyfile, scripts, DB schema.

Contract impact: нет изменений API/UI-контрактов.

## Track D: SDK / Developer Experience

Контур: `packages/sdk-ts/` (новый пакет, не трогает существующие)

Что добавлено:

- `packages/sdk-ts/src/types.ts` — типы всех API-сущностей (device, auth, user, location, zone, alert, webhook, calibration, readings, export).
- `packages/sdk-ts/src/client.ts` — `ColdChainClient`: JWT и API_TOKEN auth, все endpoint-группы P2, `readingsIterator` (async generator по cursor-страницам).
- `packages/sdk-ts/src/webhook.ts` — типы webhook payload, `verifyWebhookSignature` (HMAC-SHA256, native crypto.subtle, constant-time compare).
- `packages/sdk-ts/src/index.ts` — публичный экспорт.
- `packages/sdk-ts/examples/quickstart.ts` — login, list, provision, alert rule, readings.
- `packages/sdk-ts/examples/webhook-consumer.ts` — Node.js HTTP receiver с HMAC верификацией и typed dispatcher.
- `packages/sdk-ts/README.md` — документация SDK.

Contract impact: новый пакет, не меняет `/api/v1` контракт. Типы отражают существующий API без расширений.

## Track E: Hardware / Provisioning Ops

Контур: `deploy/docs/` (новый файл)

Что добавлено:

- `deploy/docs/hardware-provisioning.md` — serial format, device types, QR payload format, factory checklist, flashing flow, batch provisioning, credential rotation, troubleshooting.

Ссылка добавлена в `deploy/docs/install-guide.md`.

Contract impact: нет изменений API/protocol.

## Track 2 (THREE-TRACK-SPEC): Onboarding and Device Lifecycle — Stage 2

Контур: `apps/web`.

### Изменения

- `app/onboard/page.tsx`:
  - Обработка ошибок: DEVICE_ALREADY_PROVISIONED, INVALID_SERIAL_FORMAT, UNKNOWN_DEVICE_TYPE, ZONE_NOT_FOUND — понятные сообщения и recovery (ссылка на карточку устройства, «Ввести другой serial», «Сбросить выбор зоны»).
  - Inline-валидация serial (SENS-XX-NNNNN) перед переходом на шаг 2.
  - Выбор источника питания (battery/wired) в форме.
  - Ссылка на batch provisioning (provision-cli) внизу страницы.
- `app/devices/[serial]/page.tsx`: в confirm при decommission добавлена подсказка «После удаления можно зарегистрировать заново через /onboard».

### Stage 2 exit criteria

1. Claim/provision/assign/activate/decommission flow operational: **done**.
2. Error states and recovery paths defined: **done**.
3. No contract drift from Stage 1: **done**.

## Track 3 (THREE-TRACK-SPEC): Delivery, Packaging and Client Routes — Stage 3

Контур: `deploy/`, `docs/`, `README.md`.

### Изменения

- `deploy/docs/install-guide.md`: MOSQUITTO_RELOAD_URL в обязательных; batch provision-cli — пример с login→JWT перед вызовом.
- `docs/README.md` (новый): навигация по контрактам (P1/P2), deploy docs, authoritative sources.
- `README.md`: убраны API_TOKEN, ALERT_CALLBACK_URL; MOSQUITTO_RELOAD_URL в обязательных; E2E — ADMIN_EMAIL/ADMIN_PASSWORD; ссылка на docs/README.md.

### Stage 3 exit criteria

1. On-prem и managed runbooks aligned: **done**.
2. Setup/troubleshooting docs complete and navigable: **done** (docs/README.md).
3. Packaging does not require undocumented manual steps: **done**.

## Cleanup коллеги (после Track 1)

Выполнен полный удаление legacy P1, без fallback:

- **JWT-only auth** — API_TOKEN удалён из auth plugin, user-routes, index.ts.
- **F6 только canonical path** — MOSQUITTO_RELOAD_URL обязателен; DOCKER_SOCKET/MOSQUITTO_* fallback удалён из provision.ts и config.
- **Legacy webhook** — ALERT_CALLBACK_URL и миграционная ветка в app.ts удалены.
- **Скрипты** — e2e-test.sh, e2e-with-simulators.sh, smoke-load.sh переведены на login→JWT.
- **Доки и контракты** — openapi.json, API-REFERENCE.md, API-COMPATIBILITY-POLICY.md, deploy docs синхронизированы под JWT-only.

Track 1 deprecation warnings (docker.sock fallback) больше не актуальны — fallback удалён.

## Tracks A и B — отложены

Track A (UX onboarding, `apps/web`) и Track B (API/webhook docs, `docs/contracts`) отложены: активный hardening затрагивает те же контуры. Запускать после завершения и мержа hardening.

## Совместимость с P2 Hardening Guardrails

- Single-tenant per instance: не затронуто.
- Два deployment profile одного codebase: подтверждено в managed-cloud-checklist.md.
- No breaking changes под `/api/v1`: SDK отражает существующий контракт без изменений.
- No hybrid/multi-tenant в P2 scope: не затронуто.
