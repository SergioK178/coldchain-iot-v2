# Руководство по установке

## Требования

- Docker Engine 24+ и Docker Compose v2
- 1 ГБ оперативной памяти (минимум)
- 10 ГБ свободного места на диске
- Локальная сеть (LAN) между сервером и датчиками

## Установка (on-prem / single-tenant)

P2 использует **один canonical compose-файл**: `deploy/docker-compose.yml`.
Отдельный local-override файл не требуется.

### 1. Скачать пакет

Скопируйте директорию `deploy/` на целевую машину.

### 2. Настроить переменные окружения

```bash
cd deploy
cp .env.example .env
```

Откройте `.env` и заполните обязательные поля:

```
DB_PASSWORD=<пароль PostgreSQL, минимум 32 символа>
MQTT_ADMIN_PASSWORD=<пароль MQTT admin, минимум 32 символа>
JWT_SECRET=<случайная строка, минимум 64 символа>
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=<надёжный пароль администратора>
MOSQUITTO_RELOAD_URL=http://mqtt:9080/reload
```

`MOSQUITTO_RELOAD_URL` — обязателен для P2 (auth-sync sidecar). В docker-compose по умолчанию `http://mqtt:9080/reload`.

Опциональные параметры (значения по умолчанию в `.env.example`):

| Переменная | По умолчанию | Описание |
|---|---|---|
| `HTTP_PORT` | 8080 | Порт API/backend |
| `WEB_PORT` | 3000 | Порт веб-интерфейса |
| `MQTT_PORT` | 1883 | Порт MQTT брокера |
| `PUBLIC_API_URL` | http://localhost:8080 | Публичный URL API (виден браузеру). Для claim flow — датчики получают mqtt_url от этого хоста. |
| `MQTT_PUBLIC_URL` | — | Публичный URL MQTT (напр. mqtt://coldchain-service.site:1883). Если пусто — выводится из PUBLIC_API_URL. |
| `DEVICE_OFFLINE_TIMEOUT_SEC` | 300 | Таймаут офлайн-статуса |
| `WEBHOOK_ALLOWLIST_HOSTS` | — | Comma-separated список разрешённых хостов для webhooks |
| `TELEGRAM_BOT_TOKEN` | — | Токен бота для Telegram-уведомлений о тревогах (опционально) |

### 3. Запустить

**Важно:** все команды `docker compose` выполняйте из директории `deploy/`:

```bash
cd deploy
docker compose up -d
```

При запуске из корня проекта: `docker compose` найдёт `docker-compose.yml` в корне (он включает `deploy/docker-compose.yml`), но переменные окружения берутся из `.env` в текущей директории. Либо скопируйте `deploy/.env` в корень, либо создайте symlink: `ln -sf deploy/.env .env`.

**BuildKit:** Dockerfile используют `RUN --mount=type=cache`. BuildKit включён по умолчанию в Docker 23+. При ошибках сборки выполните `export DOCKER_BUILDKIT=1`.

Дождитесь, пока все контейнеры перейдут в статус healthy:

```bash
docker compose ps
```

### 4. Проверить работоспособность

```bash
curl http://localhost:8080/api/v1/health
```

Ожидаемый ответ:
```json
{"ok": true, "data": {"version": "0.1.0", "uptime": ...}}
```

Для проверки готовности (DB доступна) — `/api/v1/ready`:
```bash
curl http://localhost:8080/api/v1/ready
# 200: {"ok": true}  |  503: {"ok": false, "error": "Database unavailable"}
```

### Устранение неполадок

| Проблема | Причина | Решение |
|----------|---------|---------|
| `no configuration file provided: not found` | Запуск не из `deploy/` | Выполняйте `cd deploy` перед `docker compose up` |
| Ошибка сборки (cache, mount) | BuildKit отключён | `export DOCKER_BUILDKIT=1` |
| `Bind for 0.0.0.0:3000 failed: port is already allocated` | Порт 3000 занят | См. ниже «Диагностика порта 3000» |
| Вход не работает (Invalid credentials) | Admin не создан | Задайте `ADMIN_EMAIL` и `ADMIN_PASSWORD` в `.env`, перезапустите server |
| Вход не работает (cookie) | JWT_SECRET < 64 символов | Увеличьте `JWT_SECRET` до 64+ символов |
| Backend API недоступен | Контейнер server не healthy | `docker compose logs server` — дождитесь миграций и seed |

### Диагностика порта 3000

Если Docker сообщает, что порт 3000 занят:

```bash
# Кто слушает порт (с PID и именем процесса)
ss -tulnp | grep 3000
lsof -i :3000

# Контейнеры Docker, использующие порт
docker ps -a --format '{{.Names}}\t{{.Ports}}' | grep 3000

# Остановить все контейнеры проекта и проверить снова
docker compose down
ss -tulnp | grep 3000
```

Частые причины: другой Docker-проект, зависший контейнер; `systemd` или другой процесс. После освобождения порта — `docker compose up -d`.

## Аутентификация

### Войти через UI

Откройте `http://<адрес_сервера>:<WEB_PORT>` в браузере и войдите с `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Интерфейс поддерживает русский и английский (переключатель в сайдбаре).

### Войти через API (JWT)

```bash
curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourcompany.com","password":"<ADMIN_PASSWORD>"}' \
  | jq .data.accessToken
```

Используйте полученный `accessToken` в последующих запросах:

```bash
curl http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer <accessToken>"
```

## Регистрация (provisioning) первого датчика

```bash
# Получите accessToken (см. выше)
TOKEN=<accessToken>

curl -X POST http://localhost:8080/api/v1/devices/provision \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "serial": "SENS-TH-00001",
    "displayName": "Морозилка №1",
    "powerSource": "battery"
  }'
