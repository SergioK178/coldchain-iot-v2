# P2 Security Hardening Notes

## 1) Secret hygiene

- `deploy/.env` must never be committed.
- Keep only `deploy/.env.example` in git.
- If secrets were committed in any branch/history, rotate immediately.

## 2) Required rotation checklist

Rotate and redeploy:

1. `DB_PASSWORD`
2. `MQTT_ADMIN_PASSWORD`
3. `JWT_SECRET`
4. `ADMIN_PASSWORD` (strong: >=16 chars, lower/upper/digit/special)
5. `TELEGRAM_BOT_TOKEN` (if used)

## 3) Auth hardening

- `/api/v1/auth/login` and `/api/v1/auth/refresh` have in-memory rate-limit.
- Exceeding limit returns HTTP `429` with `Retry-After`.
- Cookie `Secure` behavior configured by `AUTH_COOKIE_SECURE`:
  - `true`: always secure cookie
  - `false`: never secure (local dev only)
  - `auto`: secure under https / production proxy setup

## 4) Webhook SSRF protection

- Only `http/https` webhook URLs.
- Localhost/private/link-local/metadata targets are blocked.
- DNS resolution is validated on create/update and before delivery.
- Redirects are rejected (`redirect: error`).

## 5) Audit integrity

- Actor derives from JWT auth context only.
- Query `?actor=` is ignored for audit actor.
