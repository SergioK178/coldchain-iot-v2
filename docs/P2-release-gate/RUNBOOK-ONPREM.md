# Runbook: Enterprise / On-Prem Trace

Purpose: acceptance trace для single-tenant on-prem deployment.  
Reference: [FINAL-POLISH-SPEC.md](./FINAL-POLISH-SPEC.md) §4.1

---

## Prerequisites

- Docker Engine 24+ и Docker Compose v2
- 1 GB RAM, 10 GB disk
- LAN между сервером и датчиками

---

## Trace Steps

### 1. Install с нуля

```bash
cd deploy
cp .env.example .env
# Заполнить: DB_PASSWORD, MQTT_ADMIN_PASSWORD, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, MOSQUITTO_RELOAD_URL
docker compose up -d
docker compose ps   # все healthy
```

**Evidence:** `docker compose ps` — db, mqtt, server, web healthy.

---

### 2. Admin bootstrap

```bash
curl http://localhost:8080/api/v1/health
curl http://localhost:8080/api/v1/ready   # 200 = DB ok

# Login
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<ADMIN_EMAIL>","password":"<ADMIN_PASSWORD>"}' | jq -r '.data.accessToken')
echo $TOKEN   # не пусто
```

**Evidence:** health ok; login returns accessToken.

---

### 3. Onboarding датчика через UI

1. Открыть `http://localhost:3000`
2. Login с ADMIN_EMAIL / ADMIN_PASSWORD
3. Перейти на `/onboard`
4. Шаг 1: ввести serial `SENS-TH-00001`, displayName «Тест»
5. Шаг 2: выбрать локацию/зону (или оставить Default)
6. Нажать «Зарегистрировать устройство»
7. Шаг 3: скопировать MQTT username/password

**Evidence:** credentials отображены; topic `d/SENS-TH-00001/t`.

---

### 4. Assign location/zone

1. Перейти на `/locations`
2. Создать локацию «Склад А»
3. Создать зону «Морозилка 1»
4. Перейти на `/devices/SENS-TH-00001`
5. В блоке «Управление устройством» выбрать локацию и зону
6. Нажать «Привязать к зоне»

**Evidence:** device показывает locationName, zoneName.

---

### 5. Telemetry / status

Запустить симулятор (или реальный датчик):

```bash
pnpm --filter @sensor/simulator simulate -- SENS-TH-00001 <mqtt_username> <mqtt_password>
```

Обновить страницу устройства. Ожидать: connectivityStatus «Онлайн», lastTemperatureC, lastHumidityPct.

**Evidence:** device online; график показаний отображается.

---

### 6. Alert + webhook

1. На странице устройства создать правило: temperature_c > -15, cooldown 1 min
2. Перейти на `/settings` → Webhooks
3. Создать webhook: URL (например, webhook.site), events `alert.triggered`
4. Дождаться срабатывания (симулятор публикует t > -15) или вызвать test
5. Проверить deliveries

**Evidence:** alert event в `/alerts`; webhook delivery 2xx.

---

### 7. Decommission / reprovision

1. На странице устройства нажать «Удалить устройство»
2. Подтвердить
3. Устройство исчезает из списка
4. Перейти на `/onboard`
5. Зарегистрировать тот же serial заново

**Evidence:** decommission ok; reprovision ok (serial свободен).

---

### 8. Backup / restore

```bash
cd deploy
./scripts/backup.sh
# backup_YYYYMMDD_HHMMSS.sql создан

# Restore (на чистой БД)
./scripts/restore.sh backup_YYYYMMDD_HHMMSS.sql
docker compose restart server
```

**Evidence:** backup создан; restore успешен; server healthy.

---

### 9. Security boundary checks

- [ ] MQTT порт 1883 не доступен извне LAN (firewall)
- [ ] API требует Bearer token (401 без токена)
- [ ] Swagger UI доступен (по решению — отключить в prod при необходимости)
- [ ] JWT refresh — HTTP-only cookie, SameSite=Lax

**Evidence:** curl без token → 401; с token → 200.

---

## Execution Log Template

| Step | Date | Result | Evidence |
|---|---|---|---|
| 1. Install | | | |
| 2. Admin bootstrap | | | |
| 3. Onboarding | | | |
| 4. Assign location/zone | | | |
| 5. Telemetry/status | | | |
| 6. Alert + webhook | | | |
| 7. Decommission/reprovision | | | |
| 8. Backup/restore | | | |
| 9. Security checks | | | |
