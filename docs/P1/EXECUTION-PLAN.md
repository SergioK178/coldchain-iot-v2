

# EXECUTION-PLAN.md

## IoT Sensor Platform — P1 Execution Plan

**Привязка:** MASTER-SPEC.md v3.1
**Scope:** Только P1. Ничего за пределами MASTER-SPEC P1 scope.

---

## 1. Критерий успеха P1

P1 считается завершённым, когда:

1. На площадке клиента выполнена команда `docker compose up -d`, все контейнеры healthy
2. Через `provision-cli` или API зарегистрировано ≥1 устройство, MQTT credentials получены
3. Реальный датчик (или simulator) отправляет telemetry, данные появляются в readings
4. Превышение порога генерирует alert event и HTTP callback за <60 секунд
5. Оператор открывает UI по `http://{host}:8080`, видит устройства, статусы, значения
6. Оператор подтверждает тревогу через UI
7. Весь процесс от `docker compose up` до работающего датчика занимает <30 минут

---

## 2. Потоки работ и параллелизация

```
Неделя    1         2         3         4         5
          │         │         │         │         │
FIRMWARE  ████████████████████████████████████─────│ (параллельно, собственный поток)
          │         │         │         │         │
DB/SCHEMA ██████────│─────────│─────────│─────────│
          │    │    │         │         │         │
SERVER    │    ████████████████████──────│─────────│
          │         │         │    │    │         │
MQTT/PROV │    ██████████████─│────│────│─────────│
          │         │         │    │    │         │
ALERT     │─────────│──████████────│────│─────────│
          │         │         │    │    │         │
UI        │─────────│─────────████████──│─────────│
          │         │         │         │         │
DEPLOY    │─────────│─────────│──████████─────────│
          │         │         │         │         │
DOCS/CLI  │─────────│─────────│─────────██████████│
          │         │         │         │         │
INTEG.    │─────────│─────────│─────────│──███████│
```

**Критический путь:** DB/Schema → Server Core (ingestion) → MQTT/Provisioning → Alert → UI → Deploy

**Firmware** идёт параллельно с собственным контрактом (payload schema, LWT, credentials). Точки синхронизации обозначены ниже.

**Плановый резерв:** этапы 6–8 содержат интеграционный резерв 20–30% (упаковка, чистая VM, backup/restore, docs, финальная интеграция). Дата пилота подтверждается после завершения этапа 5.

---

## 3. Spikes (до основной реализации)

Выполняются в первые 2–3 дня, до начала основной работы. Цель — снять технические неопределённости, которые могут заблокировать план.

**Правило для всех spikes:** spike валидирует уже зафиксированное решение из `MASTER-SPEC`. Если spike не проходит, это фиксируется как блокер и эскалируется в change request к `MASTER-SPEC`, без тихой смены решения внутри execution plan.

### Spike 1: Mosquitto password/ACL file mechanics

**Вопрос:** подтвердить что server может записать passwd/acl в bind-mounted volume, сделать atomic rename, отправить SIGHUP через docker.sock, и Mosquitto перечитает файлы без перезапуска.

**Действия:**
1. Docker Compose с Mosquitto + простым Node.js скриптом
2. Скрипт генерирует passwd через `mosquitto_passwd` (или совместимый hash), пишет файл, делает `rename()`
3. Скрипт отправляет SIGHUP через Docker Engine API (`/containers/{id}/kill?signal=SIGHUP`)
4. MQTT-клиент подключается с новыми credentials

**Acceptance:** устройство аутентифицируется после программного обновления passwd без перезапуска Mosquitto.

**Блокирует:** Provisioning (этап 2).

### Spike 2: TimescaleDB hypertable + Drizzle ORM

**Вопрос:** подтвердить что Drizzle миграции + ручной SQL `create_hypertable` + `ON CONFLICT DO NOTHING` на обычной таблице `ingestion_dedup` работают корректно вместе.

**Действия:**
1. Docker Compose с TimescaleDB
2. Drizzle schema с таблицами `readings` и `ingestion_dedup`
3. Миграция + post-migration SQL для hypertable
4. Тест: insert reading, insert duplicate mid — конфликт обрабатывается, insert в readings только при успешном insert в dedup

