# P2 Hardening / Optimization / Cleanup Specification

Status: ACTIVE  
Date: 2026-03-07  
Scope: final system hardening cycle within current P2 architecture

## 1) Goal and Scope Boundary

Цель цикла: довести текущую систему до максимально устойчивого, быстрого, безопасного, эксплуатационно предсказуемого и удобного состояния **без изменения базовой архитектуры**.

Этот документ не является новым product spec и не добавляет новые крупные фичи.  
Он задаёт рамки анализа, критерии проблем, требования к evidence и выходные артефакты для последующей декомпозиции в execution plan.

## 2) Invariants (Do Not Break)

В рамках цикла не ломаем:

1. Single-tenant per instance.
2. Deployment profiles: on-prem + managed single-tenant.
3. Текущую P2 auth/session topology.
4. Действующие API/webhook contracts (additive-only policy).
5. Принятые P2 архитектурные решения и release-gate guardrails.

## 3a) Alignment with Release-Gate Artifacts

Workstream E (Documentation Cleanup) обязан учитывать и не конфликтовать с:

- `docs/P2-release-gate/` — P2-ACCEPTANCE, runbooks, PRODUCT-BOUNDARY, P3-CUT, PILOT-PLAN
- `docs/README.md` — навигация по контрактам и deploy docs

Cleanup не переопределяет утверждённые release-gate документы. При конфликте source of truth — release-gate.

## 3) Explicit Out of Scope

В цикл не входят:

1. Multi-tenant architecture.
2. Hybrid edge/cloud sync.
3. Billing/marketplace.
4. Крупные новые модули.
5. Экспериментальные P3-функции.
6. Любые изменения, меняющие базовую архитектуру или продуктовые режимы.

## 4) Severity and Impact Model

| Severity | Definition | Typical action |
|---|---|---|
| High | Нарушает безопасность/целостность/доступность, блокирует пилот или эксплуатацию | Обязательно исправить до sign-off |
| Medium | Существенно ухудшает стабильность, UX или ops, но есть обходной путь | Исправить в текущем цикле либо formally defer с риском |
| Low | Локальная полировка, не блокирует эксплуатацию | Nice-to-have, по остаточному бюджету |

| Impact | Definition |
|---|---|
| Critical | Потеря данных, security exposure, массовая недоступность |
| Major | Нарушение ключевого user flow, высокая операционная нагрузка |
| Minor | Ограниченный эффект, не влияет на core journey |

## 5) Parallel Sub-Contours

## A. System Hardening

Состав: reliability, performance, security, operations.

## B. Documentation Cleanup

Состав: inventory, merge, rename, source-of-truth map.

## C. UX/UI Polish

Состав: onboarding, error states, readability, speed perception, interaction quality.

## 5a) Execution Phases

| Phase | Цель | Выход |
|---|---|---|
| **Phase 1: Evaluation** | Выполнить required checks, собрать evidence | Findings, problem list, doc inventory |
| **Phase 2: Fixes** | Исправить mandatory issues, nice-to-have по бюджету | Patches, mitigations |
| **Phase 3: Sign-off** | Подтвердить DoD, собрать acceptance package | HARDENING-REPORT.md, pilot readiness |

## 6) Workstream A: Reliability and Stability

### Evaluation targets

1. Crash/failure scenarios.
2. Race conditions and concurrency bugs.
3. Partial failure paths (upstream/downstream unavailable).
4. Retry/reconnect behavior.
5. Degradation and recovery logic.
6. Dependency instability and timeout handling.

### What is a bug here

1. Непредсказуемые 5xx в штатных сценариях.
2. Потеря состояния при частичной деградации.
3. Невосстанавливаемый flow после transient failure.
4. Non-idempotent side effects при retry.

### Required checks

Manual:
1. Login/session refresh under concurrent requests.
2. Provision/decommission/reconcile under service restarts.
3. Recovery after db/mqtt/web temporary outage.

Automated/integration:
1. Core e2e flow (onboard -> telemetry -> alert -> acknowledge -> decommission).
2. Retry path assertions for webhook delivery.
3. Health/recovery smoke after restart/redeploy.

Evidence:
1. Error logs with timestamps/correlation.
2. Reproduction notes.
3. Recovery timings (MTTR-like observations).
4. Flaky test list (if any).

## 7) Workstream B: Performance and Bottlenecks

### Evaluation targets

1. Slow UI pages and route transitions.
2. Heavy DB queries / missing indexes / expensive scans.
3. Excessive rerenders / client-side inefficiencies.
4. Webhook retry pressure and queue behavior.
5. MQTT throughput/latency under realistic load.
6. Memory/CPU hotspots and cold-start penalties.

### What is a bottleneck

1. P95/P99 latency materially above baseline for core operations.
2. Resource growth without stabilization under normal load.
3. Unbounded queue/retry pressure.
4. UI interaction delays harming operator flow.

### Required checks

Manual:
1. Devices/alerts/onboarding page responsiveness.
2. Perceived speed checks on common operator tasks.

Automated/load:
1. Baseline load scenario for telemetry ingestion.
2. API timings for high-traffic endpoints.
3. Query profiling (`EXPLAIN ANALYZE`) for slow paths.

Evidence:
1. Endpoint timings (p50/p95/p99 where possible).
2. Profiling notes (CPU/memory snapshots).
3. SQL explain artifacts.
4. UI performance findings (lighthouse-like or equivalent).

## 8) Workstream C: Security Hardening

