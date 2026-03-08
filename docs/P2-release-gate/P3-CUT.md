# P3 Cut and Backlog Gate

Date: 2026-03-07  
Reference: [FINAL-POLISH-SPEC.md](./FINAL-POLISH-SPEC.md) §7

---

## 1. P3 Candidates (Priority + Rationale)

| Item | Priority | Rationale |
|---|---|---|
| Multi-tenant SaaS | P3 only if market pull | Требует новой модели данных, изоляции, billing. Нет запроса. |
| Hybrid edge/cloud sync | P3 only if market pull | Сложная архитектура. Текущая модель достаточна. |
| PDF export (F9 completion) | Medium | CSV покрывает пилоты. PDF — по запросу. |
| Cursor для alert-events, audit-log, deliveries | Low | Volume небольшой. Добавить по необходимости. |
| MQTT over TLS (8883) | Medium | По запросу пилота (датчики вне LAN). |
| SDK expansion (Python, Go) | Demand-driven | TypeScript SDK есть. Остальные — по интеграторам. |
| Deeper integrations (iiko, 1C) | Demand-driven | Нет конкретных запросов. |
| OTA firmware | Separate track | Firmware team. |
| Redis для rate-limit / webhook queue | Low | In-memory достаточен. При росте — пересмотреть. |

---

## 2. SHOULD Items Not Blocking Commercial Launch

| Item | Status |
|---|---|
| F9 PDF | Backlog; CSV достаточен |
| Cursor для остальных endpoints | Backlog |
| SDK для нескольких языков | TypeScript есть; расширение — по спросу |
| Full white-label | Not now |
| Marketplace / Billing | Not now |

---

## 3. Explicitly Rejected "Not Now"

| Item | Reason |
|---|---|
| Multi-tenant без рыночного запроса | Нет экономического триггера |
| Hybrid без рыночного запроса | Сложность не оправдана |
| Billing / Marketplace | Self-hosted модель |
| Large white-label expansion | Нет B2B-партнёров |
| Kubernetes | Docker Compose покрывает масштаб P2 |
| Anomaly detection / ML | Нет объёма данных |
| Коннекторы iiko/1С | Нет запросов |

---

## 4. Default Direction

1. **P3 only if market pull**: multi-tenant, hybrid — по явному запросу рынка.
2. **SDK and integrations**: staged, demand-driven.
3. **No marketplace/billing/white-label expansion** без экономического триггера.

---

## 5. Decision Loop

Pilot feedback → ranked friction points → update P3-CUT priorities. Решения по новым фичам — через decision memo.
