# Runbook: Managed Cloud Single-Tenant Trace

Purpose: acceptance trace для managed cloud single-tenant deployment.  
Reference: [FINAL-POLISH-SPEC.md](./FINAL-POLISH-SPEC.md) §4.2

---

## Prerequisites

- Dedicated VM/container (1+ GB RAM, 10+ GB disk)
- Domain или static IP
- TLS plan (Caddy ACME или internal CA)

---

## Trace Steps

### 1. Managed deployment

Следовать `deploy/docs/managed-cloud-checklist.md`:

- [ ] Secrets сгенерированы (DB_PASSWORD, MQTT_ADMIN_PASSWORD, JWT_SECRET)
- [ ] ADMIN_EMAIL, ADMIN_PASSWORD заданы
- [ ] MOSQUITTO_RELOAD_URL=http://mqtt:9080/reload
- [ ] PUBLIC_API_URL=https://api.customer.example.com
- [ ] AUTH_COOKIE_SECURE=true
- [ ] MQTT порт 1883 не публичен (firewall)
- [ ] `docker compose --profile https up -d`
- [ ] Caddyfile обновлён под домен

**Evidence:** все контейнеры healthy; HTTPS отвечает.

---

### 2. First login

1. Открыть `https://<customer-domain>`
2. Ввести ADMIN_EMAIL / ADMIN_PASSWORD
3. Успешный вход → dashboard

**Evidence:** redirect на `/`; sidebar показывает email и роль.

---

### 3. Onboarding без ручных MQTT шагов

1. Перейти на `/onboard`
2. Ввести serial (или отсканировать QR)
3. Выбрать локацию/зону
4. Зарегистрировать
5. Скопировать MQTT credentials из UI
6. Прошить в датчик (см. hardware-provisioning.md)

**Evidence:** оператор не редактирует passwd/acl; всё через UI.

---

### 4. Device activation

1. Датчик с прошитыми credentials подключается к MQTT
2. Обновить страницу устройства
3. connectivityStatus «Онлайн»

**Evidence:** device online; telemetry в графике.

---

### 5. Users / roles

1. Перейти на `/settings` → Пользователи
2. Создать operator (email, password, role operator)
3. Logout, войти под operator
4. Проверить: operator не видит Users/Webhooks; видит devices, alerts, export

**Evidence:** role enforcement работает.

---

### 6. Webhook / integration path

1. Admin создаёт webhook (URL, secret, events)
2. Интегратор получает secret
3. Настраивает приём с верификацией HMAC (X-Signature-256)
4. Тест webhook → delivery 2xx

**Evidence:** webhook deliveries в UI; интегратор получает события.

---

### 7. Support / troubleshooting flow

- Логи: `docker compose logs server -f`, `mqtt -f`
- Health: `curl https://api.../api/v1/health`; Ready: `curl https://api.../api/v1/ready`
- Reconcile: в логах server «Mosquitto reconcile complete»
- Backup: `./scripts/backup.sh`; restore по [backup-restore.md](../deploy/docs/backup-restore.md)

**Evidence:** runbook доступен; типовые проблемы документированы.

---

## Execution Log Template

| Step | Date | Result | Evidence |
|---|---|---|---|
| 1. Managed deployment | | | |
| 2. First login | | | |
| 3. Onboarding (no manual MQTT) | | | |
| 4. Device activation | | | |
| 5. Users/roles | | | |
| 6. Webhook/integration | | | |
| 7. Support/troubleshooting | | | |
