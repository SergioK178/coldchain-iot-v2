# Sensor Platform

IoT-платформа мониторинга холодовой цепи. Сбор показаний температуры и влажности с датчиков по MQTT, хранение в TimescaleDB, правила тревог с HTTP-уведомлениями, веб-интерфейс оператора.

**Спецификация:** [MASTER-SPEC.md](docs/MASTER-SPEC.md)
**Итоги реализации P1:** [IMPLEMENTATION-SUMMARY.md](docs/P1/IMPLEMENTATION-SUMMARY.md)

## Документация: P1 vs P2

- [docs/MASTER-SPEC.md](docs/MASTER-SPEC.md) — frozen P1 source of truth
- [docs/P1/EXECUTION-PLAN.md](docs/P1/EXECUTION-PLAN.md) — P1 execution plan
- [docs/api-reference.md](docs/api-reference.md) — unified API reference (P1 + P2 + compatibility)
- [docs/openapi-p1.json](docs/openapi-p1.json) — P1-only OpenAPI baseline
- [docs/P2/openapi-p2.json](docs/P2/openapi-p2.json) — P2-only OpenAPI additions
- [docs/openapi.json](docs/openapi.json) и [openapi-relevant.json](openapi-relevant.json) — combined актуальный OpenAPI (P1 + P2)
- [docs/P2/P2-EVOLUTION.md](docs/P2/P2-EVOLUTION.md) — frozen P2 evolution spec
- [docs/P2/UI-SPEC.md](docs/P2/UI-SPEC.md) — approved UI stack and design baseline for P2
- [docs/P2/F6-DECISION.md](docs/P2/F6-DECISION.md) — статус и план закрытия F6 (без docker.sock)
- [docs/P2/API-CHANGES.md](docs/P2/API-CHANGES.md) — краткая карта API-изменений P2
- [docs/P2/API-REFERENCE.md](docs/P2/API-REFERENCE.md) — P2 API reference
- [docs/P2/P2-CLOSURE-SUMMARY.md](docs/P2/P2-CLOSURE-SUMMARY.md) — статус закрытия P2 и итог выполненных работ

### P2 (реализовано)

- **Auth:** JWT + refresh cookie, роли (admin/operator/viewer), API_TOKEN — deprecated fallback.
- **API:** Auth (`/api/v1/auth/*`), Users, Locations/Zones CRUD, Webhooks, Calibrations.
- **Webhook v2:** HMAC-SHA256, retry, delivery log; legacy ALERT_CALLBACK_URL → авто-создание webhook при старте.
- **UI:** Next.js в `apps/web` (логин, дашборд, устройства, локации, алерты, onboard, настройки). Старый Vite UI (`ui/`) выведен из workspace.
- **Deploy:** в `deploy/.env` обязательно задать `JWT_SECRET`; опционально `ADMIN_EMAIL` и `ADMIN_PASSWORD` для первого admin. Контейнер `web` на порту 3000. Профиль `https` — Caddy.

---

## Структура проекта

```
packages/shared/     — Zod-схемы, типы устройств, константы
packages/db/         — Drizzle ORM, схема БД, миграции, seed
apps/server/         — Fastify (API, MQTT, алерты, provisioning)
apps/web/            — Next.js UI (P2)
tools/simulator/     — MQTT-симулятор датчика
tools/provision-cli/ — CLI для регистрации из CSV
deploy/              — Docker Compose, конфиги
```

---

## Быстрый старт (development)

### Требования

- Node.js 22+
- pnpm 9+
- Docker и Docker Compose v2

### 1. Установить зависимости и собрать

```bash
pnpm install --no-frozen-lockfile   # при первом клоне или после добавления apps/web (Tailwind, shadcn/Radix, recharts, sonner и др.)
pnpm --filter @sensor/db build
pnpm --filter @sensor/server build
pnpm --filter @sensor/web build     # P2 UI (Next.js + Tailwind + shadcn/ui)
```

Или всё сразу:

```bash
pnpm install --no-frozen-lockfile && pnpm -r build
```

### 2. Запустить тесты

```bash
pnpm --filter @sensor/shared test
```

---

## Развёртывание (production / on-premise)

### Требования к серверу

- Docker Engine 24+ и Docker Compose v2
- 1 ГБ RAM (минимум)
- 10 ГБ диск
- Локальная сеть (LAN) между сервером и датчиками

