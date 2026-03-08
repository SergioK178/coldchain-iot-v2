# P2 Hardening Specification

Status: CLOSED (implemented 2026-03-07)  
Summary: [HARDENING-SUMMARY.md](./HARDENING-SUMMARY.md)  
Date: 2026-03-07  
Scope: P2 architecture hardening and delivery model decisions

## 1. Goal

Зафиксировать архитектурные решения P2 так, чтобы:

- не раздваивать платформу на разные продукты;
- упростить подключение датчиков без ручной MQTT-магии в UI-path;
- сохранить enterprise-совместимость (local-first, API discipline);
- не затащить в P2 scope уровня новой платформы (multi-tenant/hybrid/billing).

## 2. Canonical Architecture Choice

Primary mode: single-tenant per instance.

Это означает:

- one instance = one customer;
- один runtime stack: `web + server + mqtt + db`;
- один domain model и один API-контракт;
- одинаковые provisioning/roles/webhooks/UI принципы для on-prem и managed.

## 3. Supported Deployment Profiles (P2)

P2 поддерживает два профиля поставки одного и того же codebase:

1. Single-tenant On-Prem (primary for enterprise).
2. Managed Cloud Single-tenant (simplified SMB mode).

Важно:

- Managed cloud в P2 не считается multi-tenant SaaS.
- Это отдельный single-tenant инстанс под клиента.

## 4. Source of Truth

Для каждого инстанса:

- `server + db` данного инстанса — source of truth;
- MQTT broker живёт рядом с этим инстансом;
- `web` — control/UI layer, без отдельного бизнес-sourced state;
- нет обязательных «центральных облачных метаданных», без которых локальный режим не работает.

## 5. Product Principle

API-first capable, UI-first for operations.

- UI остаётся first-class и обязательным контуром операций.
- Любая новая P2-функция должна быть доступна через API.
- OpenAPI/webhook contracts/backward compatibility обязательны.
- SDK в P2 не обязателен как блокер закрытия.

## 6. Onboarding Hardening (P2)

### 6.1 Requirements

- Manual UI provisioning: MUST.
- QR onboarding: SHOULD (надстройка, не замена manual flow).
- Если QR включён, onboarding должен идти как guided flow, а не «вставь serial».

### 6.2 Target flow

1. Claim device.
2. Assign location/zone.
3. Issue credentials.
4. Activate device.
5. Verify telemetry/status.

### 6.3 Security guidance

- One-time claim/bootstrap code preferred.
- UI-path не должен требовать от оператора ручной работы с MQTT topics/ACL.

## 7. Enterprise Integration Baseline (P2)

MUST baseline:

- stable OpenAPI;
- webhook v2 (retry + signature);
- compatibility policy;
- versioning discipline (`/api/v1`, additive-first changes in P2 unless explicitly approved breaking change).

## 8. SMB Experience Baseline (P2)

MUST baseline:

- managed deployment profile;
- one-click-ish on-prem install path;
- clear initial setup flow;
- onboarding without manual MQTT steps for operator in UI-path.

## 9. P2 Scope Decisions

### MUST

1. Single-tenant per instance as canonical model.
2. On-prem deployment profile.
3. Managed cloud single-tenant deployment profile.
4. Stable v1 API discipline.
5. Webhook v2 (retry, signature).
6. Manual UI provisioning flow.
7. Claim/bootstrap mechanism for guided onboarding.
8. Clear install/setup flow for both deployment modes.

### SHOULD

1. QR onboarding on top of claim flow.
2. Compose profile / installer polish.
3. First SDK or typed client for one language.
4. Improved fleet/device activation UX.

### OUT OF SCOPE FOR P2

1. Multi-tenant SaaS.
2. Hybrid edge/cloud sync platform.
3. Billing.
4. Marketplace.
5. Separate engine-only product track.
6. Full white-label product mode.
7. SDK for multiple languages as mandatory deliverable.
8. Centralized fleet management across tenants.

## 10. Acceptance Criteria

P2 architecture hardening is accepted when:

1. Все P2 документы не противоречат single-tenant per-instance модели.
2. On-prem и managed-cloud описаны как deployment profiles одного продукта.
3. Hybrid и multi-tenant явно помечены out-of-scope.
4. Onboarding flow описан как claim/assign/issue/activate/verify.
5. API/webhook/versioning baseline закреплён как обязательный.

## 11. Source Alignment

Этот документ согласуется с:

- `docs/P2/P2-EVOLUTION.md`
- `docs/archive/P2-CLOSURE-SUMMARY.md`
- `docs/P2/API-REFERENCE.md`
- `docs/api-reference.md`

При конфликте деталей реализации source of truth для P2 остаётся `docs/P2/P2-EVOLUTION.md`; данный документ задаёт hardening-direction и scope boundaries.
