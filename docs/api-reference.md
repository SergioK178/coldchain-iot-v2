

# docs/api-reference.md

## IoT Sensor Platform — API & Integration Reference

**Версия API:** v1
**Привязка:** MASTER-SPEC.md v3.1, scope P1

> **Важно:** этот файл описывает **только P1 API contract**. P2-план и изменения API описаны в `docs/P2/P2-EVOLUTION.md` и `docs/P2/API-CHANGES.md`.

---

## 1. Общие правила

### Base URL

```
http://{host}:{HTTP_PORT}/api/v1
```

Default: `http://localhost:8080/api/v1`

### Authentication

Все endpoints кроме `GET /api/v1/health` требуют заголовок:

```
Authorization: Bearer {API_TOKEN}
```

`API_TOKEN` задаётся в `.env` при установке. Минимум 32 символа.

Без заголовка или с невалидным токеном — 401:

```json
{ "ok": false, "error": { "code": "UNAUTHORIZED", "message": "Missing or invalid API token" } }
```

### Content-Type

Запросы с телом: `Content-Type: application/json`
Все ответы: `application/json`

### Response format

Успех:
```json
{ "ok": true, "data": <payload> }
```

Ошибка:
```json
{ "ok": false, "error": { "code": "<ERROR_CODE>", "message": "<human-readable>" } }
```

### Пустые выборки в list endpoints

Для list endpoints (`GET /devices`, `GET /alert-events`, `GET /audit-log`) при отсутствии данных возвращается `200 OK` и пустой массив в `data`, а не `404`.

### Actor

Mutating endpoints (`POST`, `PATCH`, `DELETE`) поддерживают опциональный query-параметр `?actor=<name>` для записи в audit log. Если не передан — записывается `"system"`.

Исключение: `PATCH /alert-events/:id/acknowledge` — actor берётся из обязательного поля `acknowledgedBy` в body.

### Error codes (полный список P1)

| Code | HTTP | Когда |
|---|---|---|
| `UNAUTHORIZED` | 401 | Нет или невалидный Bearer token |
| `VALIDATION_ERROR` | 400 | Тело запроса или query params не прошли валидацию |
| `INVALID_SERIAL_FORMAT` | 400 | Serial не соответствует `SENS-{TYPE}-{NNNNN}` |
| `UNKNOWN_DEVICE_TYPE` | 400 | Тип из serial не в списке (TH, TP, T, HM) |
| `INVALID_METRIC_FOR_DEVICE` | 400 | Metric не соответствует capabilities типа устройства |
| `DEVICE_NOT_FOUND` | 404 | Устройство с таким serial не найдено или decommissioned |
| `ZONE_NOT_FOUND` | 404 | Zone с таким id не найдена |
| `ALERT_RULE_NOT_FOUND` | 404 | Alert rule не найден |
| `ALERT_EVENT_NOT_FOUND` | 404 | Alert event не найден |
| `DEVICE_ALREADY_PROVISIONED` | 409 | Устройство с таким serial уже зарегистрировано |
| `ALREADY_ACKNOWLEDGED` | 409 | Alert event уже подтверждён |
| `INTERNAL_ERROR` | 500 | Внутренняя ошибка (без стектрейса) |

---

## 2. Endpoints

---

### `GET /health`

Healthcheck. Auth не требуется.

**Response 200:**
```json
{ "ok": true, "data": { "version": "0.1.0", "uptime": 3600 } }
```

---

### `POST /devices/provision`

Регистрирует устройство, генерирует MQTT credentials, обновляет Mosquitto auth.

**Request:**
```json
{
  "serial": "SENS-TH-00042",
  "displayName": "Морозилка №3",
  "powerSource": "battery",
  "zoneId": "550e8400-e29b-41d4-a716-446655440000",
  "calibrationOffsetC": 0.0
}
```

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `serial` | string | да | Формат: `SENS-{TYPE}-{NNNNN}`. TYPE: TH, TP, T, HM |
| `displayName` | string | нет | Человекочитаемое имя |
| `powerSource` | `"battery"` \| `"wired"` | да | Тип питания |
| `zoneId` | uuid | нет | Привязка к зоне. Если не передан — default zone |
| `calibrationOffsetC` | number | нет | Калибровочная поправка °C. Default: 0.0 |