**Acceptance:** дубли по `(device_id, message_id)` в `ingestion_dedup` отклоняются без ошибки; readings с hypertable корректно вставляются и читаются с индексом `(device_id, timestamp DESC)`.

**Блокирует:** Ingestion (этап 2).

### Spike 3: Mosquitto-compatible password hash в Node.js

**Вопрос:** можно ли генерировать Mosquitto `password_file`-совместимый хеш (`sha512-pbkdf2`) из Node.js без вызова `mosquitto_passwd` binary.

**Действия:**
1. Изучить формат Mosquitto password file (PBKDF2-SHA512, формат `$7$iteration$salt$hash` или `$6$...`)
2. Реализовать генерацию через Node.js `crypto.pbkdf2`
3. Проверить: записать хеш в файл, подключиться MQTT-клиентом с plaintext паролем

**Acceptance:** Node.js генерирует хеш, Mosquitto принимает пароль.

**Блокирует:** Provisioning (этап 2).

---

## 4. Этапы реализации

### Этап 0: Инициализация репозитория

**Длительность:** 1 день
**Зависимости:** нет
**Параллельно с:** Spikes
**Owner:** backend lead
**Output artifact:** каркас monorepo + `deploy/` skeleton, готовый к разработке

#### Задачи

```
[ ] Создать репо sensor-platform
[ ] Инициализировать pnpm workspace (pnpm-workspace.yaml, корневой package.json)
[ ] tsconfig.base.json (strict: true, target: ES2022, module: NodeNext)
[ ] Структура директорий по MASTER-SPEC раздел 12 (пустые package.json в каждом workspace)
[ ] .gitignore (node_modules, dist, data/postgres, .env)
[ ] README.md (ссылка на MASTER-SPEC.md, команды запуска dev)
[ ] MASTER-SPEC.md — копия frozen spec в репо
[ ] deploy/ директория со скелетом (docker-compose.yml, .env.example, config/mosquitto/mosquitto.conf, data/mosquitto/passwd пустой, data/mosquitto/acl пустой)
```

#### Acceptance

**Automated:**
- `pnpm install` проходит
- Workspace packages резолвятся (`pnpm --filter @sensor/shared exec echo ok`)
- `docker compose -f deploy/docker-compose.yml config` валиден (с заполненным .env)

**Manual:**
- Структура каталогов соответствует `MASTER-SPEC` разделу 12

---

### Этап 1: Database schema + shared packages

**Длительность:** 3 дня
**Зависимости:** Этап 0, Spike 2 завершён
**Блокирует:** Этапы 2A, 2B, 3, 4, 5
**Owner:** backend
**Output artifact:** `@sensor/shared`, `@sensor/db`, первая миграция, идемпотентный seed

#### Задачи: @sensor/shared

```
[ ] schemas/payload.ts — DevicePayloadSchema (Zod), export type DevicePayload
[ ] schemas/api.ts — ApiSuccessSchema, ApiErrorSchema (Zod), utility type helpers
[ ] schemas/device.ts — ProvisionRequestSchema, DeviceResponseSchema, PatchDeviceSchema
[ ] schemas/alert.ts — CreateAlertRuleSchema, AlertEventResponseSchema, AcknowledgeSchema
[ ] constants/device-types.ts — DEVICE_TYPES, DeviceTypeCode, parseSerial()
[ ] constants/mqtt.ts — MQTT topic builders
[ ] constants/errors.ts — Error code string enum (DEVICE_NOT_FOUND, VALIDATION_ERROR, etc.)
[ ] index.ts — re-export всё
[ ] Unit tests: parseSerial() валидные/невалидные serials, DevicePayloadSchema валидные/невалидные payloads, capability validation logic
```

#### Задачи: @sensor/db

```
[ ] drizzle.config.ts
[ ] src/schema.ts — все таблицы из MASTER-SPEC раздел 6 (organizations, locations, zones, devices, readings, ingestion_dedup, alert_rules, alert_events, audit_log)
[ ] src/client.ts — Drizzle client factory (принимает DATABASE_URL)
[ ] src/migrate.ts — запуск Drizzle миграций + post-migration SQL: create_hypertable('readings', 'timestamp'), CREATE INDEX readings_device_ts_idx ON readings (device_id, "timestamp" DESC)
[ ] src/seed.ts — создание default org/location/zone если не существуют (идемпотентно)
[ ] Сгенерировать первую миграцию через drizzle-kit generate
[ ] Тест: migrate + seed на чистой TimescaleDB → таблицы созданы, hypertable работает, seed идемпотентен
```

