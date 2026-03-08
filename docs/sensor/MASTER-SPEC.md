# ColdChain Sensor — Master Specification

**Версия:** 1.0  
**Дата:** 2026-03-08  
**Назначение:** Source of truth для разработки прошивки датчиков в отдельном репозитории.  
**Связь:** Платформа ColdChain IoT (coldchain-iot-v2) — сервер, MQTT broker, API.

---

## 1. Обзор архитектуры

```
Датчик (ESP32/nRF/...)  →  MQTT (Mosquitto)  →  ColdChain Server
                              ↑
                    LAN, порт 1883 (TCP)
```

Датчик — автономное устройство, которое:
1. Подключается к MQTT с credentials из provisioning
2. Публикует online-статус при подключении
3. Отправляет телеметрию по таймеру
4. При отключении — брокер публикует LWT (offline)

Вся логика обработки — на стороне сервера. Датчик только публикует.

---

## 2. Serial Number Format

```
SENS-{TYPE}-{NNNNN}
```

| Сегмент | Значения | Описание |
|---------|----------|----------|
| `SENS` | фиксированный | Префикс продукта |
| `TYPE` | `TH`, `TP`, `T`, `HM` | Код типа устройства |
| `NNNNN` | 00001–99999 | 5 цифр с ведущими нулями |

**Regex:** `^SENS-[A-Z]{1,2}-\d{5}$`

Примеры:
- `SENS-TH-00001` — Temperature + Humidity, unit 1
- `SENS-TP-00042` — Temperature Probe, unit 42
- `SENS-T-00001` — Temperature Only
- `SENS-HM-00003` — Humidity Only

Serial прошивается в устройство и не меняется. Используется как идентификатор в MQTT-топиках и API.

### QR-код на корпусе/упаковке

Для ускорения onboarding на датчик или упаковку клеится QR-наклейка. Оператор сканирует её в UI `/onboard` — поля подставляются автоматически.

**Формат содержимого QR** (один из вариантов):

| Формат | Пример |
|--------|--------|
| Plain | `SENS-TH-00001` |
| JSON | `{"serial":"SENS-TH-00001","displayName":"Морозилка №1"}` |
| Compact | `{"s":"SENS-TH-00001","n":"Морозилка №1"}` |

