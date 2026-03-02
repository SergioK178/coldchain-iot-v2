

# MASTER-SPEC.md

## IoT Sensor Platform — Technical Master Specification

**Version:** 3.1
**Status:** FROZEN — source of truth для P1
**Scope:** Только P1. Всё за пределами P1 находится в разделе Backlog и не является частью спецификации.

---

## 1. Назначение документа

Этот документ — единственный источник правды для текущего этапа разработки (P1). Он фиксирует обязательные решения, контракты и границы scope.

**Маркировка:**
- **MUST** — обязательно реализовать в P1
- **MUST NOT** — явно запрещено в P1
- **BACKLOG** — осознанно отложено, не тратить время

Если требование не помечено — оно MUST.

---

## 2. Стратегическое решение: модель дистрибуции

Продукт поставляется как self-hosted решение, которое клиент разворачивает в своей локальной сети. Единица поставки — набор Docker-образов и `docker-compose.yml`.

Данные не покидают контур клиента. Внешних облачных зависимостей нет.

| Решение | Статус |
|---|---|
| Self-hosted / local-first | MUST |
| Один `docker compose up` поднимает всё | MUST |
| Зависимость от внешних облачных сервисов | MUST NOT |
| Регистрация на сервере вендора | MUST NOT |
| Cloud-hosted SaaS для малого бизнеса | BACKLOG (P3+) |
| Hybrid (локально + sync в облако) | BACKLOG (P3+) |
| Multi-tenant (несколько организаций на инстансе) | BACKLOG (P3+) |
| Billing, тарифы, подписки | BACKLOG (P3+) |

```
┌──────────────────────────────────────────────┐
│          ЛОКАЛЬНАЯ СЕТЬ КЛИЕНТА              │
│                                              │
│  ┌────────┐  MQTT   ┌─────────────────────┐  │
│  │Датчик 1│────────▶│  Сервер клиента     │  │
│  └────────┘         │  (docker compose)   │  │
│  ┌────────┐         │                     │  │
│  │Датчик 2│────────▶│  Mosquitto + API +  │  │
│  └────────┘         │  PostgreSQL + UI    │  │
│  ┌────────┐         │                     │  │
│  │Датчик N│────────▶│                     │  │
│  └────────┘         └─────────────────────┘  │
│                                              │
│  Данные не покидают эту границу              │
└──────────────────────────────────────────────┘
```

---

## 3. Цель и состав P1

### Цель

Доказать одну гипотезу: **датчик ставится за 10 минут, данные пишутся, алерт доходит, клиент готов тестировать дальше.**

### Что входит в P1

```
1. Датчик → Wi-Fi → MQTT → сервер             (ingestion)
2. Сервер принимает только зарегистрированные  (provisioning + device auth)
3. Показания пишутся с дедупликацией           (storage)
4. Порог превышен → HTTP POST на один URL      (alerting)
5. Один экран: все датчики + статус + значение (UI)
6. REST API + Swagger                          (integration point)
```

### Что НЕ входит в P1

| Исключено | Причина |
|---|---|
| Telegram-бот | Канал уведомлений — деталь. HTTP callback достаточно |
| Auth / login / register / users / roles | Self-hosted, один оператор. Статический bearer token |
| QR-онбординг | Provisioning через API. QR — BACKLOG P2 |
| HTTPS / TLS / Caddy | Локальная сеть. HTTPS — BACKLOG P2 |
| CI/CD pipeline | Ручной деплой на пилоте. Автоматизация — BACKLOG P2 |
| Locations / Zones CRUD через API | Одна организация, одна локация, одна зона создаются при инициализации (seed). Расширение — BACKLOG P2 |
| Calibration workflow | В P1 offset хранится как поле устройства, задаётся при provisioning или PATCH. Отдельная таблица calibration_records — BACKLOG P2 |
| Графики / история в UI | Только текущие значения. Графики — BACKLOG P2 |
| Экспорт CSV/PDF | BACKLOG P2 |
| Webhook engine с retry и HMAC | Один HTTP POST, один раз, без retry. Полноценные webhooks — BACKLOG P2 |
| SDK как npm-пакет | OpenAPI spec + curl-примеры. SDK — BACKLOG P2 |
| PWA / мобилка | BACKLOG P2 |
| Next.js | UI — статический SPA, раздаётся Fastify. Next.js — BACKLOG P2 |
| Redis | Нет очередей, нет кэша. Redis — BACKLOG P2 |
| Per-rule callback URL | Один глобальный URL в env. Per-rule — BACKLOG P2 |
| MQTT over TLS | BACKLOG P2 |
| Credential rotation | BACKLOG P2 |

---

## 4. Архитектура

### Один серверный процесс

Fastify — единственный серверный процесс. Он обслуживает REST API, слушает MQTT, проверяет пороги, отправляет callback, раздаёт статические файлы UI.

```
                  ┌──────────────────────────────────────────┐
                  │         Fastify (один процесс)           │
                  │                                          │
                  │  ┌───────────┐  ┌─────────┐  ┌───────┐  │
                  │  │ MQTT      │  │ REST    │  │Static │  │
                  │  │ Listener  │  │ /api/v1 │  │ UI    │  │
                  │  └─────┬─────┘  └────┬────┘  └───────┘  │
                  │        │             │                   │
                  │        └──────┬──────┘                   │
                  │               ▼                          │
                  │        ┌─────────────┐                   │
                  │        │  Services   │                   │
                  │        │             │                   │
                  │        │ ingestion   │──▶ HTTP callback  │
                  │        │ device      │   (при алерте)    │
                  │        │ alert       │                   │
                  │        │ provision   │                   │
                  │        │ audit       │                   │
                  │        └──────┬──────┘                   │
                  │               │                          │
                  └───────────────┼──────────────────────────┘
                                  │
                           ┌──────▼───────┐
                           │ PostgreSQL   │
                           │ + TimescaleDB│
                           └──────────────┘
```

### MUST NOT

- Второй серверный процесс (Next.js, BFF, отдельный bot-сервис)
- Внешние очереди (Redis, RabbitMQ, BullMQ)
- Внешний кэш

---

## 5. Стек