#### Acceptance

**Automated:**
- `@sensor/shared` импортируется из других workspace packages, типы выводятся
- `parseSerial("SENS-TH-00042")` возвращает `{ type: "TH", number: "00042" }`
- `parseSerial("INVALID")` бросает ошибку
- `DevicePayloadSchema.parse(validPayload)` проходит
- `DevicePayloadSchema.parse(invalidPayload)` бросает ZodError
- На чистой TimescaleDB: миграции проходят, seed создаёт 3 записи, повторный seed не дублирует
- `INSERT INTO ingestion_dedup ... ON CONFLICT DO NOTHING` работает корректно
- Readings вставляются в hypertable, индекс `(device_id, timestamp DESC)` существует

**Manual:**
- Проверка структуры generated SQL и соответствия таблиц `MASTER-SPEC` разделу 6

---

### Этап 2A: Server skeleton + boot path

**Длительность:** 2 дня
**Зависимости:** Этап 1, Spikes завершены
**Блокирует:** Этап 2B
**Owner:** backend
**Output artifact:** поднимающийся Fastify server с auth/swagger/audit/migrate/seed/reconcile boot path

#### Задачи

```
[ ] apps/server/src/config.ts — env validation (Zod), crash on invalid env
[ ] apps/server/src/app.ts + src/index.ts — startup: migrate, seed, reconcile, listen
[ ] plugins/auth.ts — Bearer API_TOKEN (health без auth)
[ ] plugins/swagger.ts — /api/docs
[ ] routes/health.ts — GET /api/v1/health
[ ] services/audit.ts + routes/audit.ts — AU1–AU4 (append/query only)
[ ] Dockerfile base runtime/build path for @sensor/server
```

#### Acceptance

**Automated:**
- Server стартует, выполняет migrate+seed+startup reconcile
- `/api/v1/health` и `/api/docs` доступны
- `audit.append()` единственная мутирующая операция в сервисе аудита

**Manual:**
- Swagger отражает базовые endpoints
- Логи старта не содержат ошибок инициализации

---

### Этап 2B: MQTT + provisioning + ingestion + readings

**Длительность:** 3 дня
**Зависимости:** Этап 2A
**Блокирует:** Этапы 3, 4, 5
**Owner:** backend
**Output artifact:** рабочий e2e контур `provision → mqtt auth → ingestion → readings/status → decommission`

**Контрольные точки внутри этапа:**
- `Checkpoint 2B.1`: provision + full rebuild + reload + MQTT auth работают стабильно.
- `Checkpoint 2B.2`: ingestion + status + readings API + decommission + recovery test работают стабильно.

#### Задачи

```
[ ] lib/mosquitto-files.ts — генерация passwd/acl + writeAtomically (tmp в той же директории, rename внутри одного mounted directory)
[ ] lib/mosquitto-reload.ts — SIGHUP через docker.sock
[ ] services/provision.ts — реализует P1–P12 (включая reconcile до conflict-check и rebuild после mutating операций)
[ ] routes/devices.ts — provision/list/get/patch/delete
[ ] plugins/mqtt.ts — подписка d/+/t и d/+/s
[ ] services/ingestion.ts — реализует I1–I9
[ ] services/device.ts — status handling + offline check
[ ] routes/readings.ts — GET /devices/:serial/readings
[ ] offline timer в index.ts (60s) + graceful shutdown
[ ] Recovery test: искусственный сбой после БД-изменения и до успешного rebuild/reload для provision и decommission
```

#### Acceptance

**Automated:**
- `POST /provision` создаёт device, rebuild/reload успешен, MQTT auth работает
- dedup по `ingestion_dedup (device_id,message_id)` отсекает дубликаты без ошибки
- неизвестный serial / missing capability → audit (`device.unknown_message`, `payload.missing_capability`)
- `DELETE /devices/:serial` деактивирует устройство и перестраивает passwd/acl
- simulated partial failure после записи в БД возвращает 500; следующий startup reconcile или следующий mutating call выравнивает состояние

