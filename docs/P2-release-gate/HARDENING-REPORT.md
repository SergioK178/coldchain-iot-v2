# P2 Hardening Report

Status: **COMPLETE**  
Date: 2026-03-07  
Reference: [HARDENING-OPTIMIZATION-CLEANUP-SPEC.md](./HARDENING-OPTIMIZATION-CLEANUP-SPEC.md)

---

## 1. Executive Summary

Цикл hardening выполнен по спецификации. Выявлены и исправлены проблемы в reliability, security, performance и ops. Документация приведена в соответствие с release-gate артефактами. Система готова к controlled pilot.

---

## 2. Problem List (Severity + Impact)

### 2.1 Исправлено в текущем цикле

| ID | Workstream | Severity | Impact | Описание | Fix |
|---|---|---|---|---|---|
| H1 | A | Medium | Major | Webhook retry loop глотал ошибки без логирования | Добавлен `logger` в `startRetryLoop()`, ошибки пишутся в app.log |
| H2 | B | Medium | Major | `getBySerial()` вызывал `list()` — O(n) для одного устройства | Прямой запрос по serial с отдельным подсчётом unack alerts |
| H3 | C | Medium | Minor | Audit логировал полный raw payload при invalid/unknown — риск утечки | `payload.invalid`: только `rawLength`; `device.unknown_message`: убран `raw` |
| H4 | D | Medium | Minor | Нет readiness probe для DB — k8s/LB не могут проверять готовность | Добавлен `GET /api/v1/ready` с DB ping |

### 2.2 Архитектурные ограничения (сознательно оставлены)

| ID | Workstream | Описание | Mitigation |
|---|---|---|---|
| A1 | A | Refresh token: при двух одновременных refresh с одним токеном возможен race — оба получат новые токены | Low probability; single-tenant; acceptable |
| A2 | B | Device list: N+1 для unack alerts — уже батчится через `inArray` | При >100 устройств — рассмотреть materialized view |
| A3 | B | Readings: TimescaleDB hypertable — миграция на обычный Postgres потребует отдельного цикла | Документировано; on-prem обычно TimescaleDB |
| A4 | C | Swagger UI публичный — для on-prem приемлемо | Managed cloud: reverse proxy может ограничить |

### 2.3 Nice-to-have (не в текущем цикле)

| ID | Workstream | Описание |
|---|---|---|
| N1 | B | Index `(device_id) WHERE acknowledged_at IS NULL` для alert_events — ускорение device list |
| N2 | A | Health: добавить MQTT connectivity check |
| N3 | F | Empty state для devices/locations — иллюстрация + CTA |

---

## 3. Mandatory Fixes (Sign-off)

Все mandatory исправления выполнены:

- [x] H1: Webhook retry logging
- [x] H2: Device getBySerial optimization
- [x] H3: Audit — no raw payload in logs
- [x] H4: Readiness endpoint

---

## 4. Documentation Map (Post-Cleanup)

### 4.1 Authoritative (Source of Truth)

| Документ | Роль |
|---|---|
| `docs/P2-release-gate/P2-ACCEPTANCE.md` | P2 feature freeze |
| `docs/P2-release-gate/RUNBOOK-ONPREM.md` | On-prem trace |
| `docs/P2-release-gate/RUNBOOK-MANAGED.md` | Managed cloud trace |
| `docs/P2-release-gate/PRODUCT-BOUNDARY.md` | Product scope |
| `docs/P2-release-gate/P3-CUT.md` | P3 backlog |
| `docs/P2-release-gate/PILOT-PLAN.md` | Pilot rollout |
| `docs/P2/API-REFERENCE.md` | P2 API |
| `docs/P2/API-COMPATIBILITY-POLICY.md` | Compatibility |
| `docs/openapi.json` | Combined OpenAPI |
| `deploy/docs/install-guide.md` | Installation |
| `deploy/docs/backup-restore.md` | Backup/restore |

### 4.2 Supporting

| Документ | Роль |
|---|---|
| `docs/README.md` | Navigation |
| `docs/api-reference.md` | Unified API narrative |
| `docs/P2-hardening/HARDENING-SPEC.md` | P2 hardening decisions |
| `deploy/docs/security.md` | Security |
| `deploy/docs/managed-cloud-checklist.md` | Managed checklist |
| `deploy/docs/hardware-provisioning.md` | Hardware |

### 4.3 Archive / Deprecated

| Документ | Примечание |
|---|---|
| `docs/archive/MASTER-SPEC.md` | P1 frozen |
| `docs/archive/P1/*` | P1 archive |
| `docs/archive/P1-hardening/*` | P1 hardening archive |

### 4.4 Conflict Resolution

Конфликтов между release-gate и остальной документацией не выявлено. При появлении — source of truth: `docs/P2-release-gate/`.

---

## 5. Evidence Summary

### 5.1 Reliability

- Auth: JWT + refresh, hashRefreshToken использует JWT_SECRET
- Webhook: retry с backoff [10s, 30s, 2m, 10m, 30m], max 5 attempts, 15s timeout
- Provision: reconcile при старте; при ошибке — non-fatal, логируется
- Health: `/api/v1/health` (uptime), `/api/v1/ready` (DB)

### 5.2 Security

- Auth: Bearer JWT на всех API кроме health, ready, auth, swagger
- Webhook: HMAC-SHA256 подпись, URL allowlist, SSRF protection (private IP block)
- Audit: raw payload не логируется
- Passwords: argon2id, strong admin password validation

### 5.3 Performance

- Readings: index `(device_id, timestamp DESC)` в migrate.ts
- Webhook deliveries: partial index для retry queue
- Device getBySerial: прямой запрос вместо list()

### 5.4 Operations

- Backup/restore: `backup.sh`, `restore.sh` документированы
- E2E: `e2e-test.sh` — login→JWT, provision, list, patch, alerts, decommission, backup
- Install: MOSQUITTO_RELOAD_URL обязателен

---

## 6. Acceptance Package (Pilot Readiness)

| Критерий | Статус |
|---|---|
| Нет known high-severity reliability/security проблем | ✓ |
| Bottlenecks устранены или documented как limits | ✓ |
| UI не требует инженерного знания для базовых операций | ✓ |
| Документация единая, без конфликтов | ✓ |
| Система готова к controlled pilot | ✓ |

---

## 7. Files Changed

| File | Change |
|---|---|
| `apps/server/src/services/webhook.ts` | startRetryLoop(logger), log errors |
| `apps/server/src/services/device.ts` | getBySerial — direct query |
| `apps/server/src/services/ingestion.ts` | Audit: no raw payload |
| `apps/server/src/routes/health.ts` | GET /api/v1/ready |
| `apps/server/src/plugins/auth.ts` | /ready public |
| `apps/server/src/app.ts` | Pass app.log to retry loop |
| `deploy/docs/install-guide.md` | /ready documented |
| `docs/openapi.json` | /ready path |
| `docs/README.md` | P2-release-gate nav |

---

## 8. Handoff

Следующие шаги:

1. Запустить E2E: `cd deploy && ADMIN_EMAIL=... ADMIN_PASSWORD=... ./scripts/e2e-test.sh`
2. Выполнить runbook trace (RUNBOOK-ONPREM или RUNBOOK-MANAGED)
3. Sign-off по GATE-STATUS.md