**Response 201:**
```json
{
  "ok": true,
  "data": {
    "serial": "SENS-TH-00042",
    "deviceType": "TH",
    "displayName": "Морозилка №3",
    "mqtt": {
      "username": "dev_sens_th_00042",
      "password": "a7f3e9b1c4d2f5a8e2b6c9d3e7f0a4b8",
      "topic": "d/SENS-TH-00042/t",
      "statusTopic": "d/SENS-TH-00042/s"
    }
  }
}
```

`mqtt.password` возвращается **только один раз**. Plaintext не хранится на сервере.

> **Формат пароля:** 32 символа lowercase hex (`[a-f0-9]{32}`), генерируется криптографически стойким CSPRNG.

**Errors:**
- 400 `INVALID_SERIAL_FORMAT`
- 400 `UNKNOWN_DEVICE_TYPE`
- 404 `ZONE_NOT_FOUND`
- 409 `DEVICE_ALREADY_PROVISIONED`

---

### `GET /devices`

Список всех активных (не decommissioned) устройств.

**Response 200:**
```json
{
  "ok": true,
  "data": [
    {
      "serial": "SENS-TH-00042",
      "deviceType": "TH",
      "displayName": "Морозилка №3",
      "zoneName": "Основная зона",
      "locationName": "Основная локация",
      "powerSource": "battery",
      "connectivityStatus": "online",
      "alertStatus": "normal",
      "lastSeenAt": "2025-07-15T14:30:00Z",
      "lastTemperatureC": -18.3,
      "lastHumidityPct": 45.2,
      "lastBatteryPct": 87,
      "provisionedAt": "2025-06-01T10:00:00Z"
    }
  ]
}
```

| Поле | Значения |
|---|---|
| `connectivityStatus` | `"online"` — данные поступают; `"offline"` — нет данных дольше `DEVICE_OFFLINE_TIMEOUT_SEC` |
| `alertStatus` | `"normal"` — нет неподтверждённых тревог; `"alert"` — есть хотя бы одна |
| `deviceType` | Вычисляется из serial. Возможные: `TH`, `TP`, `T`, `HM` |
| `lastTemperatureC` | `null` если устройство не поддерживает или ещё не присылало данные |
| `lastHumidityPct` | `null` если устройство не поддерживает или ещё не присылало данные |
| `lastBatteryPct` | `null` если `powerSource = "wired"` или ещё не присылало данные |

---

### `GET /devices/:serial`

Одно устройство. Формат ответа — тот же объект, что в списке.

**Response 200:**
```json
{
  "ok": true,
  "data": {
    "serial": "SENS-TH-00042",
    "deviceType": "TH",
    "displayName": "Морозилка №3",
    "zoneName": "Основная зона",
    "locationName": "Основная локация",
    "powerSource": "battery",
    "connectivityStatus": "online",
    "alertStatus": "alert",
    "lastSeenAt": "2025-07-15T14:30:00Z",
    "lastTemperatureC": -13.8,
    "lastHumidityPct": 45.2,
    "lastBatteryPct": 87,
    "provisionedAt": "2025-06-01T10:00:00Z"
  }
}
```

**Errors:**
- 404 `DEVICE_NOT_FOUND`

---

### `PATCH /devices/:serial`

Обновление устройства. Все поля опциональны.

**Request:**
```json
{
  "displayName": "Холодильник витрина",
  "zoneId": "550e8400-e29b-41d4-a716-446655440000",
  "calibrationOffsetC": -0.5
}
```

**Response 200:** обновлённый объект устройства (формат как в `GET /devices/:serial`).

**Errors:**
- 400 `VALIDATION_ERROR`
- 404 `DEVICE_NOT_FOUND`
- 404 `ZONE_NOT_FOUND`

