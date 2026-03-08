# Hardware Provisioning Guide

Scope: factory preparation, flashing flow, QR/serial payload, and batch provisioning operations.

---

## Serial Number Format

```
SENS-{TYPE}-{NNNNN}
```

| Segment | Values | Description |
|---------|--------|-------------|
| `SENS` | fixed | Product prefix |
| `TYPE` | `TH`, `TP`, ... | Device type code |
| `NNNNN` | 00001–99999 | 5-digit zero-padded unit number |

Examples:
- `SENS-TH-00001` — Temperature+Humidity sensor, unit 1
- `SENS-TP-00042` — Temperature probe, unit 42

Serial numbers are globally unique within a deployment. Allocate sequential ranges per production batch.

---

## Device Types

| Code | Type | Metrics |
|------|------|---------|
| `TH` | Temperature + Humidity | `temperature_c`, `humidity_pct`, `battery_pct` |
| `TP` | Temperature Probe | `temperature_c`, `battery_pct` |

---

## QR Code Payload Format (для наклейки на датчик)

QR-коды используются при onboarding: оператор сканирует код на упаковке или корпусе датчика — поля серийного номера и названия подставляются в форму `/onboard`.

**Формат для наклейки на датчик** — выберите один из поддерживаемых вариантов.

### Вариант 1: Plain serial (рекомендуется)

Самый простой — только серийный номер в тексте QR:

```
SENS-TH-00001
```

### Вариант 2: JSON (полный)

```json
{"serial":"SENS-TH-00001","displayName":"Морозилка №1"}
```

### Вариант 3: JSON compact (для производства)

Короткие ключи для экономии места:

```json
{"s":"SENS-TH-00001","n":"Морозилка №1"}
```

| Ключ | Значение |
|------|----------|
| `s` или `serial` | Серийный номер (обязательно) |
| `n` или `displayName` | Название (необязательно) |

### Вариант 4: URL (deep link)

Если QR открывает веб-интерфейс напрямую:

```
https://<instance-host>/onboard?serial=SENS-TH-00001&displayName=Морозилка%20№1
```

### Требования к QR-наклейке

| Параметр | Значение |
|----------|----------|
| Error correction | Q (25%) или H (30%) для промышленных условий |
| Кодировка | UTF-8 |
| Минимальный размер модуля | 3 мм (для этикетки 10×10 см при 300 DPI) |
| Материал | Полиэстер или поликарбонат, -40°C … +85°C |

---

## Factory Checklist (per device)

Complete before shipping:

- [ ] Serial number engraved / printed / labeled (matches QR payload).
- [ ] QR code label affixed and readable (scan-tested).
- [ ] Firmware flashed and self-test passed:
  - Temperature sensor reporting.
  - MQTT client initialized (connects after credentials are provisioned).
  - Battery voltage within expected range.
- [ ] Hardware ID recorded in production ledger (serial ↔ batch ↔ ship date).
- [ ] Default WiFi / MQTT config cleared (no factory credentials in firmware).
- [ ] Physical packaging complete (serial on packaging matches device label).

---

## Credentials Provisioning Flow

Credentials are generated server-side via the ColdChain API. **No credentials are baked into firmware at the factory.**

### Two activation paths

| Path | Use case | Flow |
|------|----------|------|
| **A — Wi‑Fi AP + activation token** (recommended) | Productive onboarding, no USB | Operator creates device in UI → gets activation token → connects to sensor's Wi‑Fi AP → enters token in portal → sensor claims on server → receives MQTT credentials |
| **B — Manual MQTT** (fallback) | USB/BLE, recovery, batch | Operator creates device in UI → gets MQTT credentials → flashes into device manually |

### Path A — Wi‑Fi AP + activation token (recommended)

1. **Operator** scans QR or enters serial in ColdChain UI `/onboard` → selects location/zone → clicks "Register".
2. **System** creates device and returns **activation token** (24h TTL).
3. **Operator** connects phone/laptop to sensor's Wi‑Fi AP (e.g. `ColdChain-SENS-TH-00001`).
4. **Operator** opens `http://192.168.4.1` in browser → enters object's Wi‑Fi SSID, password, and activation token.
5. **Sensor** connects to object Wi‑Fi → calls `POST /api/v1/devices/claim` with serial + token.
6. **Server** validates token, rotates credentials, returns MQTT config to sensor.
7. **Sensor** saves credentials, connects to MQTT, publishes telemetry.
8. **Operator** verifies online status in UI.

### Path B — Manual MQTT (fallback)

1. **Operator** creates device in UI → gets MQTT credentials (in "Manual mode" section).
2. **Operator** flashes credentials into device over USB/serial or BLE.
3. **Device** connects to MQTT and publishes telemetry.

### Provisioning API call

```bash
curl -X POST https://<instance>/api/v1/devices/provision \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serial": "SENS-TH-00001",
    "displayName": "Freezer #1",
    "powerSource": "battery",
    "zoneId": "<optional-zone-uuid>"
  }'
```

Response:
```json
{
  "ok": true,
  "data": {
    "serial": "SENS-TH-00001",
    "deviceType": "TH",
    "activationToken": "<base64url-token>",
    "activationTokenExpiresAt": "2026-03-09T12:00:00.000Z",
    "activationTokenExpiresIn": 86400,
    "mqtt": {
      "username": "dev_sens_th_00001",
      "password": "<generated>",
      "topic": "d/SENS-TH-00001/t",
      "statusTopic": "d/SENS-TH-00001/s"
    }
  }
}
```

**Activation token** — use for Wi‑Fi AP claim flow. Valid 24 hours. One-time use.  
**MQTT password** — for manual mode only. Returned once. If sensor claims via token, these credentials become invalid.

