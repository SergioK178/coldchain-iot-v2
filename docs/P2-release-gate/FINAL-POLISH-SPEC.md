# P2 Final Polish and Release Gate Specification

Status: ACTIVE  
Date: 2026-03-07  
Scope: decision gate and acceptance closure for P2 (no new feature expansion)

## 1. Objective

Перевести проект из режима "полировка" в режим "приёмка и запуск пилотов":

1. зафиксировать, что именно закрыто в P2;
2. подтвердить сквозную работоспособность в двух клиентских контурах;
3. закрепить продуктовые границы;
4. сформировать decision memo;
5. сделать жёсткий cut между P2 и P3.

## 2. Execution Rule

В рамках этого этапа запрещено:

1. добавлять новые продуктовые фичи;
2. расширять scope SHOULD без отдельного решения;
3. менять архитектурную модель single-tenant per instance.

Разрешено:

1. исправления багов, блокирующих приёмку;
2. синхронизация документации и контрактов;
3. эксплуатационные runbook/чеклисты;
4. release-quality hardening без изменения продуктового scope.

## 3. Workstream A — P2 Acceptance Freeze

### 3.1 Deliverable

Создать и утвердить `docs/P2-release-gate/P2-ACCEPTANCE.md` со статусами:

1. MUST: done/not done с ссылками на proof;
2. SHOULD: done/partial/deferred;
3. Explicit deferred to P3/backlog;
4. Legacy removal matrix (что удалено физически, что ещё только deprecated).

### 3.2 Mandatory checks

1. Auth/roles работают по актуальной P2-модели.
2. On-prem и managed маршруты разведены и описаны отдельно.
3. Onboarding flow живой end-to-end.
4. API/docs/OpenAPI не спорят друг с другом.
5. Legacy API_TOKEN runtime path удалён (если принято в текущем gate).
6. Install flow и Mosquitto reload path актуальны.
7. E2E проходят на текущей модели.

## 4. Workstream B — Dual-Contour Final Acceptance

### 4.1 Enterprise / On-Prem Trace

Runbook: `docs/P2-release-gate/RUNBOOK-ONPREM.md`

Обязательная трасса:

1. install с нуля;
2. admin bootstrap;
3. onboarding датчика через UI;
4. assign location/zone;
5. telemetry/status;
6. alert + webhook;
7. decommission/reprovision;
8. backup/restore;
9. security boundary checks.

### 4.2 Managed Trace

Runbook: `docs/P2-release-gate/RUNBOOK-MANAGED.md`

Обязательная трасса:

1. managed deployment;
2. first login;
3. onboarding без ручных MQTT шагов;
4. device activation;
5. users/roles;
6. webhook/integration path;
7. support/troubleshooting flow.

## 5. Workstream C — Product Boundary Freeze

### 5.1 Deliverable

`docs/P2-release-gate/PRODUCT-BOUNDARY.md`:

1. product = single-tenant cold-chain platform;
2. delivery modes = on-prem / managed cloud single-tenant;
3. onboarding = manual UI + claim/bootstrap;
4. QR = optional accelerator;
5. integrations = API/webhooks first;
6. explicitly not now = multi-tenant / hybrid.

### 5.2 Constraint

Документ обязателен для всех следующих roadmap-решений; изменения — только через decision memo.

## 6. Workstream D — Architecture/Business Decision Memo

### 6.1 Deliverable

`docs/P2-release-gate/ARCH-BUSINESS-MEMO.md`:

1. canonical architecture;
2. two client tracks;
3. why not multi-tenant now;
4. why not hybrid now;
5. enterprise value proposition;
6. SMB value proposition;
7. сознательно оставленный техдолг в P3.

### 6.2 Quality bar

Memo должен быть управленческим: короткий, без реализации вглубь, но с однозначными решениями.

## 7. Workstream E — P3 Cut and Backlog Gate

### 7.1 Deliverable

`docs/P2-release-gate/P3-CUT.md`:

1. P3 candidates (приоритет + обоснование);
2. SHOULD items, не блокирующие коммерческий запуск;
3. items explicitly rejected "not now".

### 7.2 Default direction

1. P3 only if market pull: multi-tenant/hybrid.
2. SDK expansion and deeper integrations: staged, demand-driven.
3. No marketplace/billing/large white-label expansion without economic trigger.

## 8. Workstream F — Pilot Operations Start

### 8.1 Deliverable

`docs/P2-release-gate/PILOT-PLAN.md`:

1. 1–2 controlled pilot installs;
2. onboarding friction capture;
3. managed/on-prem friction capture;
4. integration request capture;
5. decision loop back into P3-CUT.

### 8.2 Success criteria

1. Pilot install complete in both contours.
2. Top friction points ranked by impact.
3. Confirmed list of features that are truly valuable in real operation.

## 9. Final Gate Checklist

P2 can be marked "Accepted/Released" only if all are true:

1. Acceptance freeze document approved.
2. Both contour runbooks executed with evidence.
3. Product boundary signed off.
4. Architecture/business memo approved.
5. P3 cut approved.
6. Pilot plan approved and scheduled.

## 10. Evidence Format

Каждый workstream обязан приложить:

1. ссылку на deliverable doc;
2. status (`done` / `partial` / `blocked`);
3. owner;
4. date;
5. verification evidence (logs/screens/tests/links).
