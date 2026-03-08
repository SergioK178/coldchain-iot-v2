# Product Boundary Freeze

Status: **FROZEN**  
Date: 2026-03-07  
Constraint: изменения только через decision memo.  
Reference: [FINAL-POLISH-SPEC.md](./FINAL-POLISH-SPEC.md) §5

---

## 1. Product Definition

**Product** = single-tenant cold-chain monitoring platform.

Один инстанс = один клиент (организация). Нет multi-tenant в одном runtime.

---

## 2. Delivery Modes

| Mode | Описание |
|---|---|
| **On-prem** | Развёртывание в LAN клиента. Docker Compose. Source of truth — локальные server + db. |
| **Managed cloud single-tenant** | Отдельный инстанс под клиента в облаке. Тот же codebase. Не SaaS с общим пулом. |

Оба режима — один продукт, один контракт.

---

## 3. Onboarding

- **Manual UI** + claim/bootstrap — MUST.
- **QR** — optional accelerator (SHOULD), не замена manual flow.
- Flow: claim → assign location/zone → issue credentials → activate → verify.
- UI-path не требует ручной работы с MQTT topics/ACL.

---

## 4. Integrations

- **API-first**: все функции доступны через REST API.
- **Webhooks**: retry, HMAC-SHA256, события alert/device.
- OpenAPI, compatibility policy обязательны.

---

## 5. Explicitly Not Now

| Item | Причина |
|---|---|
| Multi-tenant SaaS | Один инстанс = один клиент. Нет давления на multi-tenant. |
| Hybrid edge/cloud sync | Стратегически отложено до P3+. |
| Billing / Marketplace | Self-hosted, нет подписки. |
| Separate engine-only product | Business logic в server; UI обязателен для операций. |
| Full white-label | Нет B2B-партнёров. |
| Centralized fleet across tenants | Нет multi-tenant. |

---

## 6. Amendment Process

Изменения границ — только через decision memo с одобрением. Этот документ — baseline для roadmap P3 и далее.