### Claim API (sensor calls, no auth)

```bash
curl -X POST https://<instance>/api/v1/devices/claim \
  -H "Content-Type: application/json" \
  -d '{
    "serial": "SENS-TH-00001",
    "activationToken": "<token-from-provision>",
    "firmwareVersion": "0.1.0",
    "powerSource": "battery"
  }'
```

Response:
```json
{
  "ok": true,
  "data": {
    "serial": "SENS-TH-00001",
    "mqtt": {
      "url": "mqtt://coldchain-service.site:1883",
      "username": "dev_sens_th_00001",
      "password": "<new-rotated-password>",
      "topic": "d/SENS-TH-00001/t",
      "statusTopic": "d/SENS-TH-00001/s"
    }
  }
}
```

Server rotates credentials on claim. Sensor must use the returned password.

---

## Batch Provisioning

For large shipments, use `provision-cli` with a CSV file.

### Prepare CSV

```
serial,displayName,powerSource,zoneId
SENS-TH-00001,Freezer #1,battery,
SENS-TH-00002,Freezer #2,battery,
SENS-TP-00003,Cold Room Probe,wired,<zone-uuid>
```

### Run batch provisioning

```bash
# From monorepo root:
pnpm --filter @sensor/provision-cli provision -- \
  --file batch.csv \
  --api-url https://<instance> \
  --api-token $ACCESS_TOKEN \
  --output-file credentials.csv
```

Output `credentials.csv`:
```
serial,mqtt_username,mqtt_password,status,error
SENS-TH-00001,dev_sens_th_00001,<password>,ok,
SENS-TH-00002,dev_sens_th_00002,<password>,ok,
```

### Security for batch output

- Store `credentials.csv` in an encrypted volume or secrets manager immediately.
- Transfer to flashing station over an encrypted channel only.
- Delete plaintext after flashing is confirmed.
- Rotate credentials via `POST /api/v1/devices/:serial/rotate-mqtt` if credentials are lost or compromised.

---

## Wi‑Fi AP Portal (Path A)

For sensors with Wi‑Fi AP mode, the firmware must implement a captive portal or config page.

### Bootstrap data (user enters in portal)

| Field | Description |
|-------|-------------|
| Wi‑Fi SSID | Object's network name |
| Wi‑Fi password | Object's network password |
| Activation token | From provision response (step 3 in UI) |

### Firmware flow

1. Device boots in SETUP MODE → starts AP (e.g. `ColdChain-SENS-TH-00001`).
2. User connects to AP, opens `http://192.168.4.1`.
3. Portal asks for: Wi‑Fi SSID, password, activation token.
4. Device connects to object Wi‑Fi.
5. Device calls `POST https://<server>/api/v1/devices/claim` with `{ serial, activationToken }`.
6. Server returns `mqtt.url`, `mqtt.username`, `mqtt.password`, topics.
7. Device saves runtime config, switches to normal mode, connects to MQTT.

**Server URL** — device needs the API base URL. Options: (a) from provisioning JSON bundle, (b) configurable in portal, (c) mDNS/discovery.

---

## Flashing Credentials into Device (Path B — manual)

After provisioning, credentials must be written to the device's non-volatile storage.

### Firmware parameters to set

| Parameter | Value |
|-----------|-------|
| `MQTT_HOST` | IP or hostname of the ColdChain server |
| `MQTT_PORT` | `1883` (or value of `MQTT_PORT` in `.env`) |
| `MQTT_USERNAME` | `mqtt.username` from provision response |
| `MQTT_PASSWORD` | `mqtt.password` from provision response |
| `MQTT_TOPIC` | `mqtt.topic` from provision response |
| `MQTT_STATUS_TOPIC` | `mqtt.statusTopic` from provision response |

### Recommended flashing approaches

- **USB serial / UART**: use platform-specific CLI (e.g. `esptool.py` for ESP32).
- **BLE configuration mode**: firmware exposes BLE GATT service for credential injection.
- **Provisioning jig**: automated station writes CSV row per device scan.

### Verify connection

After flashing:
1. Power on device.
2. Check MQTT broker logs:
   ```bash
   docker compose logs mqtt -f | grep SENS-TH-00001
   ```
3. Check device status in ColdChain UI or API:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     https://<instance>/api/v1/devices/SENS-TH-00001
   ```
   Expect `"connectivityStatus": "online"` within one telemetry interval.

---

## Credential Rotation

If MQTT credentials are compromised or lost:

```bash
curl -X POST https://<instance>/api/v1/devices/SENS-TH-00001/rotate-mqtt \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

New credentials are returned. Old credentials are immediately invalidated. Reflash the device.

---

## Troubleshooting

### Device cannot connect to MQTT

1. Verify MQTT host and port are reachable from device network.
2. Confirm credentials were flashed correctly (check `MQTT_USERNAME` / `MQTT_PASSWORD`).
3. Check that reconcile ran: `docker compose logs mqtt -f` should show `reload` after provisioning.
4. If still failing, rotate credentials and reflash.

### Serial format rejected at provisioning

Format must match `SENS-{TYPE}-{NNNNN}`. Verify:
- TYPE is a known device type code (see table above).
- Unit number is exactly 5 digits, zero-padded.
- No spaces or extra characters.

### Credentials already provisioned error

Serial was already provisioned. Options:
- Use the existing credentials (retrieve from your records).
- Decommission the device: `DELETE /api/v1/devices/:serial` (admin only), then re-provision.
- Rotate credentials: `POST /api/v1/devices/:serial/rotate-mqtt`.
