# P2 API Changes (Planned)

Этот документ — краткая карта изменений API в P2 относительно P1.
Детальный source of truth: `docs/P2/P2-EVOLUTION.md`.

## Scope note

- `docs/api-reference.md` и `docs/openapi.json` описывают **P1-only** контракт.
- Текущий файл перечисляет группы новых/изменённых контрактов, ожидаемых в P2.

## New endpoint groups in P2

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

- `GET /api/v1/users`
- `POST /api/v1/users`
- `PATCH /api/v1/users/:id`
- `DELETE /api/v1/users/:id`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me/password`

- `GET /api/v1/locations`
- `POST /api/v1/locations`
- `PATCH /api/v1/locations/:id`
- `DELETE /api/v1/locations/:id`
- `GET /api/v1/locations/:id/zones`
- `POST /api/v1/locations/:id/zones`
- `PATCH /api/v1/zones/:id`
- `DELETE /api/v1/zones/:id`

- `GET /api/v1/webhooks`
- `POST /api/v1/webhooks`
- `PATCH /api/v1/webhooks/:id`
- `DELETE /api/v1/webhooks/:id`
- `GET /api/v1/webhooks/:id/deliveries`
- `POST /api/v1/webhooks/:id/test`

- `POST /api/v1/devices/:serial/calibrations` (SHOULD/F10)
- `GET /api/v1/devices/:serial/calibrations` (SHOULD/F10)

## Behavioral changes in P2

- Auth: JWT + refresh cookie for UI flow; `API_TOKEN` остаётся deprecated fallback для machine-to-machine.
- Actor rules: `?actor=` больше не используется для JWT-path; остаётся deprecated fallback только для API_TOKEN-path.
- Webhooks: HMAC signature + retry policy + delivery log.
- Pagination (SHOULD/F11): list endpoints получают additive поле `cursor`.