**Manual:**
- ACL reject для publish в чужой topic
- offline переход (LWT/timeout) виден в API
- `GET /api/v1/audit-log` отражает ключевые события (provision/decommission/ingestion rejects)

---

### Этап 3: Alerting

**Длительность:** 3 дня
**Зависимости:** Этап 2B (ingestion работает)
**Блокирует:** Этап 5 (UI показывает alert status)
**Owner:** backend
**Output artifact:** alert rules/events/callback/acknowledge + audit actions

#### Задачи

```
[ ] services/alert.ts:
    - checkAlertRules(deviceId: string, reading: { temperatureC?, humidityPct?, timestamp }): Promise<void>
      1. SELECT alert_rules WHERE device_id AND is_active
      2. Для каждого правила:
         a. Извлечь значение по metric
         b. Сравнить по operator
         c. Проверить cooldown (lastTriggeredAt + cooldownMinutes > now → skip)
         d. Если triggered: INSERT alert_event, UPDATE alert_rule lastTriggeredAt
         e. Audit: alert.triggered
         f. Если ALERT_CALLBACK_URL задан: вызвать sendCallback()
    - sendCallback(alertEvent, device, rule, reading): Promise<void>
      1. HTTP POST, timeout 5s
      2. Записать callbackAttempted=true, callbackResponseCode в alert_event
      3. Если network error/timeout: callbackAttempted=false, callbackResponseCode=null
[ ] lib/callback.ts:
    - httpPost(url: string, body: object, timeoutMs: number): Promise<{ statusCode: number } | null>
    - Используем native fetch (Node 22) с AbortSignal.timeout(5000)
[ ] routes/alert-rules.ts:
    - POST /api/v1/devices/:serial/alert-rules — validate metric vs device capabilities
    - GET /api/v1/devices/:serial/alert-rules
    - PATCH /api/v1/alert-rules/:id
    - DELETE /api/v1/alert-rules/:id
    - Audit: alert_rule.created, alert_rule.updated, alert_rule.deleted
[ ] routes/alert-events.ts:
    - GET /api/v1/alert-events — filters: deviceSerial, acknowledged, since, limit
    - PATCH /api/v1/alert-events/:id/acknowledge — acknowledgedBy required, 409 if already
    - Audit: alert.acknowledged
[ ] Интеграция: в services/ingestion.ts после записи reading → вызов checkAlertRules()
```

#### Acceptance

**Automated:**
- Rule trigger/cooldown сценарии работают (event create / no create / create after cooldown)
- Callback сценарии корректно пишут `callbackAttempted` и `callbackResponseCode`
- `PATCH /acknowledge` работает, повторный acknowledge = 409
- Валидация metric vs capabilities блокирует недопустимые правила

**Manual:**
- Проверка payload callback через локальный test endpoint
- В Swagger корректно документированы alert endpoints

---

### Этап 4: Simulator + Provision CLI

**Длительность:** 2 дня
**Зависимости:** Этап 2B (provisioning + ingestion работают)
**Параллельно с:** Этап 3
**Owner:** tooling/backend
**Output artifact:** рабочие `tools/simulator` и `tools/provision-cli`

#### Задачи: Simulator

```
[ ] tools/simulator/src/index.ts:
    - CLI args или env: DEVICE_SERIAL, MQTT_URL, MQTT_USERNAME, MQTT_PASSWORD, INTERVAL_SEC (default 60)
    - Подключение к MQTT с credentials
    - LWT: topic d/{serial}/s, payload "0", retain true, QoS 1
    - При connect: publish "1" в d/{serial}/s (retain, QoS 1)
    - Каждые INTERVAL_SEC: publish payload в d/{serial}/t:
      - v: 1, id: serial, ts: unix now, mid: monotonic counter
      - t: base temp ± random jitter (configurable base, e.g. -18 ± 3)
      - h: base humidity ± jitter (e.g. 45 ± 10), если тип TH/HM
      - bat: slowly decreasing from 100
      - rssi: -40 to -90 random
      - fw: "0.1.0"
    - Graceful shutdown: disconnect (triggers LWT)
[ ] package.json: script "simulate" → tsx src/index.ts
```

#### Задачи: Provision CLI

