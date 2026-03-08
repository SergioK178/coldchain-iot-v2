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

### Step-by-step

1. **Operator scans QR** or enters serial in the ColdChain web UI → claim device.
2. **System generates** MQTT username and password via `POST /api/v1/devices/provision`.
3. **Operator flashes** credentials into device over USB/serial (or via BLE config tool).
4. **Device connects** to MQTT broker and starts publishing telemetry.
5. **Operator verifies** online status in the UI.

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
    "mqtt": {
      "username": "dev_sens_th_00001",
      "password": "<generated>",
      "topic": "d/SENS-TH-00001/t",
      "statusTopic": "d/SENS-TH-00001/s"
    }
  }
}
```

**The plaintext password is returned only once.** Store it securely before flashing.

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

## Flashing Credentials into Device

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