| Компонент | Технология | Версия (пинованная) |
|---|---|---|
| Runtime | Node.js | 22.x LTS |
| Language | TypeScript | 5.x, strict: true |
| API server | Fastify | 5.x |
| Validation | Zod | 3.x |
| ORM | Drizzle ORM | 0.38.x |
| Database | PostgreSQL + TimescaleDB | PG 16, TimescaleDB 2.17.x |
| MQTT broker | Eclipse Mosquitto | 2.0.20 |
| MQTT client (Node) | mqtt.js | 5.x |
| UI | Vite + React | Vite 6.x, React 19.x |
| Monorepo | pnpm workspaces | pnpm 9.x |
| Containerization | Docker + Docker Compose | Compose v2 |

Версии фиксируются в `package.json` (exact, без `^`), в `Dockerfile` (конкретный тег базового образа), в `docker-compose.yml` (конкретный тег каждого сервиса).

---

## 6. Предметная модель

### Иерархия

```
Organization (одна на инстанс, создаётся при init)
  └── Location (одна при init, CRUD — BACKLOG P2)
        └── Zone (одна при init, CRUD — BACKLOG P2)
              └── Device
                    ├── Readings
                    ├── AlertRules
                    └── AlertEvents

AuditLog (append-only, глобальный)
```

В P1 organization, location и zone существуют как записи в БД (создаются seed-скриптом при первом запуске), но CRUD API для них не реализуется. Устройство привязывается к zone при provisioning.

### Схема данных

```typescript
// --- organizations ---
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- locations ---
export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  address: varchar('address', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- zones ---
export const zones = pgTable('zones', {
  id: uuid('id').primaryKey().defaultRandom(),
  locationId: uuid('location_id').references(() => locations.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- devices ---
export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  serial: varchar('serial', { length: 50 }).notNull().unique(),
  // deviceType выводится из serial (SENS-{TYPE}-{NUM}), не хранится отдельно
  displayName: varchar('display_name', { length: 255 }),
  zoneId: uuid('zone_id').references(() => zones.id),
  powerSource: varchar('power_source', { length: 20 }).notNull(), // "battery" | "wired"
  calibrationOffsetC: real('calibration_offset_c').default(0),    // Поправка °C
  firmwareVersion: varchar('firmware_version', { length: 20 }),
  isOnline: boolean('is_online').default(false),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  lastTemperatureC: real('last_temperature_c'),
  lastHumidityPct: real('last_humidity_pct'),
  lastBatteryPct: integer('last_battery_pct'),
  provisionedAt: timestamp('provisioned_at', { withTimezone: true }).defaultNow(),
  decommissionedAt: timestamp('decommissioned_at', { withTimezone: true }),
  mqttUsername: varchar('mqtt_username', { length: 100 }).notNull().unique(),
  // Хранится hash в формате, совместимом с Mosquitto password_file
  // (sha512-pbkdf2 preferred), чтобы возможен был full rebuild passwd из БД.
  mqttPasswordHash: varchar('mqtt_password_hash', { length: 255 }).notNull(),
});

// --- readings ---
// TimescaleDB hypertable по полю timestamp
export const readings = pgTable('readings', {
  deviceId: uuid('device_id').references(() => devices.id).notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  messageId: varchar('message_id', { length: 64 }).notNull(),
  temperatureC: real('temperature_c'),       // nullable: зависит от типа датчика
  humidityPct: real('humidity_pct'),          // nullable
  batteryPct: integer('battery_pct'),         // nullable: null если wired
  rssiDbm: integer('rssi_dbm'),
  rawPayload: text('raw_payload').notNull(),  // Оригинальный JSON до трансформаций
});
// После миграции: SELECT create_hypertable('readings', 'timestamp');
// Индекс для API чтения:
// CREATE INDEX readings_device_ts_idx ON readings (device_id, "timestamp" DESC);

// --- ingestion_dedup ---
// Обычная таблица (НЕ hypertable) для идемпотентной дедупликации сообщений
export const ingestionDedup = pgTable('ingestion_dedup', {
  deviceId: uuid('device_id').references(() => devices.id).notNull(),
  messageId: varchar('message_id', { length: 64 }).notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  uqDeviceMessage: unique().on(table.deviceId, table.messageId),
}));

// --- alert_rules ---
export const alertRules = pgTable('alert_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').references(() => devices.id).notNull(),
  metric: varchar('metric', { length: 50 }).notNull(),     // 'temperature_c' | 'humidity_pct'
  operator: varchar('operator', { length: 4 }).notNull(),   // 'gt' | 'lt' | 'gte' | 'lte'
  threshold: real('threshold').notNull(),
  isActive: boolean('is_active').default(true),
  cooldownMinutes: integer('cooldown_minutes').notNull().default(15),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- alert_events ---
export const alertEvents = pgTable('alert_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  alertRuleId: uuid('alert_rule_id').references(() => alertRules.id).notNull(),
  deviceId: uuid('device_id').references(() => devices.id).notNull(),
  triggeredAt: timestamp('triggered_at', { withTimezone: true }).defaultNow(),
  readingValue: real('reading_value').notNull(),
  thresholdValue: real('threshold_value').notNull(),
  callbackAttempted: boolean('callback_attempted').default(false),
  callbackResponseCode: integer('callback_response_code'),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  acknowledgedBy: varchar('acknowledged_by', { length: 255 }),  // Свободная строка, оператор вводит имя
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- audit_log ---
// APPEND-ONLY. Application layer MUST NOT выполнять UPDATE или DELETE.
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow(),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 100 }),
  actor: varchar('actor', { length: 255 }).notNull(),  // P1: "system" или строка от оператора
  details: jsonb('details'),
});
```

### Правила предметной модели

**Device type выводится из serial, не хранится отдельно.**

Serial format: `SENS-{TYPE}-{NNNNN}`

```typescript
// packages/shared/src/constants/device-types.ts
export const DEVICE_TYPES = {
  TH: { label: 'Temperature + Humidity', capabilities: ['temperature_c', 'humidity_pct'] },
  TP: { label: 'Temperature Probe',     capabilities: ['temperature_c'] },
  T:  { label: 'Temperature Only',      capabilities: ['temperature_c'] },
  HM: { label: 'Humidity Only',         capabilities: ['humidity_pct'] },
} as const;

export type DeviceTypeCode = keyof typeof DEVICE_TYPES;
```

Функция извлечения типа из serial:

```typescript
export function parseSerial(serial: string): { type: DeviceTypeCode; number: string } {
  const match = serial.match(/^SENS-([A-Z]{1,2})-(\d{5})$/);
  if (!match) throw new Error(`Invalid serial format: ${serial}`);
  const type = match[1] as DeviceTypeCode;
  if (!(type in DEVICE_TYPES)) throw new Error(`Unknown device type: ${type}`);
  return { type, number: match[2] };
}
```

Сервер при provisioning валидирует формат serial и извлекает из него device type. Поле `deviceType` в API является вычисляемым (`derived from serial`), в БД не хранится.

**Audit log — append-only.**

Сервис `audit` экспортирует единственную функцию `append()`. Методы `update`, `delete`, `upsert` для таблицы `audit_log` не реализуются. В repository-слое для этой таблицы нет ни одного метода, кроме `insert` и `findMany`.

**Actor в P1.**

В P1 нет системы пользователей. Единое правило:
- Для всех mutating endpoints (`POST`, `PATCH`, `DELETE`), кроме acknowledge, поддерживается опциональный query-параметр `?actor=...`; если не передан — в audit пишется `"system"`.
- Для `PATCH /api/v1/alert-events/:id/acknowledge` `acknowledgedBy` в body обязателен и это же значение используется как `actor` в audit log.

Валидация: непустая строка, максимум 255 символов. Сервер не проверяет, кто это. Полноценная идентификация — BACKLOG P2.

---

## 7. Payload Contract

### Формат сообщения от датчика (MQTT)

```typescript
// packages/shared/src/schemas/payload.ts
import { z } from 'zod';

export const DevicePayloadSchema = z.object({
  v:    z.literal(1),                                   // Версия схемы. Ровно 1.
  id:   z.string().regex(/^SENS-[A-Z]{1,2}-\d{5}$/),   // Serial устройства
  ts:   z.number().int().positive(),                     // Unix timestamp, seconds
  mid:  z.string().min(1).max(64),                       // Message ID, уникален в пределах устройства

  // Capabilities — все optional, зависят от типа датчика
  t:    z.number().min(-55).max(125).optional(),          // Температура °C
  h:    z.number().min(0).max(100).optional(),            // Влажность %

  // Meta — все optional
  bat:  z.number().int().min(0).max(100).optional(),      // Батарея %. Отсутствует если wired
  rssi: z.number().int().min(-120).max(0).optional(),     // Wi-Fi RSSI dBm
  fw:   z.string().max(20).optional(),                    // Firmware version
  up:   z.number().int().min(0).optional(),                // Uptime seconds
});

export type DevicePayload = z.infer<typeof DevicePayloadSchema>;
```

**Контрактные требования к payload:**

| Требование | Описание |
|---|---|
| `mid` уникальность | `mid` уникален в пределах одного устройства. Допустимые генераторы: monotonic counter per device или random/UUID-like id. Сервер дедуплицирует по паре `(serial, mid)` / `(deviceId, messageId)` |
| Capability validation | Сервер после парсинга проверяет: если тип устройства (из serial) предполагает `temperature_c`, то поле `t` обязано присутствовать. Если тип не предполагает поля — оно игнорируется |
| Timestamp | `ts` — UTC unix seconds. Сервер не корректирует. При отображении сортировка всегда по `ts` |
| Размер | Максимум 512 байт JSON. Сообщения больше — отклоняются |

**Примеры:**

Датчик TH (температура + влажность, батарейный):
```json
{"v":1,"id":"SENS-TH-00042","ts":1752588600,"mid":"a1b2c3d4","t":-18.3,"h":45.2,"bat":87,"rssi":-67,"fw":"0.1.3"}
```

Датчик TP (проводной зонд, только температура, от сети):
```json
{"v":1,"id":"SENS-TP-00007","ts":1752588600,"mid":"e5f6a7b8","t":4.1,"rssi":-52,"fw":"0.2.0","up":86400}
```

### MQTT Topics

```typescript
// packages/shared/src/constants/mqtt.ts
export const MQTT = {
  telemetry: (serial: string) => `d/${serial}/t` as const,
  status:    (serial: string) => `d/${serial}/s` as const,

  sub: {
    allTelemetry: 'd/+/t' as const,
    allStatus:    'd/+/s' as const,
  },
} as const;
```

Других топиков в P1 нет. Command topic (`d/{serial}/c`) — BACKLOG P2.

### LWT / Status Contract

| Событие | Кто публикует | Topic | Payload | Retain | QoS |
|---|---|---|---|---|---|
| Датчик подключился | Датчик | `d/{serial}/s` | `1` (ASCII) | true | 1 |
| Датчик отключился | Broker (LWT) | `d/{serial}/s` | `0` (ASCII) | true | 1 |

Сервер подписан на `d/+/s`. При получении:
- `1` → `devices.isOnline = true`, `devices.lastSeenAt = now()`, audit: `device.online`
- `0` → `devices.isOnline = false`, audit: `device.offline`

**Дополнительно:** сервер при каждом telemetry-сообщении обновляет `lastSeenAt`. Если `lastSeenAt` старше **5 минут** (настраивается через env `DEVICE_OFFLINE_TIMEOUT_SEC=300`), а LWT не приходил — устройство считается offline. Проверка — при каждом входящем telemetry от любого устройства (piggyback) и по `setInterval` раз в 60 секунд.

---

## 8. Обязательные нефункциональные требования

### 8.1 Ingestion

| # | Требование |
|---|---|
| I1 | Каждое MQTT-сообщение в `d/+/t` валидируется по `DevicePayloadSchema`. Невалидные отклоняются, пишется audit log (`payload.invalid`) |
| I2 | Serial из payload сверяется с таблицей `devices`. Незарегистрированные отклоняются, пишется audit log (`device.unknown_message`) с serial и raw payload |
| I3 | Повторное сообщение с тем же `mid` у того же устройства не создаёт дубля. Реализация: (1) `INSERT INTO ingestion_dedup(device_id, message_id, first_seen_at) ... ON CONFLICT (device_id, message_id) DO NOTHING`; (2) если вставка прошла — пишем `readings`; (3) если конфликт — это дубль, silently ignore (не ошибка, не логируется) |
| I4 | Capability validation: сервер проверяет, что обязательные для данного типа устройства поля присутствуют. Если `SENS-TH-*` прислал payload без `t` — отклоняется с audit log (`payload.missing_capability`) |
| I5 | Калибровочная поправка: если `devices.calibrationOffsetC != 0`, значение `t` из payload корректируется (`t + offset`) перед записью в `readings.temperatureC`. Значение `rawPayload` содержит оригинальный JSON без коррекции |
| I6 | Запись в `readings`: `temperatureC`, `humidityPct` заполняются из payload. Поля, отсутствующие в payload, записываются как `NULL` |
| I7 | После записи reading обновляется `devices`: `lastSeenAt`, `isOnline = true`, `lastTemperatureC`, `lastHumidityPct`, `lastBatteryPct`, `firmwareVersion` |
| I8 | После записи reading и обновления device вызывается alert check (синхронно, в том же цикле обработки сообщения) |
| I9 | Порядок обработки между устройствами не гарантируется. Порядок сообщений одного устройства не гарантируется. Сортировка readings — всегда по `timestamp` из payload, не по времени вставки |