```
[ ] tools/provision-cli/src/index.ts:
    - CLI: принимает --file (CSV) и --api-url, --api-token
    - CSV формат: serial,displayName,powerSource,zoneId (zoneId optional)
    - Для каждой строки: POST /api/v1/devices/provision
    - Выводит результат: serial, mqtt_username, mqtt_password (или ошибку)
    - Опционально: --output-file для сохранения credentials в файл
[ ] package.json: script "provision" → tsx src/index.ts
```

#### Acceptance

**Automated:**
- `simulate` публикует telemetry по контракту schema/topic
- `provision-cli` обрабатывает CSV batch и корректно репортит ошибки по строкам

**Manual:**
- Остановка simulator переводит устройство в offline
- CSV на 5 устройств даёт ожидаемый итоговый отчёт

---

### Этап 5: UI

**Длительность:** 3 дня
**Зависимости:** Этап 2B (API devices), Этап 3 (API alert-events)
**Блокирует:** Этап 6 (deploy package включает собранный UI)
**Owner:** frontend
**Output artifact:** `ui/dist`, один экран P1, acknowledge flow, token gate

#### Задачи

```
[ ] ui/package.json: vite, react, typescript (exact versions per MASTER-SPEC)
[ ] ui/vite.config.ts: build output → dist/
[ ] ui/src/lib/api.ts:
    - fetchDevices(): Promise<Device[]> — GET /api/v1/devices
    - fetchUnacknowledgedAlerts(): Promise<AlertEvent[]> — GET /api/v1/alert-events?acknowledged=false
    - acknowledgeAlert(id: string, acknowledgedBy: string): Promise<void> — PATCH /api/v1/alert-events/:id/acknowledge
    - API_BASE_URL из window.location.origin + /api/v1 (same origin, раздаётся тем же Fastify)
    - API token берётся из sessionStorage (ключ `apiToken`)
[ ] ui/src/App.tsx:
    - При mount: если нет token в sessionStorage → показать token gate (prompt/modal)
    - После ввода token: сохранить в sessionStorage, выполнить initial fetch
    - setInterval 30 секунд: refetch
    - Рендер таблицы
[ ] ui/src/components/DeviceRow.tsx:
    - Serial, displayName, zoneName
    - StatusBadge (цвет по правилу из MASTER-SPEC раздел 10: alert → red, offline → gray, else → green)
    - Последние значения: temperatureC (°C), humidityPct (%), batteryPct (%)
    - lastSeenAt → relative time ("2 мин назад")
[ ] ui/src/components/StatusBadge.tsx:
    - Props: connectivityStatus, alertStatus
    - Цвет: alertStatus === "alert" → red, connectivityStatus === "offline" → gray, else → green
    - Текст: "Тревога" / "Офлайн" / "Норма"
[ ] ui/src/components/AcknowledgeButton.tsx:
    - Кнопка "Подтвердить"
    - По клику: prompt("Имя оператора") → если непустое → acknowledgeAlert()
    - После успеха: refetch
    - Показывается только для alert events привязанных к устройству в той же строке
[ ] Fastify static plugin:
    - plugins/static.ts — @fastify/static, serve ui/dist/ на /
    - Build step в Dockerfile: build UI → copy dist → Fastify serves
```

#### Acceptance

**Automated:**
- `pnpm --filter ui build` собирает dist
- API client добавляет Bearer token из `sessionStorage`

**Manual:**
- Без token UI не выполняет API-вызовы и показывает gate
- Неверный token (401) приводит к очистке `sessionStorage` и возврату в token gate
- После ввода token отображается таблица устройств
- Статусы/acknowledge/автообновление работают по P1 правилам

---

### Этап 6: Deploy package

**Длительность:** 2 дня
**Зависимости:** Этапы 2B, 3, 5 завершены
**Owner:** backend/devops
**Output artifact:** готовый `deploy/` пакет для on-prem запуска

#### Задачи

