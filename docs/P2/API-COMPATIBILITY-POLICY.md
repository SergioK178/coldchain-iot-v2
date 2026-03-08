# API Compatibility Policy

Scope: `/api/v1` — P2 baseline.  
Owner: Track 1 (Core Platform and Security).  
Reference: `docs/P2/P2-EVOLUTION.md` §7, `docs/P2-hardening/HARDENING-SPEC.md` §7.

---

## 1. Versioning Scheme

- Current API version: `/api/v1`
- All P2 endpoints live under `/api/v1`.
- Version increment (`/api/v2`) is triggered only by an intentional breaking change that cannot be introduced additively.
- Explicit decision required before any breaking change. Default rule: additive-first.

---

## 2. What Is a Breaking Change

A change is **breaking** if it can cause an existing well-formed client request to receive a different response shape, a different HTTP status code, or a removed field.

| Change type | Breaking? |
|---|---|
| Remove endpoint | YES |
| Rename field in response | YES |
| Change field type | YES |
| Change HTTP status code for existing case | YES |
| Add required request field to existing endpoint | YES |
| Remove enum value client may send | YES |
| Change auth requirement on previously public endpoint | YES |
| Add new endpoint | NO |
| Add optional field to request | NO |
| Add field to response | NO (additive) |
| Add new enum value | NO (additive) |
| Add new error code to existing endpoint | NO (additive, clients must handle unknown codes) |
| Add `cursor` to paginated response | NO (additive, per P2-EVOLUTION invariant #10) |

---

## 3. Process for Breaking Changes

1. Explicit decision recorded in a decision document (reference `docs/P2/P2-EVOLUTION.md` §5 pattern).
2. Migration note published alongside the change.
3. Deprecated path kept for at least one full release cycle before removal.
4. Change announced in `docs/api-reference.md` and `docs/P2-release-gate/P2-ACCEPTANCE.md`.

No breaking changes to `/api/v1` are planned or approved for P2.

---

## 4. Deprecation Policy

| Entity | Status | Removal target |
|---|---|---|
| `?actor=` query param override | Removed (P2 hardening) — `actor` is now derived from auth context only | Done |

---

## 5. Auth Contract (stable for Track 2 consumption)

The following is frozen for P2 and must not be changed without a Track 1 decision:

**Resolution order** (Fastify auth plugin):
1. `Authorization: Bearer <JWT>` → verify HS256 with `JWT_SECRET` → extract `{ sub, email, role }`.
2. Neither → `401 UNAUTHORIZED`.

**Actor rules** (for audit log):
- JWT: `actor = users.email`
- `?actor=` param ignored

**Public paths** (no auth required):
- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `/api/docs` and `/api/docs/*`

**Refresh token security model:**
- Value: 32-byte cryptographically random, base64url-encoded.
- Stored: HMAC-SHA256(JWT_SECRET, value) — requires both DB and `JWT_SECRET` to forge.
- Delivered: HTTP-only cookie (`SameSite=Lax`; `Secure` when HTTPS).
- Rotation: every refresh issues a new token and revokes the old one.
- Revocation: `POST /auth/logout` deletes the token from DB. Rotating `JWT_SECRET` invalidates all sessions.

**Role enforcement matrix** (frozen):

| Action | admin | operator | viewer |
|---|---|---|---|
| Manage users | yes | — | — |
| Provision / decommission / rotate-mqtt | yes | — | — |
| Manage locations / zones | yes | — | — |
| Configure webhooks | yes | — | — |
| Create / edit / delete alert rules | yes | yes | — |
| Acknowledge alerts | yes | yes | — |
| View devices, readings, alerts, audit | yes | yes | yes |
| Export CSV | yes | yes | yes |
| Calibration records (create) | yes | yes | — |

---

## 6. Webhook Contract (stable)

- HMAC: `X-Signature-256: sha256=<hex(HMAC-SHA256(secret, rawBody))>` — same format as GitHub webhooks.
- Retry: max 5 attempts. Backoff: 10s → 30s → 2m → 10m → 30m.
- Success: HTTP 2xx → marked delivered, no further retries.
- URL policy: `http`/`https` only; localhost, private, link-local, metadata IPs rejected; no redirect following.
- All webhooks are signed (no unsigned webhooks in P2).

**Events:**

| Event | Trigger |
|---|---|
| `alert.triggered` | Alert rule threshold crossed |
| `alert.acknowledged` | Alert acknowledged by operator |
| `device.online` | Device transitions to online |
| `device.offline` | Device offline timeout exceeded |
| `device.provisioned` | New device provisioned |
| `device.decommissioned` | Device decommissioned |

---

## 7. F6 Auth-Path Contract (stable)

The `MOSQUITTO_RELOAD_URL` path (auth-sync sidecar) is the canonical P2 reload mechanism:

- Server calls `POST {MOSQUITTO_RELOAD_URL}` after any provisioning/decommission/rotation operation.
- The sidecar rebuilds `passwd`/`acl` from DB and sends SIGHUP to Mosquitto within its own container.
- `docker.sock` is **not** mounted on the `server` container.

No legacy docker.sock fallback exists in current P2 runtime: `MOSQUITTO_RELOAD_URL` is required.

---

## 8. Response Envelope (invariant)

```json
{ "ok": true,  "data": <T> }
{ "ok": false, "error": { "code": "<ErrorCode>", "message": "<string>" } }
```

Paginated endpoints may include a top-level `cursor` field alongside `data`:
```json
{ "ok": true, "data": [...], "cursor": "<opaque>" | null }
```

This is an additive extension, not a breaking change (per P2-EVOLUTION invariant #10).

---

## 9. Migration Note — hashRefreshToken Fix (Track 1 Stage 1)

**Change:** `hashRefreshToken` now uses `JWT_SECRET` as the HMAC key instead of the previously hardcoded string `'refresh'`.

**Impact:** All refresh tokens issued before this deployment are invalidated. Users must re-authenticate (log in again). Access tokens remain valid until their 15-minute TTL expires.

**Operator action:** None required beyond normal deployment. If rolling deployment (old and new instances running simultaneously), affected users will see a single re-login prompt.

**Rollback:** Reverting `JWT_SECRET` change is not possible without invalidating all sessions. Reverting the code change restores the old hash function but existing tokens (hashed with new key) will not match and users must re-authenticate again.
