# P2 Parallel Polish Specification

Status: DRAFT (execution guardrails)  
Date: 2026-03-07  
Scope: parallel workstreams after P2 architecture hardening decisions

## 1. Purpose

Зафиксировать, какие треки можно запускать параллельно без рассогласования и без пересечения по архитектурным решениям P2.

Документ обязателен для всех parallel agents.

## 2. Non-Negotiable Guardrails

Все parallel треки обязаны соблюдать:

1. Single-tenant per instance (canonical model).
2. Two deployment profiles of the same product/codebase:
   - on-prem
   - managed cloud single-tenant
3. No hybrid edge/cloud sync in P2.
4. No multi-tenant SaaS in P2.
5. No separate engine-only product mode in P2.
6. No breaking API changes under `/api/v1` without explicit decision.

Reference: `docs/P2-hardening/HARDENING-SPEC.md`.

## 3. Parallel Tracks Allowed Now

## Track A: Device Onboarding / Claim Flow UX

Allowed:

- claim/activate screens and UX states;
- flow: `scan -> assign -> issue creds -> confirm online`;
- QR as SHOULD extension over manual flow;
- copy/text and operator guidance;
- error/retry UX.

Not allowed:

- change tenancy/deployment model;
- introduce mandatory manual MQTT operations in UI path;
- break existing provisioning API behavior.

## Track B: API/Webhook Contract Hardening

Allowed:

- versioning policy clarifications;
- webhook retry/signature semantics documentation;
- consistent error model;
- backward-compatibility notes;
- typed client for one language (DX baseline).

Not allowed:

- breaking `/api/v1` contract;
- changes that imply multi-tenant data model.

## Track C: Install / Deployment Polish

Allowed:

- compose profile polish;
- `.env` templates and validation notes;
- install/runbooks;
- backup/restore/troubleshooting docs;
- managed-cloud single-tenant checklist.

Not allowed:

- introducing deployment topology that conflicts with single-tenant model;
- hidden dependency on central metadata services for local mode.

## Track D: SDK / Developer Experience Minimum

Allowed:

- one typed client (recommended: TypeScript);
- webhook consumer examples;
- integration examples and quickstarts.

Not allowed:

- SDK commitments for multiple languages as P2 blocker;
- API surface changes without contract sync.

## Track E: Hardware / Provisioning Ops

Allowed:

- factory checklist;
- claim-code logistics;
- flashing flow;
- serial/label/QR payload format;
- batch provisioning operational tooling.

Not allowed:

- protocol changes that break payload/API contracts without RFC and sync.

## 4. Parallel Tracks Explicitly Deferred

Out of scope for parallel execution in P2:

1. Hybrid edge/cloud sync architecture.
2. Multi-tenant SaaS migration.
3. Full white-label / separate engine-only product track.
4. Large UI redesign unrelated to approved P2 function set.

## 5. Anti-Overlap Rules

1. One owner per runtime contour at a time:
   - `apps/server`
   - `apps/web`
   - `deploy/`
   - `docs/contracts`
2. If two tracks touch same contour, merge only through integration branch with explicit conflict review.
3. Any API change requires same-PR sync:
   - `docs/api-reference.md`
   - `docs/P2/API-REFERENCE.md`
   - `docs/openapi.json`
   - `docs/P2/openapi-p2.json`
4. Architecture decisions cannot be changed by polish tracks; only clarified.

## 6. Track Deliverables

Each parallel track must produce:

1. Change summary (what changed, what did not change).
2. Contract impact statement (API/UI/deploy/docs).
3. Regression checklist result.
4. Explicit note: "No conflict with P2 hardening guardrails".

## 7. Merge Gate (Definition of Done for Parallel Work)

A parallel track can be merged only if:

1. It does not violate Section 2 guardrails.
2. It does not introduce scope from Section 4.
3. It syncs affected contracts/docs.
4. It passes build/tests relevant to touched contours.
5. It includes rollback note for risky operational changes.

## 8. Coordination Protocol

1. Before starting: declare selected track (`A/B/C/D/E`) and touched contours.
2. During work: no cross-track architecture changes.
3. Before merge: publish short compatibility note against:
   - `docs/P2-hardening/HARDENING-SPEC.md`
   - `docs/P2/P2-EVOLUTION.md`

## 9. Canonical References

- `docs/P2-hardening/HARDENING-SPEC.md`
- `docs/P2/P2-EVOLUTION.md`
- `docs/archive/P2-CLOSURE-SUMMARY.md`