```
[ ] apps/server/Dockerfile — финализация:
    - FROM node:22.x-alpine AS builder
    - COPY, pnpm install --frozen-lockfile, build @sensor/shared, @sensor/db, @sensor/server
    - Build UI (pnpm --filter ui build), copy dist
    - FROM node:22.x-alpine AS runner
    - Copy built artifacts + node_modules (production only)
    - EXPOSE 8080
    - CMD ["node", "apps/server/dist/index.js"]
[ ] docker-compose.yml (deploy/) — финализация из MASTER-SPEC раздел 11:
    - Pinned image versions (timescale:2.17.2-pg16, mosquitto:2.0.20, server:0.1.0)
    - Все bind mounts корректны (в т.ч. directory bind mount `./data/mosquitto` для mqtt и server, не file-to-file mounts для passwd/acl)
    - docker.sock mount read-only
    - Healthchecks
[ ] .env.example — финальная версия из MASTER-SPEC
[ ] config/mosquitto/mosquitto.conf — из MASTER-SPEC, paths соответствуют bind mounts
[ ] data/mosquitto/passwd — пустой файл (touch)
[ ] data/mosquitto/acl — пустой файл (touch)
[ ] scripts/backup.sh:
    - docker compose exec db pg_dump -U ${DB_USER:-sensors} ${DB_NAME:-sensors} > backup_$(date +%Y%m%d_%H%M%S).sql
    - echo "Backup saved to ..."
[ ] scripts/restore.sh:
    - Принимает файл как аргумент
    - docker compose exec -T db psql -U ${DB_USER:-sensors} ${DB_NAME:-sensors} < $1
[ ] Build и tag Docker image: ghcr.io/your-org/sensor-server:0.1.0
[ ] Тест полного цикла на чистой машине:
    1. Скопировать deploy/ на чистую VM
    2. cp .env.example .env, заполнить
    3. docker compose up -d
    4. curl health
    5. Provision device через curl
    6. Запустить simulator
    7. Проверить readings, alerts, UI
```

#### Acceptance

**Automated:**
- `docker compose config` валиден
- pinned versions без `latest`
- `backup.sh` создаёт SQL, `restore.sh` восстанавливает

**Manual:**
- Чистая VM: `docker compose up -d` → healthy
- e2e с provision+simulator+UI проходит
- restore проверяется на bind-mounted `./data` (чистая директория данных/новая VM), без сценариев с named volumes

---

### Этап 7: Документация

**Длительность:** 2 дня
**Зависимости:** Этапы 5, 6 завершены
**Параллельно с:** финальная интеграция
**Owner:** backend/docs
**Output artifact:** install/security/backup docs + OpenAPI export

#### Задачи

```
[ ] deploy/docs/install-guide.md:
    - Требования (Docker, Docker Compose, 1GB RAM, 10GB disk, LAN)
    - Пошагово: скачать, настроить .env, docker compose up
    - Проверка: curl health
    - Регистрация первого датчика (curl пример с provision)
    - Объяснение: passwd и acl поставляются пустыми, заполняются server автоматически через reconcile
    - Прошивка credentials в датчик (ссылка на firmware docs)
    - Открытие UI
    - Настройка alert rule (curl пример)
    - Настройка callback URL
[ ] deploy/docs/security.md:
    - MQTT: per-device auth, ACL, no anonymous
    - API: bearer token
    - Предупреждение: MQTT порт 1883 не должен быть доступен из интернета. Настройте firewall
    - P1 exception: docker.sock mount для SIGHUP. Описание риска, почему временно допустимо, план замены в P2
    - Рекомендация: сменить пароли при продуктивной эксплуатации
    - Troubleshooting секция для provisioning/reconcile path:
      - где смотреть логи server/mosquitto
      - как проверить, что reconcile отработал
      - что делать, если SIGHUP не применился в окружении клиента
[ ] deploy/docs/backup-restore.md:
    - Конкретные команды pg_dump/pg_restore
    - Что бэкапить: ./data/postgres/ (или pg_dump), ./data/mosquitto/ (не критично — восстанавливается reconcile)
    - Рекомендация: автоматизировать cron
[ ] Swagger UI: проверить что все endpoints документированы, descriptions корректны
[ ] API reference: экспорт OpenAPI JSON на /api/docs/json, сохранить в docs/ (для тех кто хочет curl-примеры без запущенного сервера)
```

#### Acceptance

**Automated:**
- OpenAPI JSON экспортируется и актуален

**Manual:**
- Человек без контекста проекта устанавливает систему по install-guide
- Security/backup секции проверены на рабочем стенде

---

### Этап 8: Интеграция и финальная проверка

**Длительность:** 3 дня
**Зависимости:** Все предыдущие этапы завершены
**Owner:** backend + firmware
**Output artifact:** подтверждённый E2E сценарий для пилота

