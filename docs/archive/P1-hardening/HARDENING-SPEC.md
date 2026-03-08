# HARDENING-SPEC.md

## P1 Hardening Specification

**Version:** 1.0  
**Status:** ACTIVE - final stabilization pass before P1 acceptance  
**Scope:** Only hardening, alignment, verification, and pilot readiness for existing P1 implementation.  
**MUST NOT:** No scope expansion, no new product features, no architectural redesign outside the listed fixes.

---

## 1. Purpose

This document defines the final hardening pass required to close P1. Its purpose is to remove the remaining contract mismatches, align behavior across code and docs, and produce evidence that the implemented system behaves as specified in a controlled pilot environment.

This is **not** a new spec for new functionality. It is a stabilization checklist and implementation contract for the last corrective iteration before P1 sign-off.

---

## 2. Hardening goals

P1 can be considered accepted only if all of the following are true:

1. Runtime behavior is consistent with the documented contract.
2. Simulator, firmware guide, API docs, and implementation use the same rules.
3. Negative cases are verified, not just happy-path scenarios.
4. Pilot documentation reflects actual observed behavior.
5. Evidence of successful validation exists as saved artifacts, not only as code or scripts.

---

## 3. Hardening scope

This hardening pass covers only the following areas:

- MQTT connection lifecycle and offline detection semantics
- ACL and device permissions consistency
- MQTT credentials format consistency
- Verification evidence and acceptance artifacts
- Short operational hardening for controlled pilot use

Everything else remains governed by `MASTER-SPEC.md` and must not be changed unless a blocking defect forces a separate change request.

---

## 4. Mandatory fixes

### H1. Align LWT, graceful shutdown, and offline behavior

#### Problem
Different artifacts currently imply different offline semantics:
- LWT is correctly described as broker-side disconnect detection, not a generic "any disconnect" signal.
- Some test and simulator wording implies that graceful shutdown triggers immediate offline via LWT.
- README-level expectations may therefore be misleading even if code is functional.

#### Required decision
P1 must use one explicit and consistent contract:

**Primary contract for operator-visible offline state:**
- If a device stops sending telemetry and no disconnect signal is received, the system marks the device offline by timeout (`DEVICE_OFFLINE_TIMEOUT_SEC`).
- Graceful simulator stop is treated as a timeout-path scenario unless the simulator explicitly publishes a final status transition.

**Explicit LWT contract:**
- True LWT behavior is validated only when the MQTT session is terminated non-gracefully (process kill, crash, broken connection, forced disconnect from broker perspective).
- LWT must not be documented as guaranteed on graceful application shutdown unless the implementation intentionally simulates an offline state by explicit publish.

#### Required implementation actions
- Review simulator stop behavior and make it deterministic.
- Choose one of these two valid P1 patterns and document it everywhere:
  1. **Timeout path on graceful stop**: simulator exits cleanly, offline appears by timeout only.
  2. **Explicit offline publish on graceful stop**: simulator publishes status `0` before exit, and this is documented as simulator behavior, not true broker LWT.
- Keep a separate hardening test for real LWT (non-graceful termination).

#### Mandatory alignment targets
Update all affected sources so they say the same thing:
- `FIRMWARE-GUIDE.md`
- `README.md`
- simulator usage/help text
- E2E test expectations
- troubleshooting notes

#### Acceptance
- Controlled test confirms timeout-path offline.
- Separate controlled test confirms real LWT-path offline.
- Documentation no longer claims that graceful shutdown automatically triggers LWT unless that is explicitly implemented by a final status publish.

---

### H2. Align ACL contract and device permissions

#### Problem
There is still risk of mismatch between documented device permissions, firmware assumptions, and diagnostic procedures.

#### Required decision
For P1, use the strictest and simplest model:

**Device permissions in P1:**
- Device MAY publish only to:
  - `d/{serial}/t`
  - `d/{serial}/s`
- Device MUST NOT subscribe to any topic.
- Device MUST NOT publish to any other topic.

#### Required implementation actions
- Ensure ACL generation enforces publish-only permissions for device credentials.
- Ensure no firmware logic depends on subscribe permissions.
- Remove or rewrite any diagnostic examples that use `mosquitto_sub` with device credentials.
- If subscription-based diagnostics are needed, they MUST use admin/server credentials, not device credentials.

#### Mandatory alignment targets
Update all affected sources:
- `api-reference.md`
- `FIRMWARE-GUIDE.md`
- ACL generation logic
- test commands / README troubleshooting snippets

#### Acceptance
- Device credentials can publish only to own `t` and `s` topics.
- Device credentials are denied on any subscribe attempt.
- Device credentials are denied on publish to чужой topic.
- Diagnostic commands in docs no longer imply unsupported subscribe behavior for device credentials.

---

### H3. Align MQTT password contract

#### Problem
Password format must be identical across server generation, docs, firmware expectations, and examples.

#### Required decision
For P1, fix one explicit contract and use it everywhere:

**P1 password contract:**
- Plaintext device MQTT password is a **32-character lowercase hexadecimal string**.
- It is generated server-side using cryptographically secure randomness.
- Plaintext is returned once during provisioning and is not stored after response completion.
- Stored broker-side representation uses Mosquitto-compatible hashed format, as already defined in `MASTER-SPEC.md`.

#### Required implementation actions
- Ensure provisioning code emits exactly the agreed plaintext format.
- Ensure examples and firmware assumptions use the same format.
- Remove any example that implies mixed-case or arbitrary symbol sets.

#### Mandatory alignment targets
Update all affected sources:
- `MASTER-SPEC.md` (only if not already aligned)
- `api-reference.md`
- `FIRMWARE-GUIDE.md`
- `README.md`
- `provision-cli` output examples (if documented)