---

### `DELETE /devices/:serial`

Soft delete. Устройство помечается decommissioned, MQTT credentials удаляются.

**Response 200:**
```json
{
  "ok": true,
  "data": {
    "serial": "SENS-TH-00042",
    "decommissionedAt": "2025-07-15T15:00:00Z"
  }
}
```

**Errors:**
- 404 `DEVICE_NOT_FOUND`

---

### `GET /devices/:serial/readings`

Исторические показания.

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | integer 1–1000 | 100 | Количество записей |
| `since` | ISO 8601 datetime | – | Начало диапазона (включительно) |
| `until` | ISO 8601 datetime | – | Конец диапазона (исключительно) |

Сортировка: `timestamp` descending (последние сверху).

**Response 200:**
```json
{
  "ok": true,
  "data": [
    {
      "timestamp": "2025-07-15T14:30:00Z",
      "temperatureC": -18.3,
      "humidityPct": 45.2,
      "batteryPct": 87,
      "rssiDbm": -67
    },
    {
      "timestamp": "2025-07-15T14:29:00Z",
      "temperatureC": -18.1,
      "humidityPct": 44.8,
      "batteryPct": 87,
      "rssiDbm": -65
    }
  ]
}
```

Поля `temperatureC`, `humidityPct`, `batteryPct`, `rssiDbm` — `null` если устройство не поддерживает или не прислало.

**Errors:**
- 404 `DEVICE_NOT_FOUND`

---

### `POST /devices/:serial/alert-rules`

Создание правила алерта.

**Request:**
```json
{
  "metric": "temperature_c",
  "operator": "gt",
  "threshold": -15.0,
  "cooldownMinutes": 15
}
```

| Поле | Допустимые значения | Описание |
|---|---|---|
| `metric` | `"temperature_c"`, `"humidity_pct"` | Метрика для проверки |
| `operator` | `"gt"`, `"lt"`, `"gte"`, `"lte"` | Оператор сравнения |
| `threshold` | number | Пороговое значение |
| `cooldownMinutes` | integer ≥ 1 | Минимальный интервал между срабатываниями. Default: 15 |

Валидация: `metric` должен соответствовать capabilities типа устройства. Например, `humidity_pct` нельзя создать для `SENS-TP-*` (тип TP поддерживает только `temperature_c`).

**Response 201:**
```json
{
  "ok": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "deviceSerial": "SENS-TH-00042",
    "metric": "temperature_c",
    "operator": "gt",
    "threshold": -15.0,
    "isActive": true,
    "cooldownMinutes": 15,
    "lastTriggeredAt": null,
    "createdAt": "2025-07-15T14:00:00Z"
  }
}
```

**Errors:**
- 400 `INVALID_METRIC_FOR_DEVICE`
- 400 `VALIDATION_ERROR`
- 404 `DEVICE_NOT_FOUND`

---

### `GET /devices/:serial/alert-rules`

**Response 200:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "deviceSerial": "SENS-TH-00042",
      "metric": "temperature_c",
      "operator": "gt",
      "threshold": -15.0,
      "isActive": true,
      "cooldownMinutes": 15,
      "lastTriggeredAt": "2025-07-15T14:30:00Z",
      "createdAt": "2025-07-15T14:00:00Z"
    }
  ]
}
```

**Errors:**
- 404 `DEVICE_NOT_FOUND`

---

### `PATCH /alert-rules/:id`

Обновление правила. Все поля опциональны.

**Request:**
```json
{
  "threshold": -18.0,
  "isActive": false,
  "cooldownMinutes": 30
}
```

Допустимые поля: `threshold`, `operator`, `isActive`, `cooldownMinutes`.

**Response 200:** обновлённый объект правила.

**Errors:**
- 400 `VALIDATION_ERROR`
- 404 `ALERT_RULE_NOT_FOUND`

---

### `DELETE /alert-rules/:id`

Hard delete.

**Response 200:**
```json
{ "ok": true, "data": null }
```

**Errors:**
- 404 `ALERT_RULE_NOT_FOUND`

---

### `GET /alert-events`

История сработавших алертов.

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `deviceSerial` | string | – | Фильтр по устройству |
| `acknowledged` | `true` \| `false` | – | Фильтр по подтверждению |
| `since` | ISO 8601 | – | С какого момента |
| `limit` | integer 1–1000 | 100 | Количество |

**Response 200:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "f1e2d3c4-b5a6-7890-fedc-ba0987654321",
      "deviceSerial": "SENS-TH-00042",
      "deviceName": "Морозилка №3",
      "metric": "temperature_c",
      "operator": "gt",
      "thresholdValue": -15.0,
      "readingValue": -13.8,
      "triggeredAt": "2025-07-15T14:30:00Z",
      "acknowledgedAt": null,
      "acknowledgedBy": null
    }
  ]
}
```