```

В ответе будут MQTT credentials:
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

**Сохраните `username` и `password`** — plaintext пароль возвращается только один раз.

### Регистрация через UI с QR

Откройте `/onboard` и на шаге 1:
- введите серийный номер вручную, или
- нажмите «Открыть сканер» и отсканируйте QR с датчика.

**Формат QR для наклейки на датчик** (см. [hardware-provisioning.md](./hardware-provisioning.md#qr-code-payload-format-для-наклейки-на-датчик)):
- Plain: `SENS-TH-00001`
- JSON: `{"serial":"SENS-TH-00001","displayName":"Морозилка №1"}`
- Compact: `{"s":"SENS-TH-00001","n":"Морозилка №1"}`

В Chrome/Edge используется нативный BarcodeDetector; в Firefox — fallback (html5-qrcode).

### Batch-регистрация

Для массовой регистрации используйте `provision-cli`. Сначала получите JWT access token через `POST /auth/login` (см. раздел «Войти через API»), затем передайте его в `--api-token`:

```bash
# Получите accessToken (POST /auth/login)
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourcompany.com","password":"<ADMIN_PASSWORD>"}' \
  | jq -r '.data.accessToken')

# Подготовьте CSV файл:
# serial,displayName,powerSource,zoneId
# SENS-TH-00001,Морозилка №1,battery,
# SENS-TH-00002,Морозилка №2,battery,
# SENS-TP-00003,Зонд холодильника,wired,

pnpm --filter @sensor/provision-cli provision -- \
  --file devices.csv \
  --api-url http://localhost:8080 \
  --api-token "$TOKEN" \
  --output-file credentials.csv
