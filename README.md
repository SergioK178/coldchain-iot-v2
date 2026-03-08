# Sensor Platform

IoT-платформа мониторинга холодовой цепи. Сбор показаний температуры и влажности с датчиков по MQTT, хранение в TimescaleDB, правила тревог с webhook- и Telegram-уведомлениями, веб-интерфейс оператора на Next.js (RU/EN).

**P2 Spec:** [P2-EVOLUTION.md](docs/P2/P2-EVOLUTION.md)  
**P2 Status:** [P2-ACCEPTANCE.md](docs/P2-release-gate/P2-ACCEPTANCE.md)

## Документация

**Навигация по всей документации:** [docs/README.md](docs/README.md)

Кратко:
| Документ | Описание |
|----------|----------|
| [docs/README.md](docs/README.md) | **Единая навигация** — ссылки на все документы |
| [deploy/docs/install-guide.md](deploy/docs/install-guide.md) | Установка |
| [docs/api-reference.md](docs/api-reference.md) | API |
| [docs/P2-release-gate/P2-ACCEPTANCE.md](docs/P2-release-gate/P2-ACCEPTANCE.md) | P2 status |
| [docs/sensor/MASTER-SPEC.md](docs/sensor/MASTER-SPEC.md) | Спецификация для прошивки |

---

## Архитектура (P2)

**Single-tenant per instance.** Один docker compose up = одна организация = один клиент.

```
Browser → :3000 (Next.js web)
                ↓ server-side proxy
              :8080 (Fastify API)
                ↓
        PostgreSQL + TimescaleDB
                ↓
        Mosquitto MQTT broker
```

**Два профиля поставки одного codebase:**

| Профиль | Описание |
|---|---|
| **Single-tenant On-Prem** | Основной профиль для enterprise. `docker compose up` в LAN клиента. |
| **Managed Cloud Single-tenant** | Отдельный инстанс под клиента в облаке. Не multi-tenant SaaS. |

Multi-tenant, hybrid edge/cloud, billing — **out of scope P2**.

---

## Структура проекта

```
packages/shared/     — Zod-схемы, типы устройств, константы
packages/db/         — Drizzle ORM, схема БД, миграции
apps/server/         — Fastify (API, MQTT, алерты, provisioning, webhooks)
apps/web/            — Next.js UI (P2)
tools/simulator/     — MQTT-симулятор датчика
tools/provision-cli/ — CLI для регистрации из CSV
deploy/              — Docker Compose, конфиги, скрипты
```

---

## Быстрый старт (development)

### Требования

- Node.js 22+
- pnpm 9+
- Docker и Docker Compose v2

### 1. Установить зависимости

```bash
pnpm install --no-frozen-lockfile
pnpm --filter @sensor/db build
pnpm --filter @sensor/server build
pnpm --filter @sensor/web build
```

Или всё сразу:

```bash
pnpm install --no-frozen-lockfile && pnpm -r build
```

### 2. Запустить тесты

```bash
pnpm --filter @sensor/shared test
pnpm --filter @sensor/server test
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
# Обязательные:
DB_PASSWORD=ваш_пароль_бд
MQTT_ADMIN_PASSWORD=ваш_пароль_mqtt
JWT_SECRET=случайная_строка_минимум_64_символа
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ваш_пароль_администратора
MOSQUITTO_RELOAD_URL=http://mqtt:9080/reload

# Опциональные:
# WEB_PORT=3000
# HTTP_PORT=8080
# MQTT_PORT=1883
# DEVICE_OFFLINE_TIMEOUT_SEC=300
# TELEGRAM_BOT_TOKEN=...
```

### 2. Собрать Docker-образы

```bash
docker build -f apps/server/Dockerfile -t ghcr.io/your-org/sensor-server:0.2.0 .
docker build -f apps/web/Dockerfile -t ghcr.io/your-org/sensor-web:0.2.0 .
```

### 3. Запустить

```bash
cd deploy
docker compose up -d
```

