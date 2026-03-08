# P2 Three-Track Execution Specification

Status: ACTIVE  
Date: 2026-03-07  
Scope: parallel execution model with minimal contract overlap

## 1. Purpose

Зафиксировать 3 параллельных трека P2 так, чтобы:

1. не конфликтовать по ownership;
2. не ломать архитектурные решения P2;
3. ускорить полировку без рассогласования API/UX/deployment.

## 2. Non-Negotiable Architecture Guardrails

Все треки обязаны соблюдать:

1. Canonical model: single-tenant per instance.
2. Supported profiles: on-prem + managed cloud single-tenant.
3. No multi-tenant SaaS in P2.
4. No hybrid edge/cloud sync in P2.
5. `/api/v1` changes are additive-first; no breaking changes without explicit decision.

References:

- `docs/P2-hardening/HARDENING-SPEC.md`
- `docs/P2/P2-EVOLUTION.md`

## 3. Track 1: Core Platform and Security

Role: backbone owner (source of truth for contracts and runtime constraints).

### In scope

1. Auth/roles/session model.
2. Security hardening and incident fixes.
3. Webhook v2 delivery/retry/signature rules.
4. F6 and broker auth-path mechanics.
5. Compatibility/versioning policy.
6. API contract changes with cross-product impact.
7. Deployment assumptions that affect all tracks.

### Out of scope

1. Onboarding UX implementation details above ready API contracts.
2. Hardware/factory operational process design.

### Ownership rights

1. Can change: `apps/server`, `deploy/`, API contracts/docs.
2. Must publish: contract diff + migration/compatibility note.

## 4. Track 2: Onboarding and Device Lifecycle

Role: device journey owner (activation friction reducer).

### In scope

1. Manual provisioning UX.
2. Claim/bootstrap and activation flow.
3. QR onboarding flow (SHOULD extension).
4. Assign location/zone during onboarding.
5. Replace/reprovision/decommission UX.
6. Onboarding error states and operator guidance.
7. Provisioning operations for device batches.

### Out of scope

1. Auth/session topology redesign.
2. Tenancy/deployment model changes.
3. Security policy redefinition (consumes Track 1 outputs).

### Ownership rights

1. Can change: `apps/web` onboarding/lifecycle surfaces, related docs.
2. Must consume: stable API contracts from Track 1.

## 5. Track 3: Delivery, Packaging and Client Routes

Role: customer-route owner (enterprise vs managed usability).

### In scope

1. On-prem vs managed deployment runbooks.
2. Compose profiles, setup scripts, `.env` templates.
3. First-admin and first-setup flow documentation.
4. Backup/restore and troubleshooting docs.
5. Packaging polish so solution is deployable without deep reverse engineering.
6. Navigation docs: where P1/P2 contracts live and which are authoritative.

### Out of scope

1. New onboarding domain logic.
2. API/security model changes owned by Track 1.

### Ownership rights

1. Can change: `deploy/` packaging docs, top-level docs/navigation.
2. Must not redefine: API behavior or domain rules.

## 6. Anti-Overlap Rules

1. Track 1 is the only track allowed to redefine API/security contracts.
2. Track 2 cannot change tenancy/auth/deployment assumptions.
3. Track 3 cannot invent alternate provisioning logic.
4. If two tracks touch one runtime contour in same cycle, integration happens only through explicit coordination note.

## 7. Contract Sync Rule (Mandatory)

Any change touching API behavior must update in the same PR:

1. `docs/api-reference.md`
2. `docs/P2/API-REFERENCE.md`
3. `docs/openapi.json`
4. `docs/P2/openapi-p2.json`

## 8. Merge Gate per Track

A track deliverable can be merged only if:

1. Guardrails in Section 2 are not violated.
2. Out-of-scope items were not pulled in.
3. Contract/docs sync is complete for touched surfaces.
4. Build/tests for touched contours pass.
5. Change note includes: what changed, what did not change, and why no cross-track conflict exists.

## 9. Execution Stages

### Stage 1 (Foundation Lock)

Owner: Track 1  
Goal: freeze core contracts and security posture for downstream tracks.

Exit criteria:

1. Auth/session and security assumptions fixed.
2. API compatibility rules explicitly documented.
3. Runtime deployment constraints published.

### Stage 2 (Device Journey)

Owner: Track 2  
Goal: complete onboarding/lifecycle UX on top of frozen contracts.

Exit criteria:

1. Claim/provision/assign/activate/decommission flow operational.
2. Error states and recovery paths defined.
3. No contract drift from Stage 1.

### Stage 3 (Delivery and Client Route Polish)

Owner: Track 3  
Goal: make enterprise and managed routes deployable and understandable.

Exit criteria:

1. On-prem and managed runbooks aligned.
2. Setup/troubleshooting docs complete and navigable.
3. Packaging does not require undocumented manual steps.

## 10. Deferred for P2

Explicitly not part of this execution model:

1. Multi-tenant SaaS.
2. Hybrid edge/cloud sync.
3. Billing/marketplace.
4. Separate engine-only product mode.
5. Full white-label product split.