### 8.2 Provisioning

| # | Требование |
|---|---|
| P1 | Устройство регистрируется через `POST /api/v1/devices/provision` |
| P2 | Сервер валидирует формат serial, извлекает device type |
| P3 | Сервер генерирует уникальные MQTT credentials: `mqtt_username` = `dev_{serial_lowercase}`, `mqtt_password` = cryptographically random 32-char string |
| P4 | Password hash записывается в `devices.mqttPasswordHash` в формате, совместимом с Mosquitto `password_file` (предпочтительно `sha512-pbkdf2`, допускается `sha512`) |
| P5 | Канонический источник правды для MQTT credentials — БД (`devices`). `passwd` и `acl` — производные артефакты для Mosquitto |
| P6 | После каждого provision/decommission сервер полностью пересобирает `passwd` и `acl` из активных устройств в БД + admin MQTT user из env: пишет во временные файлы, делает atomic rename, затем отправляет reload (SIGHUP) в Mosquitto |
| P7 | Сервер при старте всегда выполняет reconcile: полная пересборка `passwd`/`acl` из БД устройств + admin MQTT user из env, даже если файлы уже существуют |
| P8 | Ответ API содержит plaintext `mqtt_password` (один раз). После этого plaintext не хранится нигде |
| P9 | Decommission: `DELETE /api/v1/devices/:serial` устанавливает `decommissionedAt`, затем запускает full rebuild `passwd`/`acl` и reload Mosquitto. Исторические readings и alert events сохраняются |
| P10 | Audit log: `device.provisioned`, `device.decommissioned` |
| P11 | Provision/decommission считается успешным только если: БД записана, `passwd/acl` пересобраны, reload Mosquitto выполнен. Если любой шаг после БД не удался — API возвращает 500; система остаётся восстановимой через reconcile при следующем старте/следующей успешной операции |
| P12 | Для устранения edge-case после частичного сбоя: каждый `POST /api/v1/devices/provision` обязан выполнять reconcile `passwd`/`acl` до проверки конфликта serial. При `DEVICE_ALREADY_PROVISIONED` сервер возвращает 409 уже после reconcile |

**Файловая механика Mosquitto credentials:**

```
# Bind mounts в docker-compose:
# Host: ./data/mosquitto          → Container (mqtt):   /mosquitto/config/runtime
#
# Server container тоже монтирует ту же директорию:
# Host: ./data/mosquitto          → Container (server): /mosquitto-data
#
# Server не редактирует файлы построчно.
# Server пересобирает passwd/acl из БД устройств + admin user из env
# целиком (tmp + atomic rename),
# затем шлёт SIGHUP → Mosquitto перечитывает.
# Временные файлы и целевые файлы находятся в одном mounted directory,
# чтобы `rename()` был truly atomic.
```

### 8.3 Alerting

| # | Требование |
|---|---|
| A1 | При каждом записанном reading проверяются все `alert_rules` для данного устройства, где `isActive = true` |
| A2 | Проверка: значение reading (по `metric`) сравнивается с `threshold` по `operator`. Операторы: `gt` (>), `lt` (<), `gte` (>=), `lte` (<=) |
| A3 | Cooldown: если `lastTriggeredAt` + `cooldownMinutes` > now — правило не срабатывает, даже если условие истинно |
| A4 | При срабатывании: создаётся запись в `alert_events`, обновляется `alertRules.lastTriggeredAt` |
| A5 | Callback: если env `ALERT_CALLBACK_URL` задан — отправляется HTTP POST. Один URL, глобальный. Формат тела — см. раздел 9. Timeout: 5 секунд. Один attempt, без retry |
| A6 | `callbackAttempted` = true, если HTTP-ответ получен (любой код). `callbackResponseCode` = HTTP status code ответа. Если timeout/network error — `callbackAttempted = false`, `callbackResponseCode = NULL`. Успех callback в P1 трактуется как `2xx` по `callbackResponseCode` |
| A7 | Acknowledgement: `PATCH /api/v1/alert-events/:id/acknowledge` с полем `acknowledgedBy` (строка, обязательная). Устанавливает `acknowledgedAt = now()`. Повторный acknowledge — 409 |
| A8 | Audit log: `alert.triggered`, `alert.acknowledged` |
| A9 | Per-rule callback URL | MUST NOT в P1. BACKLOG P2 |
| A10 | Retry, exponential backoff | MUST NOT в P1. BACKLOG P2 |

### 8.4 Audit

| # | Требование |
|---|---|
| AU1 | Таблица `audit_log` — append-only. Application code содержит только `insert` и `select`. Нет `update`, `delete`, `upsert` |
| AU2 | Actions в P1: `device.provisioned`, `device.decommissioned`, `device.online`, `device.offline`, `device.unknown_message`, `alert.triggered`, `alert.acknowledged`, `alert_rule.created`, `alert_rule.updated`, `alert_rule.deleted`, `payload.invalid`, `payload.missing_capability`, `config.changed` |
| AU3 | `actor`: для mutating endpoints (кроме acknowledge) — `?actor=...` или `"system"` по умолчанию; для acknowledge actor берётся из обязательного `acknowledgedBy` |
| AU4 | `details`: JSON с контекстом. Для `device.unknown_message` — serial + raw payload. Для `alert.triggered` — reading value + threshold. Формат details не стандартизирован, но каждый action type должен иметь предсказуемую структуру |

### 8.5 Security

**MQTT:**