```

## Активация датчика

Два способа:

**Способ A — Wi‑Fi AP (рекомендуется):** после регистрации в UI вы получите **код активации**. Подключитесь к Wi‑Fi датчика (ColdChain-SENS-…), откройте http://192.168.4.1, введите Wi‑Fi объекта и код. Датчик сам получит MQTT credentials с сервера.

**Способ B — ручная настройка:** в UI откройте раздел «Ручной режим (MQTT credentials)» и скопируйте username/password. Прошейте их в датчик через USB/BLE. Подробности — в [hardware-provisioning.md](./hardware-provisioning.md).

Параметры подключения (для ручного способа):
- MQTT Host: IP или домен сервера
- MQTT Port: 1883 (или `MQTT_PORT`)
- Username: из ответа provision
- Password: из ответа provision

## HTTPS и домен на VPS

### 1. DNS

Укажите A-запись вашего домена на IP VPS:

```
coldchain.example.com  A  <IP_VPS>
```

### 2. .env

Добавьте в `deploy/.env`:

```env
DOMAIN=coldchain.example.com
PUBLIC_API_URL=https://coldchain.example.com
MQTT_PUBLIC_URL=mqtt://coldchain.example.com:1883
AUTH_COOKIE_SECURE=true
```

`MQTT_PUBLIC_URL` — для claim flow: датчики получают этот URL при активации. Если не задан — выводится из `PUBLIC_API_URL`.

### 3. Порты

Убедитесь, что 80 и 443 свободны.

### 4. Запуск с HTTPS

```bash
cd deploy
docker compose --profile https up -d
```

Caddy автоматически получит сертификат Let's Encrypt и перенаправит HTTP на HTTPS.

### 5. Проверка

```bash
curl https://coldchain.example.com/api/v1/health
```

Откройте в браузере: `https://coldchain.example.com`.

### MQTT для датчиков

Датчики подключаются через IP:1883. Укажите IP или домен VPS:

- MQTT Host: IP вашего VPS или домен
- MQTT Port: 1883

## Веб-интерфейс

Откройте в браузере:

```
http://<адрес_сервера>:<WEB_PORT>
```

Если `WEB_PORT` отличается от `HTTP_PORT` (например, reverse proxy), задайте `PUBLIC_API_URL` в `.env`:

```
PUBLIC_API_URL=https://api.yourcompany.com
```

## Настройка правила тревоги

Через UI: откройте карточку устройства (`/devices/SENS-TH-00001`) → раздел «Правила оповещений» → заполните метрику (температура, влажность или батарея), условие, порог, cooldown → «Добавить правило». Для уведомлений о низком заряде выберите метрику «Батарея %» и условие «&lt;» с порогом 20.

Через API:

```bash
curl -X POST http://localhost:8080/api/v1/devices/SENS-TH-00001/alert-rules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "metric": "temperature_c",
    "operator": "gt",
    "threshold": -15.0,
    "cooldownMinutes": 15
  }'
```

## Настройка Webhook

```bash
curl -X POST http://localhost:8080/api/v1/webhooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "url": "https://your-receiver.example.com/hooks/sensor",
    "secret": "<hmac-secret>",
    "events": ["alert.triggered", "device.offline"]
  }'
```

Webhook подписываются HMAC-SHA256. Подробности верификации — в [security.md](./security.md).

## Telegram-уведомления о тревогах

При срабатывании правил тревоги система может отправлять сообщения в Telegram всем пользователям, привязавшим свой аккаунт.

### 1. Создать бота

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram.
2. Отправьте `/newbot`, укажите имя и username бота.
3. Скопируйте выданный токен (например, `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`).

### 2. Настроить сервер

Добавьте в `.env`:

```
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

Перезапустите контейнер server:

```bash
docker compose up -d server
```

Если `TELEGRAM_BOT_TOKEN` не задан, бот не запускается — ошибок не будет.

### 3. Привязать Telegram пользователю

1. Войдите в веб-интерфейс: `http://<адрес>:<WEB_PORT>`.
2. Откройте **Настройки → Telegram** (`/settings/telegram`).
3. Нажмите «Сгенерировать код».
4. Найдите бота по username (из BotFather) и отправьте ему код.
5. Бот подтвердит привязку — уведомления о тревогах будут приходить в этот чат.

При срабатывании правила тревоги (например, температура выше порога) все пользователи с привязанным Telegram получат сообщение с данными устройства, метрикой и порогом.

## Swagger UI

Документация API доступна по адресу:

```
http://<адрес_сервера>:<HTTP_PORT>/api/docs
```
