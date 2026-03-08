# P2 Acceptance Freeze

Status: **FROZEN**  
Date: 2026-03-07  
Owner: Release Gate  
Reference: [FINAL-POLISH-SPEC.md](./FINAL-POLISH-SPEC.md) §3

---

## 1. MUST — Done

| ID | Feature | Status | Proof |
|---|---|---|---|
| F1 | Auth (users, login, JWT, roles admin/operator/viewer) | **done** | `apps/server/src/plugins/auth.ts`, `routes/auth.ts`, `services/auth.ts`; JWT-only, no API_TOKEN |
| F2 | UI Next.js + device detail + графики + навигация | **done** | `apps/web/` — AppShell, `/devices`, `/devices/[serial]`, Recharts |
| F3 | Locations/Zones CRUD (API + UI) | **done** | `routes/locations.ts`, `/locations`, `/locations/[id]` |
| F5 | Webhook engine v2 (retry, HMAC-SHA256) | **done** | `services/webhook.ts`, `routes/webhooks.ts` |
| F6 | Mosquitto auth без docker.sock | **done** | `MOSQUITTO_RELOAD_URL` обязателен; auth-sync sidecar; `provision.ts` — только HTTP reload |
| F7 | CI/CD | **done** | `.github/workflows/` |
| F8a | Manual provisioning form in UI | **done** | `/onboard` — 5-step guided flow (claim/assign/issue/activate/verify) |

---

## 2. SHOULD — Status

| ID | Feature | Status | Notes |
|---|---|---|---|
| F4 | Telegram-бот | **done** | `/settings/telegram`, grammY, alert.triggered notifications |
| F8b | QR onboarding | **done** | QR-сканер на `/onboard`, BarcodeDetector API, fallback без камеры |
| F9 | CSV/PDF export | **done** | CSV и PDF; UI `/export` с кнопками скачивания |
| F10 | Calibration records | **done** | `/devices/[serial]` — форма, история, offset |
| F11 | Cursor-based pagination | **done** | readings: cursor + limit, «Загрузить ещё» |
| F12 | HTTPS/Caddy | **done** | `docker compose --profile https` |

---

## 3. Explicit Deferred to P3 / Backlog

| Item | Reason |
|---|---|
| PDF export (F9) | CSV достаточен для пилотов; PDF — по запросу |
| Cursor для alert-events, audit-log, webhook deliveries | Readings покрыт; остальные — low volume |
| Multi-tenant SaaS | Out of scope P2 |
| Hybrid edge/cloud sync | Out of scope P2 |
| Billing / Marketplace | Out of scope P2 |
| SDK для нескольких языков | TypeScript SDK есть; расширение — demand-driven |
| MQTT over TLS (8883) | Датчики в LAN; по запросу пилота |
| Full white-label | Нет B2B-партнёров |

---

## 4. Legacy Removal Matrix

| Entity | Status | Notes |
|---|---|---|
| API_TOKEN | **removed** | JWT-only auth; auth plugin, user-routes, index.ts — без fallback |
| DOCKER_SOCKET / MOSQUITTO_CONTAINER_NAME | **removed** | MOSQUITTO_RELOAD_URL обязателен; fallback path удалён из provision.ts, config |
| ALERT_CALLBACK_URL | **removed** | Legacy webhook bootstrap удалён из app.ts, config |
| P1 ui/ (Vite SPA) | **removed** | Заменён на apps/web (Next.js) |
| @fastify/static, /config.js | **removed** | P2: API-only server |
| ?actor= override | **removed** | Actor только из auth context |

---

## 5. Mandatory Checks (Verification)

| Check | Result |
|---|---|
| Auth/roles по P2-модели | **pass** — JWT + refresh cookie; admin/operator/viewer |
| On-prem и managed маршруты разведены | **pass** — install-guide.md, managed-cloud-checklist.md |
| Onboarding flow end-to-end | **pass** — /onboard 5-step; error states + recovery |
| API/docs/OpenAPI согласованы | **pass** — docs/openapi.json, docs/P2/API-REFERENCE.md |
| Legacy API_TOKEN удалён | **pass** — JWT-only |
| Install flow и Mosquitto reload актуальны | **pass** — MOSQUITTO_RELOAD_URL в .env.example, install-guide |
| E2E проходят | **pass** — deploy/scripts/e2e-test.sh (login→JWT) |

---

## 6. Evidence

- P2 closure (archive): `docs/archive/P2-CLOSURE-SUMMARY.md`
- Hardening: `docs/P2-hardening/HARDENING-SPEC.md`, `HARDENING-SUMMARY.md`
- API policy: `docs/P2/API-COMPATIBILITY-POLICY.md`
- Install: `deploy/docs/install-guide.md`
- Managed: `deploy/docs/managed-cloud-checklist.md`