### 1. Подготовить окружение

```bash
cd deploy
cp .env.example .env
```

Заполнить `.env`:

```env
# Обязательные (придумайте надёжные значения):
DB_PASSWORD=ваш_пароль_бд
MQTT_ADMIN_PASSWORD=ваш_пароль_mqtt
API_TOKEN=токен_минимум_32_символа_для_api

# Опциональные (значения по умолчанию):
# HTTP_PORT=8080
# MQTT_PORT=1883
# DEVICE_OFFLINE_TIMEOUT_SEC=300
# ALERT_CALLBACK_URL=http://192.168.1.100:9000/hooks/sensor
```

### 2. Собрать Docker-образ сервера

Из корня репозитория:

```bash
docker build -f apps/server/Dockerfile -t ghcr.io/your-org/sensor-server:0.1.0 .
```

`ghcr.io/your-org/sensor-server:0.1.0` в примере — это шаблон тега. Есть два рабочих варианта:
- локальная сборка (команда выше), после чего `docker compose` использует собранный локально образ;
- pull заранее опубликованного образа из вашего реального GHCR-репозитория (вместо `your-org`).

### 3. Запустить

```bash
cd deploy
docker compose up -d
```

Проверить статус:

```bash
docker compose ps          # все контейнеры healthy
curl http://localhost:8080/api/v1/health
```

Ожидаемый ответ:

```json
{"ok": true, "data": {"version": "0.1.0", "uptime": 42}}
```

Если используется локальный override, запускайте с двумя файлами compose:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

### Что происходит при запуске

1. PostgreSQL + TimescaleDB инициализируются
2. Сервер выполняет Drizzle-миграции (создаёт 9 таблиц + hypertable)
3. Seed: создаётся организация, локация, зона по умолчанию
4. Reconcile: сервер пересобирает `passwd`/`acl` из БД и перезагружает Mosquitto
5. Fastify слушает на порту 8080 (API + UI + Swagger)
6. MQTT-подписка на `d/+/t` (телеметрия) и `d/+/s` (статус)
7. Таймер проверки офлайна — каждые 60 секунд

---

## Регистрация датчиков

### Один датчик через API

```bash
curl -X POST http://localhost:8080/api/v1/devices/provision \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "serial": "SENS-TH-00001",
    "displayName": "Морозилка №1",
    "powerSource": "battery"
  }'
```

Ответ содержит MQTT-credentials (возвращаются один раз):

```json
{
  "ok": true,
  "data": {
    "serial": "SENS-TH-00001",
    "deviceType": "TH",
    "mqtt": {
      "username": "dev_sens_th_00001",
      "password": "a7f3...сгенерированный_пароль",
      "topic": "d/SENS-TH-00001/t",
      "statusTopic": "d/SENS-TH-00001/s"
    }
  }
}
```

### Массовая регистрация из CSV

Подготовить файл `devices.csv`:

```csv
serial,displayName,powerSource,zoneId
SENS-TH-00001,Морозилка №1,battery,
SENS-TH-00002,Морозилка №2,battery,
SENS-TP-00003,Зонд холодильника,wired,
```

Запустить:

```bash
pnpm --filter @sensor/provision-cli provision -- \
  --file devices.csv \
  --api-url http://localhost:8080 \
  --api-token $API_TOKEN \
  --output-file credentials.csv
```

Результат — `credentials.csv` с username/password для каждого датчика.

---

## Запуск симулятора

Если реальных датчиков нет — используйте симулятор:

```bash
pnpm --filter @sensor/simulator simulate -- \
  SENS-TH-00001 dev_sens_th_00001 a7f3...пароль
```

Или через переменные окружения:

```bash
DEVICE_SERIAL=SENS-TH-00001 \
MQTT_URL=mqtt://localhost:1883 \
MQTT_USERNAME=dev_sens_th_00001 \
MQTT_PASSWORD=a7f3...пароль \
INTERVAL_SEC=10 \
pnpm --filter @sensor/simulator simulate
```