#### Задачи: Интеграция с реальным firmware (если готов)

```
[ ] Firmware team предоставляет датчик с прошивкой, поддерживающей DevicePayloadSchema
[ ] Provision реального датчика через API
[ ] Прошить MQTT credentials в датчик
[ ] Датчик подключается к Mosquitto, отправляет telemetry
[ ] Readings появляются в API и UI
[ ] Отключение датчика → offline через LWT (и/или timeout)
[ ] Подключение обратно → online
```

Если firmware не готов — интеграция проводится через simulator. Это не блокирует выход на пилот (simulator заменяет датчик для демо).

#### Задачи: End-to-end тест (с simulator)

```
[ ] Чистая машина (VM или отдельный хост)
[ ] Копируем deploy/, заполняем .env
[ ] docker compose up -d
[ ] provision-cli: регистрируем 3 устройства из CSV
[ ] Запускаем 3 экземпляра simulator с разными serial/credentials
[ ] Проверяем:
    - GET /devices — 3 устройства, все online
    - GET /devices/:serial/readings — readings приходят
    - UI: 3 устройства, зелёные, значения обновляются
[ ] Создаём alert rule: temperature_c gt -15 для одного устройства
[ ] Изменяем simulator: t = -14 (превышение)
[ ] Проверяем:
    - alert_event создан
    - Если ALERT_CALLBACK_URL задан — callback отправлен
    - UI: устройство красное
[ ] Acknowledge через UI
[ ] Проверяем: UI — устройство зелёное, audit log содержит запись
[ ] Останавливаем один simulator
[ ] Проверяем: через ≤5 минут устройство offline в API и UI (серое)
[ ] Decommission одного устройства через API
[ ] Проверяем: устройство не в списке, MQTT credentials отклонены
[ ] backup.sh → restore.sh → данные на месте
```

#### Задачи: Нагрузочная проверка (smoke)

```
[ ] 10 simulators, интервал 10 секунд (6 сообщений/мин каждый = 60 msg/min total)
[ ] Проверить: сервер обрабатывает без ошибок, memory не растёт линейно, UI отвечает
[ ] Это не performance benchmark и не capacity claim; только smoke-проверка устойчивости базового контура при минимальной параллельности
```

#### Acceptance

**Automated:**
- Smoke-нагрузка (10 simulators) без падений server/mqtt

**Manual:**
- Полный E2E сценарий проходит
- Checklist из MASTER-SPEC раздела 14 закрыт
- Логи server/mosquitto без критических ошибок

---

## 5. Контрольные точки синхронизации с firmware

| Момент | Что нужно от firmware | Что нужно от server/platform | Блокирует |
|---|---|---|---|
| Spike phase (день 1–3) | Ничего | Spikes завершены | Этап 2 |
| Конец этапа 2B | Serial number scheme финализирован. Подтверждение что payload format из MASTER-SPEC реализуем на ESP32/nRF | Provisioning API работает, simulator работает | Этап 8 (интеграция) |
| Конец этапа 4 | Firmware может принять MQTT credentials (username/password) и подключиться. LWT настроен. Payload соответствует DevicePayloadSchema | Simulator полностью имитирует firmware | Этап 8 |
| Этап 8 | Прошитый датчик с credentials готов к тесту | Всё готово | Пилот |

**Если firmware не готов к этапу 8:** пилот проводится с simulator. Это допустимо для демонстрации платформы. Интеграция с реальным железом — при первой возможности, не блокирует checklist.

---

## 6. Технические риски

| # | Риск | Вероятность | Влияние | Митигация | Признак эскалации |
|---|---|---|---|---|---|
| R1 | Mosquitto не перечитывает passwd/acl по SIGHUP корректно | Низкая | Высокое (provisioning сломан) | Spike 1 до основной реализации | SIGHUP подтверждённо не приводит к применению новых credentials |
| R2 | Node.js не может генерировать Mosquitto-compatible hash | Средняя | Высокое | Spike 3 до реализации provisioning | Невозможно получить валидный hash-формат для password_file без отклонения от spec |
| R3 | TimescaleDB hypertable конфликтует с Drizzle миграциями | Низкая | Среднее | Spike 2, hypertable через post-migration SQL | Миграции нестабильны или неидемпотентны на чистой БД |
| R4 | docker.sock mount не работает в некоторых Docker setups (rootless, Podman) | Средняя | Среднее | Явно документировать системные ограничения P1 | Невозможно отправить SIGHUP в целевом окружении клиента |
| R5 | Firmware не готов к этапу 8 | Средняя | Низкое (для платформы) | Simulator покрывает E2E поток | К моменту пилота нет ни одного устройства с поддержкой payload/LWT контракта |
| R6 | Клиентская машина имеет <1GB RAM или старый Docker | Низкая | Среднее | Документировать минимальные требования, прогнать на минимальной VM | На минимальной конфигурации система не держит базовый e2e |

