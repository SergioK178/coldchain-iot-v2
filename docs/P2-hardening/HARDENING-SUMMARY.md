# HARDENING-SUMMARY.md

## P2 Hardening — итоги выполнения

**Дата:** 2026-03-07  
**Спецификация:** [HARDENING-SPEC.md](./HARDENING-SPEC.md)

---

## H1: Provisioning — устранён лишний reconcile

### Контракт

При регистрации нового устройства reconcile Mosquitto должен происходить ровно один раз — после записи устройства в БД. Лишние вызовы до проверки уникальности серийного номера недопустимы.

### Что изменено

- **`apps/server/src/services/provision.ts`**: удалён вызов `reconcileMosquitto` перед проверкой существования устройства. Порядок теперь: check → insert → reconcile. Двойная нагрузка на sidecar при попытке provision уже существующего устройства устранена.

---

## H2: Onboarding — guided flow по схеме claim/assign/issue/activate/verify

### Контракт

Onboarding должен идти как guided flow из пяти явных шагов; оператор не должен вручную работать с MQTT topics или ACL в UI-path. HARDENING-SPEC §6.2.

### Что изменено

- **`apps/web/app/onboard/page.tsx`**: страница полностью переработана как 5-шаговый wizard с индикатором прогресса:
  1. Заявить (Claim) — ввод серийного номера или QR-скан
  2. Назначить (Assign) — выбор локации и зоны
  3. Выдать (Issue) — MQTT-credentials, одноразовый показ, copy-кнопки
  4. Активировать (Activate) — инструкция по настройке прошивки
  5. Проверить (Verify) — автоматический polling статуса устройства каждые 5 секунд

MQTT topics и ACL управляются сервером автоматически; оператор видит только результат.

---

## H3: README — актуализация под P2

### Контракт

README не должен описывать P1-ограничения как актуальные (docker.sock, API_TOKEN-only, отсутствие ролей) и должен явно отражать deployment profiles и auth-модель P2. HARDENING-SPEC §2, §3, §7, §8.

### Что изменено

- **`README.md`**: полностью переписан:
  - Single-tenant per instance как canonical model, два deployment profile (On-Prem / Managed Cloud).
  - Multi-tenant, hybrid edge/cloud, billing — явно out of scope P2.
  - Аутентификация: JWT + refresh cookie; API_TOKEN — deprecated M2M fallback.
  - Роли: таблица admin/operator/viewer.
  - Onboarding: описан guided 5-шаговый flow вместо curl-примера.
  - Webhook v2: retry, HMAC-SHA256, пример создания через API.
  - Удалены устаревшие разделы «Ограничения P1», «Веб-интерфейс» в P1-стиле.

---

## H4: Architectural documentation closure

### Контракт

Acceptance criteria HARDENING-SPEC §10: все P2-документы не противоречат single-tenant per-instance модели; deployment profiles описаны; out-of-scope явно зафиксированы; onboarding flow задокументирован; API/webhook/versioning baseline закреплён.

### Что изменено

- **`docs/P2-hardening/HARDENING-SPEC.md`**: статус обновлён с DRAFT на CLOSED, добавлена ссылка на данный документ.
- **`docs/archive/P2-CLOSURE-SUMMARY.md`**: добавлена ссылка на architecture hardening closure.

---

## Acceptance criteria — результат

| # | Критерий | Результат |
|---|---|---|
| 1 | Все P2 документы не противоречат single-tenant per-instance модели | Выполнен (README, HARDENING-SPEC) |
| 2 | On-prem и managed-cloud описаны как deployment profiles одного продукта | Выполнен (README §Architecture) |
| 3 | Hybrid и multi-tenant явно помечены out-of-scope | Выполнен (README, HARDENING-SPEC §9) |
| 4 | Onboarding flow описан как claim/assign/issue/activate/verify | Выполнен (onboard/page.tsx, README) |
| 5 | API/webhook/versioning baseline закреплён как обязательный | Выполнен (P2-EVOLUTION.md frozen, API-REFERENCE.md, openapi.json) |