### Evaluation targets

1. Auth/session/cookie misuse paths.
2. Privilege boundaries and role enforcement.
3. Sensitive data leakage in logs/errors.
4. Webhook signing and destination safety.
5. API/broker exposure and insecure defaults.
6. Recovery and incident-response readiness.

### What is unacceptable

1. Bypass path for auth/role checks.
2. Sensitive secrets/tokens in logs.
3. Unsafe default exposure of control-plane endpoints.
4. Missing verification for signed callbacks.
5. Critical SSRF-like outbound abuse vectors.

### Required checks

Manual:
1. Privilege boundary walk-through per role.
2. Cookie behavior in split-origin and HTTPS modes.
3. Endpoint exposure review (internal vs public).

Automated/security tests:
1. Negative auth tests (401/403/429 behavior).
2. Webhook signature validation tests.
3. Basic misuse-path regression suite.

Evidence:
1. Security finding list with severity/impact.
2. Repro steps and affected surfaces.
3. Mitigation status per finding.

## 9) Workstream D: Operational Robustness

### Evaluation targets

1. Backup/restore correctness and timing.
2. Migration safety and rollback expectations.
3. Deploy/redeploy/update predictability.
4. Reconcile behavior and observability.
5. Troubleshooting quality and supportability.
6. Consistency between on-prem and managed procedures.

### What is unacceptable

1. Restore cannot reliably recover functional state.
2. Undocumented mandatory manual recovery steps.
3. Deploy path with frequent non-deterministic failures.
4. Missing operational visibility for core incidents.

### Required checks

Manual:
1. Fresh install run.
2. Upgrade/redeploy run.
3. Backup -> restore -> functional verification run.

Operational drills:
1. Service restart and health stabilization.
2. Reconcile failure and recovery drill.

Evidence:
1. Runbook execution logs.
2. Recovery timings.
3. Known operational risks with mitigations.

## 10) Workstream E: Documentation Cleanup

См. §3a — alignment с `docs/P2-release-gate/` и `docs/README.md`.

### Evaluation targets

1. Full docs inventory.
2. Duplicate/conflicting docs detection.
3. Source-of-truth mapping.
4. Merge/rename/archive plan.
5. Final navigation and taxonomy.

### What is a documentation defect

1. Two docs define conflicting runtime behavior.
2. Deprecated path shown as active.
3. Missing canonical reference for key workflows.
4. Broken onboarding of new engineer/operator due to doc structure.

### Required checks

1. Doc conflict matrix (file A vs file B vs canonical source).
2. Final taxonomy table: authoritative vs supporting docs.
3. README and entry-point navigation validation.

Evidence:
1. Inventory list.
2. Conflict list with resolution action.
3. Final doc map after cleanup.

## 11) Workstream F: UX/UI Hardening

### Evaluation targets

1. Onboarding clarity and friction.
2. Error/recovery state quality.
3. Visual hierarchy and information scent.
4. Empty/loading/edge-state clarity.
5. CTA clarity and copy consistency.
6. Speed perception and interaction quality.

### Unacceptable UX criteria

1. Core tasks require engineering context.
2. Error states do not guide recovery.
3. Operators can get stuck without next action.
4. UI inconsistency causes repeated misuse or confusion.

### Required checks

Manual:
1. Task walkthroughs for first-time operator.
2. Onboarding and device lifecycle walk-through.
3. Error-path usability checks.

Evidence:
1. UX issue list with severity and flow impact.
2. Screenshots of problematic states.
3. Proposed fix notes grouped by effort.

## 12) Mandatory Test Matrix

| Category | Manual | Automated | Load/Integration | Required |
|---|---|---|---|---|
| Reliability | Yes | Yes | Yes | Yes |
| Performance | Yes | Partial | Yes | Yes |
| Security | Yes | Yes | Partial | Yes |
| Operations | Yes | Partial | Yes | Yes |
| Docs | Yes | N/A | N/A | Yes |
| UX/UI | Yes | Optional | N/A | Yes |

## 13) Workstream Outputs (Required Artifacts)

Итогом цикла должны быть:

1. Подтверждённый список проблем с severity + impact.
2. Список архитектурных ограничений, сознательно оставленных в рамках этого цикла.
3. Список обязательных исправлений до sign-off.
4. Список nice-to-have полировок.
5. Финальная карта документации после cleanup.
6. Acceptance пакет для pilot/next-stage rollout.

**Единый выходной артефакт:** `docs/P2-release-gate/HARDENING-REPORT.md` — сводный отчёт, объединяющий пункты 1–6, evidence и статус по workstream.

## 14) Acceptance Criteria (Hardening Cycle DoD)

Цикл считается завершённым, если:

1. Нет известных high-severity reliability/security проблем.
2. Основные bottlenecks устранены или formally documented как архитектурные пределы.
3. Интерфейс не требует инженерного знания для базовых операций.
4. Документация имеет единую структуру и не конфликтует сама с собой.
5. Система готова к controlled pilot / next-stage rollout без признаков "сырого" состояния.

## 15) Handoff to Execution Plan

Этот spec является входом для детального execution plan.  
Декомпозиция задач должна идти по трём параллельным подконтурам:

1. System hardening.
2. Documentation cleanup.
3. UX/UI polish.

Каждая задача в плане обязана содержать:

1. owner,
2. expected artifact,
3. severity/impact linkage,
4. verification method,
5. dependency and rollback note (если применимо).