| # | Требование |
|---|---|
| S1 | `allow_anonymous false` в Mosquitto config |
| S2 | Per-device username/password (см. Provisioning P5–P6) |
| S3 | ACL: устройство пишет только в свои топики (`d/{serial}/t`, `d/{serial}/s`) |
| S4 | API-сервер подключается к Mosquitto как admin-user (отдельные credentials, заданные в env) с правом подписки на `d/+/t` и `d/+/s` |
| S5 | MQTT-порт 1883 доступен в локальной сети клиента. Клиент несёт ответственность за то, чтобы порт не был доступен из интернета. Документация содержит явное предупреждение |
| S6 | MQTT over TLS | BACKLOG P2 |

**API:**

| # | Требование |
|---|---|
| S7 | Все endpoints (кроме `GET /api/v1/health`) требуют заголовок `Authorization: Bearer {API_TOKEN}` |
| S8 | `API_TOKEN` — статическая строка, задаётся в `.env`. Минимум 32 символа |
| S9 | Input validation (Zod) на каждом endpoint |
| S10 | Полноценный auth (users, login, JWT, roles) | BACKLOG P2 |

**Data:**

| # | Требование |
|---|---|
| S11 | PostgreSQL credentials задаются через `.env`, не дефолтные |
| S12 | `.env.example` не содержит реальных значений, только placeholder-комментарии |
| S13 | Персистентность обеспечивается bind mounts в `./data/...` на хосте клиента (`./data/postgres`, `./data/mosquitto/...`) |
| S14 | Документация содержит раздел backup/restore с конкретными командами `pg_dump` / `pg_restore` |
| S15 | MQTT passwords в `password_file` и в `devices.mqttPasswordHash` хранятся в Mosquitto-compatible hashed format (`sha512-pbkdf2` preferred; допускается `sha512`) |

**P1 exception (privileged):**

В P1 server имеет доступ к Docker Engine socket (`/var/run/docker.sock`, read-only mount) только для reload Mosquitto после изменения `passwd/acl`. Это временный компромисс P1, не норма целевой архитектуры.

---

## 9. API Contract

### Общие правила

| Правило | Описание |
|---|---|
| Base path | `/api/v1` |
| Content-Type | `application/json` для запросов и ответов |
| Auth | `Authorization: Bearer {API_TOKEN}` на всех endpoints кроме `/health` |
| Ошибка auth | 401 `{ "ok": false, "error": { "code": "UNAUTHORIZED", "message": "..." } }` |
| Валидация | 400 с `code: "VALIDATION_ERROR"` и `message` с описанием |
| Not found | 404 с конкретным кодом, например `DEVICE_NOT_FOUND` |
| Conflict | 409 с конкретным кодом |
| Server error | 500 с `code: "INTERNAL_ERROR"`, без стектрейса |
| Actor (mutating) | Для всех `POST`/`PATCH`/`DELETE`, кроме acknowledge: опциональный `?actor=...`; если не передан — в audit пишется `"system"` |
| Actor (acknowledge) | Для `PATCH /alert-events/:id/acknowledge` actor берётся из обязательного `acknowledgedBy` в body; `?actor` не поддерживается |

### Response format

Успех:
```json
{ "ok": true, "data": { ... } }
```

Ошибка:
```json
{ "ok": false, "error": { "code": "ERROR_CODE", "message": "Human-readable" } }
```

Никаких `meta`, `requestId`, `pagination` в P1.
`deviceType` в API-ответах — вычисляемое поле из `serial` (`parseSerial(serial)`), в БД не хранится.

### Endpoints

#### `GET /api/v1/health`

Auth: не требуется.

Response 200:
```json
{ "ok": true, "data": { "version": "0.1.0", "uptime": 3600 } }
```

---

#### `POST /api/v1/devices/provision`

Регистрирует новое устройство, генерирует MQTT credentials, обновляет Mosquitto password и ACL файлы.

Request:
```json
{
  "serial": "SENS-TH-00042",
  "displayName": "Морозилка №3",
  "powerSource": "battery",
  "zoneId": "uuid-of-zone",
  "calibrationOffsetC": 0.0
}
```

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| serial | string | да | Формат `SENS-{TYPE}-{NNNNN}` |
| displayName | string | нет | Человекочитаемое имя |
| powerSource | `"battery"` \| `"wired"` | да | |
| zoneId | uuid | нет | Привязка к зоне |
| calibrationOffsetC | number | нет | Default: 0.0 |

Response 201:
```json
{
  "ok": true,
  "data": {
    "serial": "SENS-TH-00042",
    "deviceType": "TH",
    "displayName": "Морозилка №3",
    "mqtt": {
      "username": "dev_sens_th_00042",
      "password": "generated_plaintext_password_32chars",
      "topic": "d/SENS-TH-00042/t",
      "statusTopic": "d/SENS-TH-00042/s"
    }
  }
}
```

Ошибки:
- 400 `INVALID_SERIAL_FORMAT` — serial не прошёл regex
- 400 `UNKNOWN_DEVICE_TYPE` — тип из serial не в `DEVICE_TYPES`
- 409 `DEVICE_ALREADY_PROVISIONED` — serial уже зарегистрирован (reconcile `passwd/acl` выполняется до ответа 409)
- 404 `ZONE_NOT_FOUND` — если zoneId указан, но не существует

Поведение `zoneId`:
- Если `zoneId` не передан, сервер привязывает устройство к default seeded zone `Default Zone` (в русской локализации допускается `Основная зона`)
- Если `zoneId` передан, сервер валидирует, что зона принадлежит текущей location

---

#### `GET /api/v1/devices`

Response 200:
```json
{
  "ok": true,
  "data": [
    {
      "serial": "SENS-TH-00042",
      "deviceType": "TH",
      "displayName": "Морозилка №3",
      "zoneName": "Кухня",
      "locationName": "Ресторан Берёзка",
      "powerSource": "battery",
      "lastSeenAt": "2025-07-15T14:30:00Z",
      "lastTemperatureC": -18.3,
      "lastHumidityPct": 45.2,
      "lastBatteryPct": 87,
      "connectivityStatus": "online",
      "alertStatus": "normal",
      "provisionedAt": "2025-06-01T10:00:00Z"
    }
  ]
}
```

`connectivityStatus`: `"online"` или `"offline"` (связность устройства).
`alertStatus`: `"normal"` — нет неподтверждённых alert events, `"alert"` — есть хотя бы один unacknowledged alert event.
`isOnline` остаётся внутренним полем БД и в API-контракт P1 не выводится.