---

### `PATCH /alert-events/:id/acknowledge`

Подтверждение тревоги оператором.

**Request:**
```json
{
  "acknowledgedBy": "Иванов"
}
```

`acknowledgedBy` — обязательная непустая строка (max 255 символов).

**Response 200:**
```json
{
  "ok": true,
  "data": {
    "id": "f1e2d3c4-b5a6-7890-fedc-ba0987654321",
    "deviceSerial": "SENS-TH-00042",
    "deviceName": "Морозилка №3",
    "metric": "temperature_c",
    "operator": "gt",
    "thresholdValue": -15.0,
    "readingValue": -13.8,
    "triggeredAt": "2025-07-15T14:30:00Z",
    "acknowledgedAt": "2025-07-15T14:35:00Z",
    "acknowledgedBy": "Иванов"
  }
}
```

**Errors:**
- 400 `VALIDATION_ERROR` — `acknowledgedBy` пустой или отсутствует
- 404 `ALERT_EVENT_NOT_FOUND`
- 409 `ALREADY_ACKNOWLEDGED`

---

### `GET /audit-log`

Журнал действий (append-only).

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `action` | string | – | Фильтр по типу действия |
| `entityType` | string | – | Фильтр по типу сущности |
| `since` | ISO 8601 | – | С какого момента |
| `limit` | integer 1–1000 | 100 | Количество |

