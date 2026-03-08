# Документация платформы

**Единая точка навигации** по всей документации ColdChain IoT.

---

## Быстрые ссылки

| Задача | Документ |
|--------|----------|
| Установить платформу | [install-guide.md](../deploy/docs/install-guide.md) |
| Зарегистрировать датчик | [hardware-provisioning.md](../deploy/docs/hardware-provisioning.md) |
| Статус P2 (MUST/SHOULD) | [P2-ACCEPTANCE.md](P2-release-gate/P2-ACCEPTANCE.md) |
| API контракт | [api-reference.md](api-reference.md) · [openapi.json](openapi.json) |
| Спецификация для прошивки | [sensor/MASTER-SPEC.md](sensor/MASTER-SPEC.md) |

---

## Контракты и API

| Документ | Роль |
|----------|------|
| [api-reference.md](api-reference.md) | Unified API (P1 + P2) |
| [openapi.json](openapi.json) | Combined OpenAPI |
| [P2/API-REFERENCE.md](P2/API-REFERENCE.md) | P2 API details |
| [P2/API-COMPATIBILITY-POLICY.md](P2/API-COMPATIBILITY-POLICY.md) | Политика совместимости |
| [P2/P2-EVOLUTION.md](P2/P2-EVOLUTION.md) | P2 source of truth |
| [P2/openapi-p2.json](P2/openapi-p2.json) | P2 OpenAPI additions |

---

## Release gate

| Документ | Описание |
|----------|----------|
| [P2-ACCEPTANCE.md](P2-release-gate/P2-ACCEPTANCE.md) | MUST/SHOULD status (canonical) |
| [GATE-STATUS.md](P2-release-gate/GATE-STATUS.md) | Статус workstream и checklist |
| [RUNBOOK-ONPREM.md](P2-release-gate/RUNBOOK-ONPREM.md) | On-prem trace |
| [RUNBOOK-MANAGED.md](P2-release-gate/RUNBOOK-MANAGED.md) | Managed cloud trace |
| [PRODUCT-BOUNDARY.md](P2-release-gate/PRODUCT-BOUNDARY.md) | Границы продукта |
| [P3-CUT.md](P2-release-gate/P3-CUT.md) | P3 backlog |
| [PILOT-PLAN.md](P2-release-gate/PILOT-PLAN.md) | План пилота |
| [ARCH-BUSINESS-MEMO.md](P2-release-gate/ARCH-BUSINESS-MEMO.md) | Архитектурный меморандум |
| [HARDENING-REPORT.md](P2-release-gate/HARDENING-REPORT.md) | Отчёт hardening |
| [HARDENING-OPTIMIZATION-CLEANUP-SPEC.md](P2-release-gate/HARDENING-OPTIMIZATION-CLEANUP-SPEC.md) | Спецификация hardening |
| [FINAL-POLISH-SPEC.md](P2-release-gate/FINAL-POLISH-SPEC.md) | Финальная полировка |

---

## Архитектура и UI

| Документ | Описание |
|----------|----------|
| [P2-hardening/HARDENING-SPEC.md](P2-hardening/HARDENING-SPEC.md) | Архитектурные решения P2 |
| [P2-hardening/HARDENING-SUMMARY.md](P2-hardening/HARDENING-SUMMARY.md) | Итоги hardening |
| [P2/UI-SPEC.md](P2/UI-SPEC.md) | UI stack и baseline |
| [P2/SECURITY-HARDENING.md](P2/SECURITY-HARDENING.md) | Security hardening |
| [P2/F6-DECISION.md](P2/F6-DECISION.md) | Решение F6 (Mosquitto auth) |
| [P2-release-gate/UX-UI-EVALUATION.md](P2-release-gate/UX-UI-EVALUATION.md) | Оценка UX/UI и рекомендации |

---

## Датчики (firmware)

| Документ | Описание |
|----------|----------|
| [sensor/MASTER-SPEC.md](sensor/MASTER-SPEC.md) | Спецификация для репо датчиков (прошивка) |

---

## Развёртывание

| Документ | Описание |
|----------|----------|
| [install-guide.md](../deploy/docs/install-guide.md) | Установка |
| [security.md](../deploy/docs/security.md) | Безопасность |
| [backup-restore.md](../deploy/docs/backup-restore.md) | Резервное копирование |
| [managed-cloud-checklist.md](../deploy/docs/managed-cloud-checklist.md) | Managed cloud checklist |
| [hardware-provisioning.md](../deploy/docs/hardware-provisioning.md) | Hardware provisioning |

---

## Архив

Исторические документы: [archive/](archive/)

| Документ | Описание |
|----------|----------|
| [archive/README.md](archive/README.md) | Навигация по архиву |
| [archive/MASTER-SPEC.md](archive/MASTER-SPEC.md) | P1 spec |
| [archive/P1/](archive/P1/) | P1 API, firmware guide |
| [archive/P1-hardening/](archive/P1-hardening/) | P1 hardening |
| [archive/P2-parallel-polish/](archive/P2-parallel-polish/) | P2 polish execution |
| [archive/P2-CLOSURE-SUMMARY.md](archive/P2-CLOSURE-SUMMARY.md) | P2 closure (canonical: P2-ACCEPTANCE) |