Decommissioned устройства не возвращаются.

---

#### `GET /api/v1/devices/:serial`

Response 200: один объект из списка выше (та же структура).

Ошибки: 404 `DEVICE_NOT_FOUND`.

---

#### `PATCH /api/v1/devices/:serial`

Request (все поля optional):
```json
{
  "displayName": "Новое имя",
  "zoneId": "uuid-or-null",
  "calibrationOffsetC": -0.5
}
```

Response 200: обновлённый объект устройства.

Audit log: `config.changed` с деталями что изменилось.

---

#### `DELETE /api/v1/devices/:serial`

Query параметр `?actor=Иванов` (опционален, default actor = `"system"`).

Soft delete: устанавливает `decommissionedAt`; затем выполняется full rebuild `passwd`/`acl` из БД и SIGHUP для Mosquitto.

Response 200:
```json
{ "ok": true, "data": { "serial": "SENS-TH-00042", "decommissionedAt": "2025-07-15T15:00:00Z" } }
```

---

#### `GET /api/v1/devices/:serial/readings`

Query параметры:
| Параметр | Тип | Default | Описание |
|---|---|---|---|
| limit | integer 1–1000 | 100 | Кол-во записей |
| since | ISO8601 | – | Начало диапазона |
| until | ISO8601 | – | Конец диапазона |

Response 200:
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
    }
  ]
}
```

Сортировка: по `timestamp` descending.

---

#### `POST /api/v1/devices/:serial/alert-rules`

Request:
```json
{
  "metric": "temperature_c",
  "operator": "gt",
  "threshold": -15.0,
  "cooldownMinutes": 15
}
```

| Поле | Допустимые значения |
|---|---|
| metric | `"temperature_c"`, `"humidity_pct"` |
| operator | `"gt"`, `"lt"`, `"gte"`, `"lte"` |
| threshold | number |
| cooldownMinutes | integer >= 1, default 15 |

Валидация: `metric` должен соответствовать capabilities типа устройства. Нельзя создать правило на `humidity_pct` для `SENS-TP-*`.

Response 201: созданное правило с `id`.
Audit log: `alert_rule.created`.

---

#### `GET /api/v1/devices/:serial/alert-rules`

Response 200: массив правил.

---

#### `PATCH /api/v1/alert-rules/:id`

Обновление `threshold`, `operator`, `isActive`, `cooldownMinutes`.
Audit log: `alert_rule.updated`.

---

#### `DELETE /api/v1/alert-rules/:id`

Hard delete.
Audit log: `alert_rule.deleted`.

---

#### `GET /api/v1/alert-events`

Query параметры: `?deviceSerial=`, `?acknowledged=true|false`, `?since=`, `?limit=100`.

Response 200: массив alert events с полями `id`, `deviceSerial`, `deviceName`, `metric`, `operator`, `readingValue`, `thresholdValue`, `triggeredAt`, `acknowledgedAt`, `acknowledgedBy`.

---

#### `PATCH /api/v1/alert-events/:id/acknowledge`

Request:
```json
{
  "acknowledgedBy": "Иванов"
}
```

`acknowledgedBy` — обязательная непустая строка.
Для этого endpoint `?actor` не поддерживается: actor в audit log берётся из `acknowledgedBy`.

Response 200: обновлённый alert event.

Ошибки: 409 `ALREADY_ACKNOWLEDGED` — если `acknowledgedAt` уже не null.

---

#### `GET /api/v1/audit-log`

Query параметры: `?since=`, `?action=`, `?entityType=`, `?limit=100`.

Response 200: массив записей.

---

### Alert Callback Payload

При `ALERT_CALLBACK_URL` is set и alert срабатывает, сервер отправляет:

```http
POST {ALERT_CALLBACK_URL}
Content-Type: application/json