**Response 200:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "...",
      "timestamp": "2025-07-15T14:30:00Z",
      "action": "alert.triggered",
      "entityType": "device",
      "entityId": "SENS-TH-00042",
      "actor": "system",
      "details": {
        "metric": "temperature_c",
        "readingValue": -13.8,
        "threshold": -15.0
      }
    }
  ]
}
```

**Действия (actions) P1:**
`device.provisioned`, `device.decommissioned`, `device.online`, `device.offline`, `device.unknown_message`, `alert.triggered`, `alert.acknowledged`, `alert_rule.created`, `alert_rule.updated`, `alert_rule.deleted`, `payload.invalid`, `payload.missing_capability`, `config.changed`

---

## 3. MQTT Contracts

### 3.1 Device Telemetry Payload

Устройство публикует JSON в топик `d/{serial}/t`.

**Schema:**

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `v` | integer | да | Версия схемы. Ровно `1` |
| `id` | string | да | Serial устройства. Format: `SENS-{TYPE}-{NNNNN}` |
| `ts` | integer | да | UTC unix timestamp, seconds |
| `mid` | string | да | Message ID, уникален в пределах устройства. Max 64 chars |
| `t` | number | зависит от типа | Температура °C. Диапазон: -55 ... 125 |
| `h` | number | зависит от типа | Влажность %. Диапазон: 0 ... 100 |
| `bat` | integer | нет | Батарея %. 0–100. Отсутствует если `powerSource = "wired"` |
| `rssi` | integer | нет | Wi-Fi RSSI dBm. -120 ... 0 |
| `fw` | string | нет | Версия прошивки. Max 20 chars |
| `up` | integer | нет | Uptime в секундах |

**Обязательные capabilities по типу:**

| Тип | `t` | `h` |
|---|---|---|
| TH | обязательно | обязательно |
| TP | обязательно | – |
| T | обязательно | – |
| HM | – | обязательно |

**Максимальный размер:** 512 байт.

**Примеры:**

TH (батарейный):
```json
{"v":1,"id":"SENS-TH-00042","ts":1752588600,"mid":"a1b2c3d4","t":-18.3,"h":45.2,"bat":87,"rssi":-67,"fw":"0.1.3"}
```

TP (проводной):
```json
{"v":1,"id":"SENS-TP-00007","ts":1752588600,"mid":"e5f6a7b8","t":4.1,"rssi":-52,"fw":"0.2.0","up":86400}
```

### 3.2 LWT / Status

| Событие | Кто | Topic | Payload | Retain | QoS |
|---|---|---|---|---|---|
| Подключение | Датчик | `d/{serial}/s` | `1` | true | 1 |
| Graceful stop | Датчик (explicit publish) | `d/{serial}/s` | `0` | true | 1 |
| Аварийный обрыв | Broker (LWT) | `d/{serial}/s` | `0` | true | 1 |

Payload — ASCII символ `1` или `0`, не JSON.

> **Два пути offline:** При graceful shutdown firmware/симулятор **сам** публикует `0` перед отключением — это не LWT. Настоящий LWT срабатывает только при аварийном обрыве (crash, kill, потеря сети, keepalive timeout).

Датчик при подключении обязан:
1. Настроить LWT: topic `d/{serial}/s`, payload `0`, retain true, QoS 1
2. Сразу после connect опубликовать `1` в `d/{serial}/s`, retain true, QoS 1

Сервер дополнительно считает устройство offline, если `lastSeenAt` старше `DEVICE_OFFLINE_TIMEOUT_SEC` (default 300 секунд).

### 3.3 MQTT Auth

Каждое устройство использует индивидуальные credentials, полученные при provisioning:
- `username`: `dev_sens_th_00042` (lowercase, underscores)
- `password`: из ответа `POST /devices/provision`, поле `mqtt.password`

ACL: устройство может публиковать **только** в:
- `d/{свой_serial}/t`
- `d/{свой_serial}/s`

Подписка и публикация в другие топики запрещены.

---

## 4. Alert Callback

При срабатывании алерта и заданном `ALERT_CALLBACK_URL` сервер отправляет HTTP POST.

**Request:**
```http
POST {ALERT_CALLBACK_URL}
Content-Type: application/json
```

**Body:**
```json
{
  "event": "alert.triggered",
  "triggeredAt": "2025-07-15T14:30:00Z",
  "device": {
    "serial": "SENS-TH-00042",
    "displayName": "Морозилка №3",
    "zoneName": "Основная зона",
    "locationName": "Основная локация"
  },
  "rule": {
    "metric": "temperature_c",
    "operator": "gt",
    "threshold": -15.0
  },
  "reading": {
    "value": -13.8,
    "timestamp": "2025-07-15T14:30:00Z"
  }
}
```

Timeout: 5 секунд. Один attempt. Без retry. Без HMAC-подписи.

Machine-readable схема callback payload: `components/schemas/AlertCallbackPayload` в `docs/openapi.json`.

---

## 5. curl-примеры

Во всех примерах:
```bash
API=http://localhost:8080/api/v1
TOKEN=your_api_token_here
```

### 5.1 Provision device

```bash
curl -s -X POST "$API/devices/provision" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serial": "SENS-TH-00001",
    "displayName": "Морозилка кухня",
    "powerSource": "battery"
  }' | jq .
```

Сохранить credentials для датчика:
```bash
curl -s -X POST "$API/devices/provision" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serial": "SENS-TH-00001",
    "displayName": "Морозилка кухня",
    "powerSource": "battery"
  }' | jq -r '.data.mqtt | "Username: \(.username)\nPassword: \(.password)\nTopic: \(.topic)"'
```

### 5.2 List devices

```bash
curl -s "$API/devices" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### 5.3 Get one device

