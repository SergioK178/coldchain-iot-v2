# P2 Closure Summary

Дата: 2026-03-04 (обновлено после реализации F6 и SHOULD)

## 1) Итоговый статус P2

Текущий статус: **MUST закрыт; selected SHOULD закрыты частично**.

- MUST-пункты выполнены. **F6** реализован через sidecar `mosquitto-auth-sync`: server вызывает `MOSQUITTO_RELOAD_URL`, docker.sock у server не используется.
- SHOULD: реализованы F4 (Telegram), F8b (QR onboarding), F10 (calibration UI), F11 (cursor pagination для readings), F12 (optional Caddy).
- F9 реализован частично: production-ready CSV, PDF остаётся backlog.

## 2) Матрица выполнения MUST

1. `F1` Auth (users/login/JWT/roles): **DONE**
2. `F2` UI Next.js + device detail + графики + навигация: **DONE**
3. `F3` Locations/Zones CRUD (API + UI): **DONE**
4. `F5` Webhook engine v2: **DONE**
5. `F6` Mosquitto auth без docker.sock: **DONE** (sidecar auth-sync + `MOSQUITTO_RELOAD_URL`)
6. `F7` CI/CD: **DONE**
7. `F8a` Manual provisioning form in UI: **DONE**

## 3) Матрица выполнения SHOULD

1. `F4` Telegram-бот: **DONE** (страница /settings/telegram, one-time код, grammY, уведомления по alert.triggered)
2. `F8b` QR onboarding: **DONE** (QR-сканер на /onboard, префилл, fallback без камеры)
3. `F9` CSV/PDF export: **PARTIAL** (backend /api/v1/export/readings, UI /export; CSV готов, PDF в backlog)
4. `F10` Calibration records: **DONE** (UI history + форма на /devices/[serial], offset, audit)
5. `F11` Cursor-based pagination: **DONE** (readings: cursor + limit, «Загрузить ещё» в UI)
6. `F12` HTTPS/Caddy: **DONE (optional profile in compose)**

Пояснение:
- Детализированный чек-лист для передачи в работу: `docs/P2/SHOULD-DEFINITION-OF-DONE.md`.
- Статус above подтверждён по текущему коду `apps/web`/`apps/server` и P2 документации.

## 4) Что реализовано (в т.ч. последний цикл)

- **F6:** sidecar `tools/mosquitto-auth-sync` (Node + Mosquitto в одном образе), запись passwd/acl из БД, HTTP POST `/reload`. Server при `MOSQUITTO_RELOAD_URL` вызывает его вместо docker.sock. В `deploy/docker-compose.yml` mqtt — новый образ, у server убран volume docker.sock.
- **F4:** `/settings/telegram` (one-time код), grammY-бот, обновление `telegram_chat_id`, отправка уведомлений по `alert.triggered`.
- **F8b:** QR-сканер на `/onboard` (camera + BarcodeDetector API), префилл serial/displayName, fallback без камеры/поддержки браузера.
- **F9:** `GET /api/v1/export/readings` (deviceSerial/locationId, since, until, format=csv), лимиты 31 день / 5000 строк, audit; UI `/export` с фильтрами и скачиванием CSV. PDF пока не реализован.
- **F10:** Секция калибровок на `/devices/[serial]`: форма (эталон, показание, заметки), история, текущий offset.
- **F11:** Readings: ответ с полем `cursor`, запрос `limit` и `cursor`; на странице устройства кнопка «Загрузить ещё».
- UI-стек и MUST-экраны — по `docs/P2/UI-SPEC.md`; AuthGuard, sidebar (пользователь/роль), фильтры устройств, формы с inline-ошибками.

## 5) Документация: текущее состояние

- `docs/MASTER-SPEC.md` — P1 source of truth.
- `docs/P2/P2-EVOLUTION.md` — frozen P2 source of truth.
- `docs/P2/UI-SPEC.md` — утверждённый UI stack/baseline.
- `docs/P2/F6-DECISION.md` — статус и план закрытия F6.
- **`docs/P2/SHOULD-DEFINITION-OF-DONE.md`** — Definition of Done по SHOULD (F4, F8b, F9, F10, F11, F12 + полировка UI); можно передать коллеге как чек-лист.
- `docs/api-reference.md` — unified API reference (P1 + P2 + compatibility).
- `docs/openapi-p1.json` — P1 baseline.
- `docs/P2/openapi-p2.json` — P2 additions/changes.
- `docs/openapi.json` + `openapi-relevant.json` — combined актуальный контракт.

## 6) Доп. полировка UI (сделано)

- Не авторизован: при 401 редирект на `/login` через `AuthGuard`; глобальный обработчик 401 в `api.ts`.
- Sidebar: индикатор текущего пользователя (email + роль), кнопка «Выход» в верхней зоне на mobile.
- Устройства: quick-filters (статус, тревога, локация), строка поиска по serial/названию; sticky header таблицы.
- Формы (onboard, settings): inline-ошибки + success toast + disabled state на submit.

## 7) Остаток (опционально)

- PDF-экспорт (F9): сейчас только CSV; для полного SHOULD закрытия добавить генерацию PDF.
- Cursor для остальных list-endpoints (alert-events, audit-log, webhook deliveries) по тому же паттерну, что и readings.

## 8) Definition Of Done Status

- `MUST`: **met** (F1, F2, F3, F5, F6, F7, F8a).
- `SHOULD`: **selected items met** (F4, F8b, F10, F11, F12), `F9` partial (CSV only).
- Итог: P2 можно считать завершённым по MUST и agreed selected SHOULD, при явной фиксации PDF как backlog.

## 9) Security Hardening (post-closure)

- `deploy/.env` added to git ignore policy (no real secrets in repo).
- Auth anti-bruteforce on `/api/v1/auth/login` and `/api/v1/auth/refresh`:
  - in-memory rate limit, `429` + `Retry-After`.
- Cookie security policy via `AUTH_COOKIE_SECURE` (`true|false|auto`).
- Webhook SSRF protection:
  - URL validation blocks localhost/private/link-local/metadata targets;
  - delivery uses `redirect: error`.
- Audit integrity:
  - API_TOKEN actor is immutable (`api_token`), `?actor=` no longer overrides audit actor.
- Secret rotation runbook: `docs/P2/SECURITY-HARDENING.md`.