Симулятор:
- Публикует телеметрию каждые N секунд (температура, влажность, батарея, RSSI)
- При подключении настраивает LWT и публикует online-статус (`1`)
- При остановке (Ctrl+C) явно публикует статус `0` (offline) и отключается — это **не** LWT, а explicit publish
- Настоящий LWT срабатывает только при аварийном обрыве (kill -9, crash, потеря сети)
- Для теста именно LWT-path используйте не graceful stop, а аварийную остановку процесса симулятора (`kill -9`)

Несколько симуляторов можно запустить параллельно — по одному на каждое зарегистрированное устройство.

---

## Настройка тревог

### Создать правило

```bash
curl -X POST http://localhost:8080/api/v1/devices/SENS-TH-00001/alert-rules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "metric": "temperature_c",
    "operator": "gt",
    "threshold": -15.0,
    "cooldownMinutes": 15
  }'
```

Доступные метрики: `temperature_c`, `humidity_pct` (зависит от типа датчика).
Операторы: `gt`, `lt`, `gte`, `lte`.

### HTTP-callback при тревоге

Если в `.env` задан `ALERT_CALLBACK_URL`, при срабатывании правила сервер отправит POST:

```json
{
  "event": "alert.triggered",
  "triggeredAt": "2025-07-15T14:30:00Z",
  "device": { "serial": "SENS-TH-00001", "displayName": "Морозилка №1" },
  "rule": { "metric": "temperature_c", "operator": "gt", "threshold": -15.0 },
  "reading": { "value": -13.8, "timestamp": "2025-07-15T14:30:00Z" }
}
```

Timeout: 5 секунд, одна попытка, без повторов.

---

## Веб-интерфейс

Открыть: `http://<адрес>:8080`

1. При первом входе — ввести API_TOKEN
2. Отображается таблица всех устройств:
   - Serial, имя, зона
   - Статус: зелёный (норма), серый (офлайн), красный (тревога)
   - Последние значения: температура, влажность, батарея
   - Время последнего показания
3. Неподтверждённые тревоги — кнопка «Подтвердить» (запрашивает имя оператора)
4. Автообновление каждые 30 секунд

---

## API-документация

- **Swagger UI:** `http://<адрес>:8080/api/docs`
- **OpenAPI JSON:** `http://<адрес>:8080/api/docs/json`

### Основные endpoints

| Метод | URL | Описание |
|---|---|---|
| GET | /api/v1/health | Статус сервера (без авторизации) |
| POST | /api/v1/devices/provision | Регистрация датчика |
| GET | /api/v1/devices | Список устройств |
| GET | /api/v1/devices/:serial | Одно устройство |
| PATCH | /api/v1/devices/:serial | Обновить имя/зону/калибровку |
| DELETE | /api/v1/devices/:serial | Вывод из эксплуатации |
| GET | /api/v1/devices/:serial/readings | История показаний |
| POST | /api/v1/devices/:serial/alert-rules | Создать правило тревоги |
| GET | /api/v1/devices/:serial/alert-rules | Правила устройства |
| PATCH | /api/v1/alert-rules/:id | Обновить правило |
| DELETE | /api/v1/alert-rules/:id | Удалить правило |
| GET | /api/v1/alert-events | События тревог |
| PATCH | /api/v1/alert-events/:id/acknowledge | Подтвердить тревогу |
| GET | /api/v1/audit-log | Журнал аудита |

Все endpoints (кроме health) требуют `Authorization: Bearer <API_TOKEN>`.

---

## Тестирование на реальном стенде

### E2E тест (только API, без симуляторов)

```bash
cd deploy
API_TOKEN=ваш_токен ./scripts/e2e-test.sh
```

Проверяет: health, provisioning, list/get/patch, alert rules и capabilities, alert events, readings, audit log, ошибки 401/404/409, decommission, swagger, backup.

Сохранить артефакт прогона:

```bash
mkdir -p ../artifacts/hardening
API_TOKEN=ваш_токен ./scripts/e2e-test.sh | tee ../artifacts/hardening/e2e-test.txt
```

### E2E тест с симуляторами

```bash
cd deploy
API_TOKEN=ваш_токен REPO_ROOT=/path/to/repo ./scripts/e2e-with-simulators.sh
```

Полный цикл: регистрация 3 устройств → запуск симуляторов → проверка online и readings → создание правила → ожидание тревоги → подтверждение → остановка симулятора → проверка offline → вывод из эксплуатации → backup.