```bash
curl -s "$API/devices/SENS-TH-00001" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### 5.4 Update device

```bash
curl -s -X PATCH "$API/devices/SENS-TH-00001?actor=Петров" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Морозилка кухня (основная)",
    "calibrationOffsetC": -0.3
  }' | jq .
```

### 5.5 Create alert rule

```bash
curl -s -X POST "$API/devices/SENS-TH-00001/alert-rules?actor=Петров" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "metric": "temperature_c",
    "operator": "gt",
    "threshold": -15.0,
    "cooldownMinutes": 15
  }' | jq .
```

### 5.6 Get readings

Последние 10:
```bash
curl -s "$API/devices/SENS-TH-00001/readings?limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

За период:
```bash
curl -s "$API/devices/SENS-TH-00001/readings?since=2025-07-15T00:00:00Z&until=2025-07-16T00:00:00Z" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### 5.7 Get unacknowledged alerts

```bash
curl -s "$API/alert-events?acknowledged=false" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### 5.8 Acknowledge alert

```bash
curl -s -X PATCH "$API/alert-events/f1e2d3c4-b5a6-7890-fedc-ba0987654321/acknowledge" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "acknowledgedBy": "Иванов" }' | jq .
```

### 5.9 Decommission device

```bash
curl -s -X DELETE "$API/devices/SENS-TH-00001?actor=Петров" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### 5.10 Check audit log

```bash
curl -s "$API/audit-log?action=device.provisioned&limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 6. Полный сценарий (от установки до тревоги)

```bash
# 1. Healthcheck
curl -s http://localhost:8080/api/v1/health | jq .

# 2. Provision
curl -s -X POST "$API/devices/provision" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"serial":"SENS-TH-00001","displayName":"Морозилка","powerSource":"battery"}' \
  > /tmp/device.json
cat /tmp/device.json | jq .

# 3. Extract MQTT credentials
MQTT_USER=$(jq -r '.data.mqtt.username' /tmp/device.json)
MQTT_PASS=$(jq -r '.data.mqtt.password' /tmp/device.json)

# 4. Simulate device (send one reading)
mosquitto_pub -h localhost -p 1883 \
  -u "$MQTT_USER" -P "$MQTT_PASS" \
  -t "d/SENS-TH-00001/t" \
  -m '{"v":1,"id":"SENS-TH-00001","ts":'$(date +%s)',"mid":"test001","t":-18.3,"h":45.2,"bat":90,"rssi":-55,"fw":"0.1.0"}'

# 5. Verify reading
curl -s "$API/devices/SENS-TH-00001/readings?limit=1" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 6. Create alert rule (trigger if temp > -15)
curl -s -X POST "$API/devices/SENS-TH-00001/alert-rules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"metric":"temperature_c","operator":"gt","threshold":-15.0}' | jq .

# 7. Send reading that triggers alert
mosquitto_pub -h localhost -p 1883 \
  -u "$MQTT_USER" -P "$MQTT_PASS" \
  -t "d/SENS-TH-00001/t" \
  -m '{"v":1,"id":"SENS-TH-00001","ts":'$(date +%s)',"mid":"test002","t":-13.8,"h":46.0,"bat":90,"rssi":-55,"fw":"0.1.0"}'

# 8. Check alert fired
curl -s "$API/alert-events?acknowledged=false" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 9. Acknowledge
ALERT_ID=$(curl -s "$API/alert-events?acknowledged=false" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')

curl -s -X PATCH "$API/alert-events/$ALERT_ID/acknowledge" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"acknowledgedBy":"Иванов"}' | jq .

# 10. Verify clean state
curl -s "$API/alert-events?acknowledged=false" \
  -H "Authorization: Bearer $TOKEN" | jq .
# Should return empty array
```

---
## 7. Машинный контракт (OpenAPI)

Machine-readable контракт хранится отдельно:
- `docs/openapi.json` — версия в репозитории для code review и diff.
- Runtime export: `GET /api/docs/json` — актуальная спецификация из running сервера.

Swagger UI доступен по `GET /api/docs`.
