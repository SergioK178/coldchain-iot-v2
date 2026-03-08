# Managed Cloud Single-Tenant Deployment Checklist

Model: **single-tenant per instance** (one customer = one stack).  
This is not a multi-tenant SaaS setup. Each customer receives a dedicated instance.

---

## Pre-Deployment

- [ ] Dedicated VM or container environment provisioned (1+ GB RAM, 10+ GB disk).
- [ ] Docker Engine 24+ and Docker Compose v2 installed.
- [ ] Domain name or static IP assigned to the instance.
- [ ] TLS certificate plan confirmed:
  - Option A: Public domain → Caddy ACME auto-cert.
  - Option B: Internal CA → supply cert via Caddyfile.

---

## Secrets Generation

Generate all secrets before starting. Use a password manager or secrets vault.

```bash
# DB_PASSWORD and MQTT_ADMIN_PASSWORD
openssl rand -hex 32

# JWT_SECRET (minimum 64 chars)
openssl rand -hex 64
```

- [ ] `DB_PASSWORD` — unique per instance, ≥ 32 chars.
- [ ] `MQTT_ADMIN_PASSWORD` — unique per instance, ≥ 32 chars.
- [ ] `JWT_SECRET` — unique per instance, ≥ 64 chars.
- [ ] `ADMIN_EMAIL` — set to customer's admin email or a managed ops address.
- [ ] `ADMIN_PASSWORD` — ≥ 16 chars, communicated securely to customer.

Secrets stored in: _(your secrets manager — Vault, AWS SSM, 1Password Secrets Automation, etc.)_

---

## Environment Configuration

```bash
cd deploy
cp .env.example .env
# Fill in all required secrets
```

- [ ] All required `.env` fields filled.
- [ ] `PUBLIC_API_URL` set to the public-facing API URL (e.g. `https://api.customer-a.example.com`).
- [ ] `AUTH_COOKIE_SECURE=true` for HTTPS deployments.
- [ ] `WEBHOOK_ALLOWLIST_HOSTS` configured if customer uses webhooks to internal systems.

---

## Network & TLS

- [ ] Ports not exposed publicly:
  - `MQTT_PORT` (1883) — LAN only; block at cloud firewall.
  - `DB` — not exposed externally.
- [ ] HTTPS enabled (Caddy profile):
  ```bash
  docker compose --profile https up -d
  ```
- [ ] `Caddyfile` updated with customer domain.
- [ ] HTTP→HTTPS redirect verified.

---

## First Start

```bash
docker compose up -d
docker compose ps   # wait for all services: healthy
```

- [ ] All containers report `healthy`.
- [ ] Health endpoint responds:
  ```bash
  curl https://api.customer-a.example.com/api/v1/health
  ```
- [ ] Admin login works:
  ```bash
  curl -X POST https://api.customer-a.example.com/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@...","password":"..."}'
  ```
- [ ] Reconcile logged in server output:
  ```
  Running Mosquitto reconcile...
  Mosquitto reconcile complete.
  ```

---

## Post-Deploy Verification

- [ ] Web UI accessible at customer's domain.
- [ ] Admin can log in to the web interface.
- [ ] Provision a test device and verify MQTT credentials are returned.
- [ ] Test device can connect to MQTT broker with issued credentials.
- [ ] Alert rule can be created and webhook delivery confirmed (if applicable).

---

## Handoff to Customer

- [ ] Customer receives:
  - Web UI URL.
  - Admin credentials (via secure channel).
  - Link to Swagger UI (`/api/docs`).
  - Contact for support.
- [ ] Backup schedule confirmed (see [backup-restore.md](./backup-restore.md)).
- [ ] Customer briefed on:
  - How to add operators (via Users API or UI).
  - How to provision devices (manual flow or batch CSV).
  - How to configure alert rules and webhooks.

---

## Ongoing Operations

- [ ] Daily backup via cron (see [backup-restore.md](./backup-restore.md)).
- [ ] Log retention policy in place (`json-file` driver, 10m/3 files — adjust for volume).
- [ ] Monitoring/uptime check on `/api/v1/health`.
- [ ] Rotate `JWT_SECRET` on suspected compromise (requires server restart; invalidates all sessions).
- [ ] Rotate device MQTT credentials via `POST /api/v1/devices/:serial/rotate-mqtt` on suspected compromise.

---

## Instance Isolation Confirmation

Before going live, confirm:

- [ ] Instance has its own dedicated database (no shared DB with other customers).
- [ ] MQTT broker is local to this instance.
- [ ] No shared secrets between instances.
- [ ] Tenant identifier: _(instance hostname or customer ID — record for ops)_