Важно: offline-проверка в скрипте ждёт до 60 секунд (polling), чтобы устойчиво покрывать LWT/тайминги на разных стендах.

Сохранить артефакт прогона:

```bash
mkdir -p ../artifacts/hardening
API_TOKEN=ваш_токен REPO_ROOT=/path/to/repo ./scripts/e2e-with-simulators.sh | tee ../artifacts/hardening/e2e-with-simulators.txt
```

### Smoke-нагрузка

```bash
cd deploy
API_TOKEN=ваш_токен REPO_ROOT=/path/to/repo ./scripts/smoke-load.sh
```

10 симуляторов, интервал 10 секунд (60 сообщений/мин), работает 2 минуты. Мониторит health, количество online-устройств, потребление памяти, ошибки в логах.

Все скрипты возвращают exit code 0 при успехе, >0 при ошибках.

---

## Резервное копирование

### Создать бэкап

```bash
cd deploy
./scripts/backup.sh
# → backup_20250715_030000.sql
```

### Восстановить

```bash
cd deploy
./scripts/restore.sh backup_20250715_030000.sql
docker compose restart server   # reconcile восстановит passwd/acl
```

### Автоматизация

```bash
# crontab -e:
0 3 * * * cd /path/to/deploy && ./scripts/backup.sh >> /var/log/sensor-backup.log 2>&1
```

Файлы `data/mosquitto/passwd` и `acl` бэкапить не нужно — сервер восстанавливает их из БД при каждом запуске (reconcile).

---

## Безопасность

- MQTT: per-device аутентификация, ACL (publish-only для устройств), анонимный доступ запрещён
- API: Bearer token на всех endpoints
- Пароли в БД и passwd-файле хранятся в PBKDF2-SHA512
- Docker socket mount (read-only) — временное решение P1 для SIGHUP, замена запланирована в P2

Подробнее: [deploy/docs/security.md](deploy/docs/security.md)

### Ограничения P1 (пилотная эксплуатация)

Данная сборка предназначена для **контролируемого пилота** в изолированной LAN, не для широкого неконтролируемого развёртывания.

- **UI** доступен в LAN без дополнительной авторизации (API-вызовы всё равно требуют Bearer token)
- **Swagger UI** (`/api/docs`) доступен в LAN — осознанный компромисс P1
- **MQTT порт 1883** не должен быть доступен из интернета (MQTT over TLS — P2)
- **Docker socket** mount — временное решение P1 для перезагрузки Mosquitto (замена на Dynamic Security Plugin в P2)
- TLS/HTTPS, ролевая модель пользователей, webhook HMAC — запланированы в P2

---

## Логи и диагностика

```bash
docker compose logs server -f    # логи сервера
docker compose logs mqtt -f      # логи Mosquitto
docker compose logs db -f        # логи PostgreSQL
```

### Частые диагностические сигналы

- `GET /favicon.ico` или `GET /flutter_service_worker.js` может давать `404` — это штатно, если файл отсутствует в `ui/dist`.
- `reply.sendFile is not a function` — нештатная ошибка static plugin; в актуальной версии должна быть устранена.
- Предупреждения Mosquitto про `world readable permissions` / `owner is not mosquitto` для `passwd`/`acl` — признак неверных прав на runtime-файлы. В текущей реализации сервер выставляет права/владельца при reconcile.
- `DEVICE_ALREADY_PROVISIONED` при повторном provision одного `serial` (включая ранее decommissioned) — ожидаемое поведение текущего P1-контракта.

Проверить reconcile:

```bash
cat deploy/data/mosquitto/passwd   # должны быть записи admin + устройства
cat deploy/data/mosquitto/acl      # ACL правила
```

---

## Документация

| Документ | Описание |
|---|---|
| [MASTER-SPEC.md](docs/MASTER-SPEC.md) | Полная спецификация системы |
| [EXECUTION-PLAN.md](docs/P1/EXECUTION-PLAN.md) | План реализации P1 |
| [IMPLEMENTATION-SUMMARY.md](docs/P1/IMPLEMENTATION-SUMMARY.md) | Итоги реализации P1 |
| [install-guide.md](deploy/docs/install-guide.md) | Руководство по установке |
| [security.md](deploy/docs/security.md) | Безопасность |
| [backup-restore.md](deploy/docs/backup-restore.md) | Резервное копирование |