---

## 7. Definition of Done по этапам (сводка)

| Этап | Done когда |
|---|---|
| 0. Repo init | pnpm install ok, docker compose config ok |
| 1. DB/Shared | Миграции проходят, seed идемпотентен, hypertable работает, shared types экспортируются |
| 2A. Server skeleton | Server стабильно стартует: migrate/seed/reconcile/auth/swagger/audit |
| 2B. Core flow | Provision→MQTT auth→ingestion→dedup→readings→offline→decommission + recovery test partial failure |
| 3. Alerting | Rule→threshold→event→callback→acknowledge — полный цикл |
| 4. Simulator/CLI | Simulator генерирует данные, provision-cli регистрирует из CSV |
| 5. UI | Один экран, token gate, статусы и acknowledge работают |
| 6. Deploy | Чистая машина: docker compose up → всё работает, backup/restore на bind-mounted data работает |
| 7. Docs | install-guide, security, backup-restore написаны и проверены |
| 8. Integration | E2E сценарий проходит, MASTER-SPEC checklist выполнен |

---

## 8. Финальный checklist выхода на пилот

Полностью соответствует MASTER-SPEC.md раздел 14. Каждый пункт ниже — GitHub Issue или подзадача.

### Firmware
```
[ ] Payload по DevicePayloadSchema
[ ] Per-device MQTT credentials
[ ] LWT: d/{serial}/s, payload "0", retain true, QoS 1
[ ] Online publish: "1" в d/{serial}/s, retain true, QoS 1
[ ] Уникальный mid
[ ] Wi-Fi настройка для пилота
```

### Server
```
[ ] docker compose up → healthy
[ ] Миграции при старте
[ ] Seed org/location/zone
[ ] Mosquitto no-anonymous + passwd + ACL
[ ] Provision API + full rebuild + SIGHUP
[ ] Startup reconcile
[ ] Recovery scenario: partial failure after DB change returns 500 and is repaired by reconcile
[ ] Ingestion: subscribe, parse, validate schema
[ ] Ingestion: reject unknown devices + audit
[ ] Ingestion: capability validation
[ ] Ingestion: dedup via ingestion_dedup
[ ] Ingestion: readings index (device_id, timestamp DESC)
[ ] Ingestion: calibration offset, raw payload saved
[ ] Ingestion: update device last* fields
[ ] Status: d/+/s subscribe, online/offline
[ ] Offline detection: setInterval 60s
[ ] Alert rules CRUD + audit
[ ] Alert check on every reading + cooldown
[ ] Alert callback HTTP POST, 5s timeout, no retry
[ ] Alert acknowledge + 409
[ ] Audit log append-only, all AU2 actions
[ ] All API endpoints working
[ ] Swagger UI on /api/docs
[ ] Decommission + rebuild + SIGHUP
[ ] Static UI served on /
```

### UI
```
[ ] Один экран: таблица устройств
[ ] Token gate: ручной ввод API token, хранение в sessionStorage
[ ] Каждое: serial, name, zone, status, temp, humidity, battery, last seen
[ ] Unacknowledged alerts: красная строка + кнопка
[ ] Acknowledge: prompt → PATCH
[ ] Автообновление 30с
```

### Поставка
```
[ ] deploy/ полный комплект
[ ] passwd/acl пустые в артефакте
[ ] .env.example с комментариями
[ ] install-guide.md
[ ] security.md с предупреждениями
[ ] backup-restore.md
[ ] Docker images tagged 0.1.0
[ ] Simulator работает
[ ] provision-cli работает
```

### Пилот
```
[ ] 3+ клиента
[ ] Машина в LAN у каждого
[ ] Установка <30 мин
[ ] Alert <60 сек
```