#### Acceptance
- Provisioning response returns password matching regex: `^[a-f0-9]{32}$`
- Firmware guide describes the same format
- Docs and examples no longer show contradictory password styles

---

### H4. Produce real verification evidence, not only test scripts

#### Problem
The existence of scripts is not equivalent to verified readiness. P1 can only be closed if real runs are executed and saved.

#### Required deliverables
Create and store a hardening evidence bundle with actual outputs from a clean run.

**Minimum required artifacts:**
- `artifacts/hardening/e2e-test.txt`
- `artifacts/hardening/e2e-with-simulators.txt`
- `artifacts/hardening/smoke-load.txt`
- `artifacts/hardening/provision-recovery.txt`
- `artifacts/hardening/backup-restore.txt`
- `artifacts/hardening/acl-negative.txt`
- `artifacts/hardening/lwt-timeout.txt`
- `artifacts/hardening/lwt-real-disconnect.txt`

If your team prefers, these may be `.md` files with pasted command outputs and short interpretation blocks.

#### Required test scenarios
1. **Cold start on clean environment**
   - New clean directory / VM
   - `docker compose up`
   - migrations and seed succeed
   - first provision succeeds

2. **Provision happy path**
   - device is provisioned
   - credentials work
   - telemetry is accepted

3. **Partial failure and reconcile**
   - simulate failure after DB mutation but before successful broker reload
   - API returns 500
   - system recovers via reconcile
   - final auth state matches DB truth

4. **ACL negative checks**
   - device subscribe denied
   - device publish to foreign topic denied

5. **Offline by timeout**
   - stop telemetry path
   - status becomes offline by timeout

6. **Real LWT / disconnect path**
   - non-graceful termination or equivalent forced disconnect
   - broker-side offline transition observed

7. **Backup and restore**
   - create backup
   - restore into clean environment
   - data and reconcile still valid after restore

8. **Smoke load**
   - limited simulator burst (for smoke only)
   - confirm basic stability
   - explicitly document that this is not a capacity claim

#### Acceptance
P1 cannot be signed off until the evidence bundle exists and all required scenarios pass.

---

### H5. Pilot-facing operational clarification

#### Problem
P1 is suitable for a controlled pilot, but the operational surface must be documented honestly.

#### Required actions
Add a short operational clarification section to pilot docs:

- UI shell is reachable in LAN; API calls still require token
- Swagger visibility in LAN is a deliberate P1 compromise
- MQTT 1883 must remain inaccessible from the public internet
- `docker.sock` access is a temporary P1 implementation compromise
- This build is for controlled pilot deployment, not broad unattended rollout

#### Mandatory alignment targets
Update:
- `README.md`
- `deploy/docs/security.md` (or equivalent security/troubleshooting doc)

#### Acceptance
Pilot docs clearly state the P1 security/operations boundary and do not overclaim production hardening.

---

## 5. Required document alignment matrix

The following files must be reviewed and synchronized during hardening:

- `docs/archive/MASTER-SPEC.md`
- `docs/api-reference.md`
- `docs/archive/openapi-p1.json` (only if any P1 API examples or constraints change)
- `README.md`
- `FIRMWARE-GUIDE.md`
- simulator CLI help / usage docs
- deploy security / troubleshooting docs

**Rule:** if a behavior is changed in code, the corresponding docs must be updated in the same hardening pass.

---

## 6. Hardening test plan

### 6.1 Functional checks

- Provision new device
- Confirm valid MQTT auth
- Send valid telemetry
- Confirm reading written
- Trigger alert and callback
- Acknowledge alert
- Decommission device
- Confirm credentials invalidated

### 6.2 Negative checks

- Invalid payload rejected
- Unknown device rejected
- Duplicate message ignored
- Device subscribe denied
- Device foreign publish denied
- Repeated acknowledge returns conflict

### 6.3 Recovery checks

- Reconcile after partial provisioning failure
- Reconcile after restart
- Reconcile after restore

### 6.4 Offline-state checks

- Timeout-based offline works
- Real disconnect/LWT-based offline works
- Docs describe each path accurately

---

## 7. Exit criteria for P1 closure

P1 is considered closed only when **all** of the following are true:

1. H1-H5 are fully completed.
2. All affected documentation is synchronized.
3. Evidence artifacts exist and are reviewable.
4. No remaining contradiction exists between:
   - code
   - runtime behavior
   - docs
   - examples
5. Controlled pilot can be run from a clean environment using the documented flow.

If any item is unresolved, P1 remains in hardening and is not marked fully accepted.

---

## 8. Non-goals

The following are explicitly out of scope for this hardening pass:

- New endpoints
- New UI pages
- TLS / HTTPS rollout
- User accounts / roles
- MQTT over TLS
- Webhook retries / HMAC
- SDKs for external languages
- Performance optimization beyond smoke validation
- P2/P3 feature pull-forward

---

## 9. Change control

Any change that alters runtime behavior beyond the hardening scope above must not be introduced silently. If a fix requires changing a frozen P1 contract, handle it through a small explicit change note against `MASTER-SPEC.md` before implementation.

---

## 10. Recommended execution order

1. Fix and align H1 (LWT/offline)
2. Fix and align H2 (ACL)
3. Fix and align H3 (password format)
4. Run H4 verification matrix and save artifacts
5. Update H5 pilot-facing docs
6. Review all aligned files once more
7. Mark P1 as accepted

---

## 11. Definition of done

This hardening pass is complete when the team can truthfully say:

- the code behaves as documented,
- the docs describe what actually happens,
- the remaining P1 compromises are explicitly stated,
- and a controlled pilot can be executed without hidden contract mismatches.