Команды `docker compose` выполняйте из `deploy/` (или из корня с symlink `ln -sf deploy/.env .env`). Подробнее: [install-guide.md](deploy/docs/install-guide.md#3-запустить).

Проверить статус:

```bash
docker compose ps
curl http://localhost:8080/api/v1/health
```

### Опционально: HTTPS через Caddy

```bash
cd deploy
DOMAIN=myplatform.example.com docker compose --profile https up -d
```

Caddyfile в `config/caddy/Caddyfile` проксирует `/api/*` → Fastify, остальное → Next.js.

### Что происходит при запуске

1. PostgreSQL + TimescaleDB инициализируются
2. Сервер выполняет Drizzle-миграции (таблицы P1 + P2: users, refresh_tokens, webhooks и др.)
3. Seed: создаётся организация, локация, зона по умолчанию
4. Admin seed: если `users` пуста и `ADMIN_EMAIL`+`ADMIN_PASSWORD` заданы → создаётся admin-пользователь
5. Reconcile MQTT-auth: сервер вызывает `MOSQUITTO_RELOAD_URL` (auth-sync sidecar) для синхронизации `passwd`/`acl`
6. Fastify слушает на порту 8080 (API)
7. Next.js слушает на порту 3000 (UI)
8. MQTT-подписка на `d/+/t` (телеметрия) и `d/+/s` (статус)
9. Таймер проверки офлайна — каждые 60 секунд
10. Webhook retry loop — polling каждые 10 секунд

---

## Аутентификация

P2 использует JWT + refresh cookie. Вход только через email/пароль.

**Войти через UI:** открыть `http://localhost:3000`, ввести email/пароль администратора.

**API через curl:**

```bash
# Получить JWT токен
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"ваш_пароль"}' | jq -r '.data.accessToken')

# Использовать токен
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/devices
```

**Роли:**

| Действие | admin | operator | viewer |
|---|---|---|---|
| Управление пользователями | ✓ | – | – |
| Provision / decommission устройств | ✓ | – | – |
| Управление локациями / зонами | ✓ | – | – |
| Настройка webhooks | ✓ | – | – |
| Создание/редактирование правил тревог (UI + API) | ✓ | ✓ | – |
| Подтверждение тревог | ✓ | ✓ | – |
| Просмотр устройств, показаний, тревог, аудита | ✓ | ✓ | ✓ |

---

## Регистрация датчиков

### Через UI (F8a — рекомендуется)

Открыть `http://localhost:3000/onboard`.

Guided flow (5 шагов):
1. **Заявить** — ввести серийный номер или отсканировать QR с датчика
2. **Назначить** — выбрать локацию и зону

**Формат QR для наклейки:** plain `SENS-TH-00001`, JSON `{"serial":"...","displayName":"..."}` или compact `{"s":"...","n":"..."}`. Подробнее: [hardware-provisioning.md](deploy/docs/hardware-provisioning.md#qr-code-payload-format-для-наклейки-на-датчик).
3. **Выдать** — скопировать MQTT-credentials (показываются один раз)
4. **Активировать** — настроить прошивку датчика
5. **Проверить** — убедиться, что устройство подключилось

### Один датчик через API

```bash
curl -X POST http://localhost:8080/api/v1/devices/provision \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
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
      "password": "сгенерированный_пароль",
      "topic": "d/SENS-TH-00001/t",
      "statusTopic": "d/SENS-TH-00001/s"
    }
  }
}
```

### Массовая регистрация из CSV

Сначала получите JWT токен (см. раздел «Аутентификация»), затем:

```bash
pnpm --filter @sensor/provision-cli provision -- \
  --file devices.csv \
  --api-url http://localhost:8080 \
  --api-token "$TOKEN" \
  --output-file credentials.csv
```

---

## Запуск симулятора

```bash
pnpm --filter @sensor/simulator simulate -- \
  SENS-TH-00001 dev_sens_th_00001 сгенерированный_пароль
```

Симулятор публикует телеметрию каждые N секунд (температура, влажность, батарея, RSSI), настраивает LWT и публикует online/offline статус.

---

## Webhooks (v2)

Webhook v2 поддерживает retry (до 5 попыток, backoff: 10s→30s→2m→10m→30m) и HMAC-SHA256 подпись.

**Заголовок подписи:** `X-Signature-256: sha256=<hex(HMAC-SHA256(body, secret))>`

**Создать webhook через API:**

```bash
curl -X POST http://localhost:8080/api/v1/webhooks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://myserver.example.com/hooks/sensor",
    "events": ["alert.triggered", "device.offline"]
  }'
```

**События:** `alert.triggered`, `alert.acknowledged`, `device.online`, `device.offline`, `device.provisioned`, `device.decommissioned`.

Управление webhooks — через UI: `http://localhost:3000/settings`.

---

## Telegram-уведомления о тревогах

Помимо webhooks, при срабатывании правил тревоги система может отправлять сообщения в Telegram пользователям с привязанным аккаунтом.

**Настройка:**
1. Создайте бота через [@BotFather](https://t.me/BotFather), получите токен.
2. Добавьте в `.env`: `TELEGRAM_BOT_TOKEN=...`
3. Перезапустите server: `docker compose up -d server`
4. В UI: **Настройки → Telegram** — сгенерируйте код и отправьте его боту.

Подробнее: [deploy/docs/install-guide.md](deploy/docs/install-guide.md#telegram-уведомления-о-тревогах).

---

## Веб-интерфейс

Открыть: `http://localhost:3000`

Страницы:
- `/login` — вход (email + пароль)
- `/` — дашборд: локации → зоны → устройства
- `/devices` — список устройств (фильтры по статусу, тревоге, локации)
- `/devices/[serial]` — карточка устройства: показания, график (Recharts), калибровки, правила тревог
- `/locations` — управление локациями и зонами (CRUD)
- `/alerts` — события тревог, подтверждение
- `/settings` — пользователи (admin), webhooks
- `/settings/telegram` — привязка Telegram-уведомлений
- `/onboard` — регистрация устройства (5-шаговый guided flow)
- `/export` — экспорт данных (CSV, PDF)

---

## API-документация

- **Swagger UI:** `http://localhost:8080/api/docs`
- **OpenAPI JSON:** `http://localhost:8080/api/docs/json`

### Основные endpoints

| Метод | URL | Описание | Роль |
|---|---|---|---|
| GET | /api/v1/health | Статус сервера | — |
| POST | /api/v1/auth/login | Вход | — |
| POST | /api/v1/auth/refresh | Обновить токен | — |
| POST | /api/v1/auth/logout | Выход | — |
| GET | /api/v1/users/me | Текущий пользователь | any |
| GET | /api/v1/users | Список пользователей | admin |
| POST | /api/v1/users | Создать пользователя | admin |
| GET | /api/v1/locations | Список локаций | any |
| POST | /api/v1/locations | Создать локацию | admin |
| GET | /api/v1/locations/:id/zones | Зоны локации | any |
| POST | /api/v1/devices/provision | Зарегистрировать датчик | admin |
| GET | /api/v1/devices | Список устройств | any |
| GET | /api/v1/devices/:serial | Одно устройство | any |
| PATCH | /api/v1/devices/:serial | Обновить имя/зону | admin |
| DELETE | /api/v1/devices/:serial | Вывод из эксплуатации | admin |
| POST | /api/v1/devices/:serial/rotate-mqtt | Ротация MQTT пароля | admin |
| GET | /api/v1/devices/:serial/readings | История показаний | any |
| POST | /api/v1/devices/:serial/alert-rules | Создать правило тревоги | admin/operator |
| GET | /api/v1/devices/:serial/calibrations | История калибровок | any |
| POST | /api/v1/devices/:serial/calibrations | Записать калибровку | admin/operator |
| GET | /api/v1/alert-events | События тревог | any |
| PATCH | /api/v1/alert-events/:id/acknowledge | Подтвердить тревогу | admin/operator |
| GET | /api/v1/webhooks | Список webhooks | admin |
| POST | /api/v1/webhooks | Создать webhook | admin |
| GET | /api/v1/audit-log | Журнал аудита | any |
| GET | /api/v1/export/readings | Экспорт (CSV, PDF) | any |

---

## Резервное копирование

```bash
cd deploy
./scripts/backup.sh   # → backup_YYYYMMDD_HHMMSS.sql
```

Восстановление:

```bash
./scripts/restore.sh backup_20260307_030000.sql
docker compose restart server
```

Файлы `data/mosquitto/passwd` и `acl` не нужно бэкапить — сервер восстанавливает их из БД при каждом запуске.

---

## Безопасность

- **Auth:** JWT (15 мин) + refresh cookie (7 дней, HTTP-only, SameSite=Lax).
- **MQTT:** per-device аутентификация, ACL (publish-only для устройств), анонимный доступ запрещён. Auth-sync через sidecar, без docker.sock.
- **Webhook:** HMAC-SHA256 подпись на всех событиях. SSRF-защита (блокировка localhost/private/link-local).
- **Rate limiting:** защита от brute-force на `/auth/login` и `/auth/refresh`.
- **Audit log:** append-only журнал всех операций.
- **Пароли:** argon2id hashing.

Подробнее: [docs/P2/SECURITY-HARDENING.md](docs/P2/SECURITY-HARDENING.md)

---

## Логи и диагностика

```bash
cd deploy
docker compose logs server -f    # логи API-сервера
docker compose logs web -f       # логи Next.js UI
docker compose logs mqtt -f      # логи Mosquitto
docker compose logs db -f        # логи PostgreSQL
```

### E2E тест (только API)

```bash
cd deploy
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=ваш_пароль ./scripts/e2e-test.sh
```
