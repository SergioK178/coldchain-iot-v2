# Architecture & Business Decision Memo

Date: 2026-03-07  
Audience: Management, Product  
Reference: [FINAL-POLISH-SPEC.md](./FINAL-POLISH-SPEC.md) §6

---

## 1. Canonical Architecture

**Single-tenant per instance.** Один runtime stack (web + server + mqtt + db) = один клиент. Один domain model, один API-контракт. Source of truth — server + db данного инстанса. MQTT broker локален. Нет обязательных облачных метаданных для работы локального режима.

---

## 2. Two Client Tracks

| Track | Целевой сегмент | Модель поставки |
|---|---|---|
| **Enterprise / On-prem** | Крупные клиенты, LAN, контроль над инфраструктурой | Docker Compose на площадке клиента |
| **SMB / Managed** | Малый бизнес, нужна простота | Отдельный single-tenant инстанс в облаке под клиента |

Оба — один продукт, один codebase. Разные runbook и каналы доставки.

---

## 3. Why Not Multi-Tenant Now

- Один инстанс = одна организация покрывает текущий спрос.
- Multi-tenant требует отдельной модели данных, изоляции, billing — уровень новой платформы.
- Нет экономического триггера для перехода. Решение — по рыночному запросу (P3+).

---

## 4. Why Not Hybrid Edge/Cloud Now

- Hybrid подразумевает синхронизацию edge ↔ cloud, конфликт-резолюшн, офлайн-first логику.
- Текущая модель: датчики → MQTT → server. Простая и достаточная для пилотов.
- Hybrid — отдельный архитектурный трек, не в scope P2.

---

## 5. Enterprise Value Proposition

- **Local-first**: данные на площадке клиента, нет зависимости от внешнего облака.
- **API discipline**: интеграции через REST + webhooks, OpenAPI, совместимость.
- **Роли и аудит**: разграничение операторов, журнал действий.
- **ХАССП-релевантность**: калибровки, экспорт, правила тревог.

---

## 6. SMB Value Proposition

- **Managed deployment**: не нужно поднимать инфраструктуру самостоятельно.
- **Один инстанс под клиента**: изоляция без сложности multi-tenant.
- **Тот же UI и API**: операторы и интеграторы работают одинаково.

---

## 7. Conscious Tech Debt (P3)

- PDF export — backlog.
- Cursor pagination для alert-events, audit-log, webhook deliveries — по необходимости.
- Cursor для остальных list-endpoints — staged.
- MQTT over TLS — по запросу пилота.
- In-memory rate limit — при росте рассмотреть Redis.
- Swagger UI в production — по решению (отключить или ограничить).

---

## 8. Approval

- [ ] Architecture approved
- [ ] Business value approved
- [ ] P3 cut approved