{
  "event": "alert.triggered",
  "triggeredAt": "2025-07-15T14:30:00Z",
  "device": {
    "serial": "SENS-TH-00042",
    "displayName": "Морозилка №3",
    "zoneName": "Кухня",
    "locationName": "Ресторан Берёзка"
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

---

## 10. UI (P1)

### Один экран

P1 содержит **один экран** — таблица/список всех активных устройств.

Для каждого устройства отображается:
- Serial
- Display name
- Zone name
- Connectivity status и alert status (UI вычисляет цвет по приоритету)
- Последнее значение температуры (если есть)
- Последнее значение влажности (если есть)
- Батарея % (если батарейный)
- Время последнего показания (относительное: «2 мин назад»)

Неподтверждённые алерты отображаются красной строкой в том же списке, с кнопкой «Подтвердить» (вызывает `PATCH .../acknowledge`, запрашивает имя оператора через prompt/modal).

Правило цвета строки в UI:
- Если `alertStatus = "alert"` → красный.
- Иначе если `connectivityStatus = "offline"` → серый.
- Иначе → зелёный.

Это всё. Нет отдельных страниц, нет маршрутизации, нет навигации. Один fetch на `/api/v1/devices` + `/api/v1/alert-events?acknowledged=false`, автообновление каждые 30 секунд.

**MUST NOT в P1:** отдельная страница деталей устройства, графики, история readings в UI, настройки, экспорт. Всё доступно через API/Swagger для тех, кому нужно.

---

## 11. On-Premise Delivery

### Docker Compose

```yaml
services:
  db:
    image: timescale/timescaledb:2.17.2-pg16
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME:-sensors}
      POSTGRES_USER: ${DB_USER:-sensors}
      POSTGRES_PASSWORD: ${DB_PASSWORD:?error: set DB_PASSWORD in .env}
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-sensors}"]
      interval: 5s
      retries: 5

  mqtt:
    image: eclipse-mosquitto:2.0.20
    restart: unless-stopped
    volumes:
      - ./config/mosquitto/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro
      - ./data/mosquitto:/mosquitto/config/runtime
    ports:
      - "${MQTT_PORT:-1883}:1883"

  server:
    image: ghcr.io/your-org/sensor-server:0.1.0
    restart: unless-stopped
    depends_on:
      db: { condition: service_healthy }
      mqtt: { condition: service_started }
    environment:
      DATABASE_URL: postgresql://${DB_USER:-sensors}:${DB_PASSWORD}@db:5432/${DB_NAME:-sensors}
      MQTT_URL: mqtt://mqtt:1883
      MQTT_ADMIN_USER: ${MQTT_ADMIN_USER:-server}
      MQTT_ADMIN_PASSWORD: ${MQTT_ADMIN_PASSWORD:?error: set MQTT_ADMIN_PASSWORD in .env}
      API_TOKEN: ${API_TOKEN:?error: set API_TOKEN in .env}
      ALERT_CALLBACK_URL: ${ALERT_CALLBACK_URL:-}
      DEVICE_OFFLINE_TIMEOUT_SEC: ${DEVICE_OFFLINE_TIMEOUT_SEC:-300}
    volumes:
      - ./data/mosquitto:/mosquitto-data
      - /var/run/docker.sock:/var/run/docker.sock:ro
    ports:
      - "${HTTP_PORT:-8080}:8080"

volumes: {}
# Все данные в ./data/ на хосте (bind mounts), не named volumes.
# Это позволяет клиенту видеть, бэкапить и переносить данные.
```

### Файловая структура на хосте клиента

```
sensor-platform/
├── docker-compose.yml
├── .env                         # Заполняется клиентом
├── .env.example                 # Шаблон с комментариями
├── config/
│   └── mosquitto/
│       └── mosquitto.conf       # Поставляется нами, read-only
├── data/                        # Поставляется в артефакте (включая пустые passwd/acl)
│   ├── postgres/                # PG data directory
│   └── mosquitto/
│       ├── passwd               # Пустой файл в поставке; далее derived artifact, пересобирается server
│       ├── acl                  # Пустой файл в поставке; далее derived artifact, пересобирается server
│       └── data/                # Mosquitto persistence
├── scripts/
│   ├── backup.sh
│   └── restore.sh
└── docs/
    ├── install-guide.md
    └── security.md
```

### .env.example

```bash
# === ОБЯЗАТЕЛЬНЫЕ (без них не запустится) ===

# Пароль PostgreSQL. Придумайте сложный, >= 16 символов.
DB_PASSWORD=

# Token для доступа к API. Придумайте сложный, >= 32 символов.
API_TOKEN=

# Пароль admin-пользователя MQTT (используется сервером для подключения к брокеру).
MQTT_ADMIN_PASSWORD=

# === ОПЦИОНАЛЬНЫЕ ===

# DB_NAME=sensors
# DB_USER=sensors
# MQTT_PORT=1883
# MQTT_ADMIN_USER=server
# HTTP_PORT=8080
# DEVICE_OFFLINE_TIMEOUT_SEC=300

# URL для HTTP-уведомлений при тревоге. Если не задан — callback не отправляется.
# ALERT_CALLBACK_URL=http://192.168.1.100:9000/hooks/sensor
```

### Mosquitto config

```conf
# config/mosquitto/mosquitto.conf
listener 1883
protocol mqtt

allow_anonymous false
password_file /mosquitto/config/runtime/passwd
acl_file /mosquitto/config/runtime/acl

persistence true
persistence_location /mosquitto/config/runtime/data/

log_dest stdout
log_type warning
log_type error
```

### Init flow

При первом `docker compose up`:
1. PostgreSQL инициализируется, Drizzle миграции запускаются автоматически (server при старте)
2. TimescaleDB hypertable создаётся миграцией
3. Seed: создаётся одна organization, одна location, одна zone (`Default Zone`, в русской локализации допускается `Основная зона`)
4. В поставке уже есть пустые файлы `deploy/data/mosquitto/passwd` и `deploy/data/mosquitto/acl` (часть артефакта)
5. Mosquitto стартует, читая эти файлы; server не создаёт путь с нуля
6. Server выполняет reconcile и пересобирает `passwd`/`acl` из БД устройств + admin MQTT user из env, затем отправляет reload Mosquitto
7. Server подключается к Mosquitto как admin, подписывается на `d/+/t` и `d/+/s`
8. UI доступен на `http://{host}:{HTTP_PORT}`
9. Swagger UI доступен на `http://{host}:{HTTP_PORT}/api/docs`

---

## 12. Структура репозитория

```
sensor-platform/
├── README.md
├── MASTER-SPEC.md                      # Этот документ
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
│
├── deploy/                             # Всё что уходит к клиенту
│   ├── docker-compose.yml
│   ├── .env.example
│   ├── config/
│   │   └── mosquitto/
│   │       └── mosquitto.conf
│   ├── data/
│   │   └── mosquitto/
│   │       ├── passwd            # Пустой файл в поставке
│   │       └── acl               # Пустой файл в поставке
│   ├── scripts/
│   │   ├── backup.sh
│   │   └── restore.sh
│   └── docs/
│       ├── install-guide.md
│       ├── security.md
│       └── backup-restore.md
│
├── packages/
│   ├── shared/                         # @sensor/shared
│   │   ├── package.json
│   │   └── src/
│   │       ├── schemas/
│   │       │   ├── payload.ts          # DevicePayloadSchema
│   │       │   ├── api.ts              # ApiSuccess / ApiError
│   │       │   ├── device.ts           # Request/response Zod schemas
│   │       │   └── alert.ts
│   │       ├── constants/
│   │       │   ├── device-types.ts     # DEVICE_TYPES + parseSerial()
│   │       │   ├── mqtt.ts             # MQTT topic builders
│   │       │   └── errors.ts           # Error code enum
│   │       └── index.ts
│   │
│   └── db/                             # @sensor/db
│       ├── package.json
│       ├── drizzle.config.ts
│       └── src/
│           ├── schema.ts               # Все таблицы (один файл, P1)
│           ├── migrate.ts              # Запуск миграций при старте сервера
│           ├── seed.ts                 # Начальные org/location/zone
│           ├── client.ts               # Drizzle client factory
│           └── migrations/
│
├── apps/
│   └── server/                         # @sensor/server
│       ├── package.json
│       ├── Dockerfile
│       └── src/
│           ├── index.ts                # Entry: start Fastify
│           ├── app.ts                  # Fastify instance factory
│           ├── config.ts               # Zod env validation
│           ├── plugins/
│           │   ├── auth.ts             # Bearer token check
│           │   ├── mqtt.ts             # Connect, subscribe, route messages
│           │   └── swagger.ts          # @fastify/swagger
│           ├── routes/
│           │   ├── health.ts
│           │   ├── devices.ts
│           │   ├── readings.ts
│           │   ├── alert-rules.ts
│           │   ├── alert-events.ts
│           │   └── audit.ts
│           ├── services/
│           │   ├── ingestion.ts        # I1–I9
│           │   ├── device.ts
│           │   ├── alert.ts            # A1–A8
│           │   ├── provision.ts        # P1–P12
│           │   └── audit.ts            # AU1–AU4
│           └── lib/
│               ├── mosquitto-files.ts  # Read/write passwd + ACL files
│               ├── mosquitto-reload.ts # Send SIGHUP to Mosquitto container
│               └── callback.ts         # HTTP POST for alert callback
│
├── ui/                                 # Static SPA
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                     # Один экран, без роутера
│       ├── components/
│       │   ├── DeviceRow.tsx
│       │   ├── StatusBadge.tsx
│       │   └── AcknowledgeButton.tsx
│       └── lib/
│           └── api.ts
│
└── tools/
    ├── simulator/                      # MQTT device simulator
    │   ├── package.json
    │   └── src/
    │       └── index.ts
    └── provision-cli/                  # Batch provisioning from CSV
        ├── package.json
        └── src/
            └── index.ts
```

---

## 13. Backlog

Всё ниже — осознанно исключено из P1. Детализация будет после завершения P1 и обратной связи от пилотов.

**P2 (после успешного пилота, ~4–6 недель):**
- Full auth (users, login, JWT, roles)
- Next.js frontend (замена SPA, графики Recharts, device detail page)
- Telegram-бот уведомлений
- Webhook engine (retry, HMAC, multiple URLs, per-rule URL)
- SDK npm-пакет (@sensor/sdk)
- QR-онбординг
- Locations / Zones CRUD API
- Calibration records (отдельная таблица, workflow, audit trail)
- MQTT over TLS
- Credential rotation API
- CI/CD pipeline (GitHub Actions)
- HTTPS reverse proxy (Caddy)
- Redis (кэш last readings, rate limiting)
- CSV/PDF export
- Pagination (cursor-based)
- Remove docker.sock dependency for broker reload (replace with safer reload helper / auth plugin based approach)

**P3 (после 20+ инсталляций):**
- Коннекторы (iiko, 1С, HACCP-online)
- SDK Python, Go
- Developer Portal
- OTA firmware updates
- White-label
- License management
- Cloud-hosted SaaS
- Multi-tenant

**P4 (масштабирование):**
- Kubernetes
- Enterprise SSO/SAML
- Anomaly detection
- Marketplace
- Billing

---

## 14. Checklist готовности P1

### Firmware

```
[ ] Датчик формирует payload по DevicePayloadSchema (v=1, serial, ts, mid, capabilities)
[ ] Датчик использует per-device MQTT credentials (username/password из provisioning)
[ ] Датчик настраивает LWT: topic d/{serial}/s, payload "0", retain true, QoS 1
[ ] Датчик при подключении публикует "1" в d/{serial}/s (retain true, QoS 1)
[ ] Датчик генерирует уникальный mid для каждого сообщения (counter или random)
[ ] Wi-Fi настройка работает для пилота (hardcode / captive portal — решение firmware team)
```

### Server

```
[ ] docker compose up поднимает db + mqtt + server
[ ] Миграции запускаются при старте server
[ ] Seed создаёт organization + location + zone при первом запуске
[ ] Mosquitto: allow_anonymous false, password_file, ACL
[ ] Provision API: создаёт device + MQTT credentials + full rebuild passwd/ACL из БД + SIGHUP
[ ] Startup reconcile: server всегда пересобирает passwd/ACL из БД устройств + admin user из env
[ ] Ingestion: подписка на d/+/t, парсинг, валидация по DevicePayloadSchema
[ ] Ingestion: отклонение незарегистрированных устройств + audit log
[ ] Ingestion: capability validation (обязательные поля для типа)
[ ] Ingestion: дедупликация через ingestion_dedup по (deviceId, messageId), дубли silently ignored
[ ] readings индекс: (device_id, timestamp DESC) для GET /devices/:serial/readings
[ ] Ingestion: calibration offset applied, raw payload сохранён
[ ] Ingestion: devices.lastSeenAt, isOnline, last* поля обновлены
[ ] Status: подписка на d/+/s, обработка online/offline
[ ] Offline detection: setInterval проверка lastSeenAt > DEVICE_OFFLINE_TIMEOUT_SEC
[ ] Alert rules: CRUD API
[ ] Alert check: при каждом reading, с cooldown
[ ] Alert callback: HTTP POST на ALERT_CALLBACK_URL, timeout 5s, без retry
[ ] Alert acknowledge: PATCH с acknowledgedBy, 409 при повторном
[ ] Audit log: append-only, все actions из AU2
[ ] API: все endpoints из раздела 9 работают
[ ] Swagger UI доступен на /api/docs
[ ] Decommission: soft delete + full rebuild passwd/ACL + SIGHUP
[ ] Static UI files раздаются Fastify на /
```

### UI

```
[ ] Один экран: таблица устройств
[ ] Для каждого: serial, name, zone, status badge, temp, humidity, battery, last seen
[ ] Unacknowledged alerts — красная строка + кнопка "Подтвердить"
[ ] Acknowledge: prompt имя → PATCH API
[ ] Автообновление каждые 30 секунд
```

### Поставка

```
[ ] deploy/ содержит docker-compose.yml, .env.example, mosquitto.conf, scripts, docs
[ ] deploy/data/mosquitto/passwd и deploy/data/mosquitto/acl поставляются пустыми файлами в артефакте
[ ] .env.example: все обязательные переменные с комментариями, без реальных значений
[ ] install-guide.md: пошаговая инструкция от скачивания до первого датчика
[ ] install-guide.md: явно описывает, что passwd/acl поставляются пустыми и заполняются server через reconcile
[ ] security.md: как устроена авторизация, предупреждение про firewall и P1 exception про docker.sock
[ ] backup-restore.md: конкретные команды pg_dump/pg_restore
[ ] Все Docker images тегированы версией 0.1.0, нигде нет latest
[ ] Simulator работает и генерирует реалистичные данные
[ ] provision-cli: регистрация устройств из CSV файла
```

### Пилот

```
[ ] 3+ клиента согласились тестировать
[ ] У каждого: машина в локальной сети (мини-ПК / NUC / старый ноут / VM)
[ ] Установка от начала до работающего датчика: < 30 минут
[ ] Алерт доходит (callback) за < 60 секунд от превышения порога

```