Подробности: [hardware-provisioning.md](../../deploy/docs/hardware-provisioning.md#qr-code-payload-format-для-наклейки-на-датчик).

---

## 3. Device Types

| Код | Название | Обязательные поля | Опциональные |
|-----|----------|-------------------|--------------|
| TH | Temperature + Humidity | `t`, `h` | `bat`, `rssi`, `fw`, `up` |
| TP | Temperature Probe | `t` | `bat`, `rssi`, `fw`, `up` |
| T | Temperature Only | `t` | `bat`, `rssi`, `fw`, `up` |
| HM | Humidity Only | `h` | `bat`, `rssi`, `fw`, `up` |

Тип определяется из serial. Сервер проверяет, что датчик отправляет обязательные поля. Если `SENS-TH-*` пришлёт payload без `t` или `h` — сообщение отклоняется.

---

## 4. Provisioning (регистрация)

Перед подключением датчик должен быть зарегистрирован на сервере. Оператор делает это через API или UI.

### Параметры после регистрации

| Параметр | Пример | Описание |
|----------|--------|----------|
| MQTT_HOST | 192.168.1.50 | IP или hostname сервера |
| MQTT_PORT | 1883 | По умолчанию |
| MQTT_USERNAME | dev_sens_th_00042 | Формат `dev_{serial_lowercase}` |
| MQTT_PASSWORD | a7f3e9b1c4d2... | 32 hex, выдаётся один раз |
| Telemetry topic | d/SENS-TH-00042/t | Куда публиковать телеметрию |
| Status topic | d/SENS-TH-00042/s | Куда публиковать online/offline |

**Пароль:** 32 символа lowercase hex (`[a-f0-9]{32}`). Генерируется сервером. Возвращается **один раз** при регистрации.

---

## 5. MQTT Connection

```
Protocol:    MQTT v3.1.1 или v5
Transport:   TCP (не WebSocket)
Port:        1883
TLS:         Нет (P2 в LAN)
Keep Alive:  60 секунд
Clean Session: true
Client ID:   любой уникальный (рекомендуется: serial или serial_random)
```

---

## 6. Topics

| Топик | Направление | QoS | Retain | Описание |
|-------|-------------|-----|--------|----------|
| `d/{serial}/t` | Publish | 1 | false | Телеметрия |
| `d/{serial}/s` | Publish | 1 | true | Статус online/offline |

### ACL (Access Control)

Датчик имеет право **только publish** в свои топики:
- `d/{serial}/t`
- `d/{serial}/s`

**Датчик не должен подписываться** на какие-либо топики — подписка будет отклонена ACL.

---

## 7. LWT (Last Will and Testament)

**Обязательно настроить при подключении:**

| Параметр | Значение |
|----------|----------|
| Will Topic | `d/{serial}/s` |
| Will Payload | `0` (ASCII) |
| Will Retain | true |
| Will QoS | 1 |

LWT срабатывает при неожиданном отключении (crash, потеря сети, таймаут keep-alive). Брокер публикует `0` — сервер отмечает датчик offline.

### Сразу после подключения

Опубликовать online-статус:

| Параметр | Значение |
|----------|----------|
| Topic | `d/{serial}/s` |
| Payload | `1` (ASCII) |
| Retain | true |
| QoS | 1 |

### Graceful shutdown

При корректном отключении (Ctrl+C, deep sleep) датчик **должен явно опубликовать `0`** в status topic **перед** disconnect. Иначе LWT сработает с задержкой (keep-alive timeout).

---

## 8. Telemetry Payload (JSON)

### Топик

`d/{serial}/t`, QoS 1, retain false

### Схема

```json
{
  "v": 1,
  "id": "SENS-TH-00042",
  "ts": 1752588600,
  "mid": "a1b2c3d4",
  "t": -18.3,
  "h": 45.2,
  "bat": 87,
  "rssi": -67,
  "fw": "0.1.3",
  "up": 86400
}
```

### Поля

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `v` | integer | да | Версия схемы. Всегда `1` |
| `id` | string | да | Serial, совпадает с зарегистрированным |
| `ts` | integer | да | Unix timestamp (секунды, UTC) |
| `mid` | string | да | Message ID, 1–64 символа, уникален в пределах устройства |
| `t` | number | по типу | Температура °C. Диапазон: -55 .. +125 |
| `h` | number | по типу | Влажность %. Диапазон: 0 .. 100 |
| `bat` | integer | нет | Батарея %. 0 .. 100. Не отправлять если wired |
| `rssi` | integer | нет | Wi-Fi RSSI dBm. -120 .. 0 |
| `fw` | string | нет | Версия прошивки. Макс 20 символов |
| `up` | integer | нет | Uptime в секундах |

### Message ID (mid)

Используется для дедупликации. Стратегии:
- Monotonic counter (рекомендуется): `snprintf(mid, "%u", ++counter)`
- Timestamp + random: `snprintf(mid, "%lu_%04x", time(), random())`
- Сохранять counter в NVS при перезагрузке

### Ограничения

- Максимум **512 байт** JSON
- Обязательные поля по типу: TH → t,h; TP,T → t; HM → h

---

## 9. Интервалы и таймауты

| Параметр | Рекомендация |
|----------|--------------|
| Интервал телеметрии | 60 секунд |
| Минимальный интервал | 10 секунд |
| Таймаут offline на сервере | 300 секунд (DEVICE_OFFLINE_TIMEOUT_SEC) |

---

## 10. Алгоритм работы (псевдокод)

```
1. Загрузка
   ├── Прочитать из NVS: MQTT_HOST, MQTT_PORT, USERNAME, PASSWORD, SERIAL
   ├── Подключиться к Wi-Fi
   └── Если нет credentials → режим настройки (AP/BLE)

2. Подключение к MQTT
   ├── LWT: topic="d/{SERIAL}/s", payload="0", retain=true, qos=1
   ├── connect()
   ├── on_connect → publish("1", "d/{SERIAL}/s", retain, qos1)
   └── on_error → retry

3. Основной цикл (каждые 60 сек)
   ├── Прочитать сенсоры
   ├── Сформировать JSON payload
   ├── publish(payload, "d/{SERIAL}/t", qos1)
   └── sleep / delay

4. Graceful shutdown
   └── publish("0", "d/{SERIAL}/s") → disconnect()
```

---

## 11. Примеры payload

**TH (температура + влажность):**
```json
{"v":1,"id":"SENS-TH-00042","ts":1752588600,"mid":"1","t":-18.3,"h":45.2,"bat":87,"rssi":-67,"fw":"0.1.3"}
```

**TP (зонд температуры):**
```json
{"v":1,"id":"SENS-TP-00007","ts":1752588600,"mid":"2","t":4.1,"rssi":-52,"fw":"0.2.0"}
```

**T (только температура):**
```json
{"v":1,"id":"SENS-T-00001","ts":1752588600,"mid":"42","t":-20.1,"bat":63,"fw":"0.1.0"}
```

**HM (только влажность):**
```json
{"v":1,"id":"SENS-HM-00003","ts":1752588600,"mid":"107","h":72.4,"bat":91,"fw":"0.1.0"}
```

---

## 12. Требования к коду

1. **Безопасность:** Не хардкодить credentials в firmware. Хранить в NVS/secure storage.
2. **Устойчивость:** Retry при ошибках MQTT, экспоненциальный backoff.
3. **Энергосбережение:** Deep sleep между отправками для battery-powered.
4. **Валидация:** Проверять диапазоны (t: -55..125, h: 0..100, bat: 0..100) до отправки.
5. **Часы:** Синхронизировать время (NTP) для корректного `ts`.

---

## 13. Ссылки

- Provisioning API: `POST /api/v1/devices/provision` (см. coldchain-iot-v2)
- Hardware provisioning guide: `deploy/docs/hardware-provisioning.md`
- Simulator (reference impl): `tools/simulator/` в coldchain-iot-v2
- Payload schema: `packages/shared/src/schemas/payload.ts`
- Device types: `packages/shared/src/constants/device-types.ts`
