# Руководство по установке

## Требования

- Docker Engine 24+ и Docker Compose v2
- 1 ГБ оперативной памяти (минимум)
- 10 ГБ свободного места на диске
- Локальная сеть (LAN) между сервером и датчиками

## Установка

### 1. Скачать пакет

Скопируйте директорию `deploy/` на целевую машину.

### 2. Настроить переменные окружения

```bash
cd deploy
cp .env.example .env
```

Откройте `.env` и заполните обязательные поля:

```
DB_PASSWORD=<пароль PostgreSQL, придумайте надёжный>
MQTT_ADMIN_PASSWORD=<пароль MQTT admin, придумайте надёжный>
API_TOKEN=<токен для API, минимум 32 символа>
```

Опциональные параметры (значения по умолчанию указаны в `.env.example`):
- `HTTP_PORT` — порт веб-интерфейса (по умолчанию 8080)
- `MQTT_PORT` — порт MQTT брокера (по умолчанию 1883)
- `DEVICE_OFFLINE_TIMEOUT_SEC` — таймаут офлайн-статуса (по умолчанию 300 сек)
- `ALERT_CALLBACK_URL` — URL для HTTP-уведомлений при тревоге

### 3. Запустить

```bash
docker compose up -d
```

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

## Регистрация первого датчика

```bash
curl -X POST http://localhost:8080/api/v1/devices/provision \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ваш API_TOKEN>" \
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

### Batch-регистрация

Для массовой регистрации используйте `provision-cli`:

```bash
# Подготовьте CSV файл:
# serial,displayName,powerSource,zoneId
# SENS-TH-00001,Морозилка №1,battery,
# SENS-TH-00002,Морозилка №2,battery,
# SENS-TP-00003,Зонд холодильника,wired,

pnpm --filter @sensor/provision-cli provision -- \
  --file devices.csv \
  --api-url http://localhost:8080 \
  --api-token <ваш API_TOKEN> \
  --output-file credentials.csv
```

## Прошивка credentials в датчик

Полученные `username` и `password` необходимо прошить в датчик. Подробности — в документации по firmware.

Параметры подключения:
- MQTT Host: IP-адрес сервера
- MQTT Port: 1883 (или значение `MQTT_PORT`)
- Username: из ответа provision
- Password: из ответа provision

## Файлы passwd и acl

Файлы `data/mosquitto/passwd` и `data/mosquitto/acl` поставляются пустыми. При первом запуске сервер автоматически выполняет **reconcile** — пересобирает оба файла из базы данных зарегистрированных устройств и перезагружает Mosquitto. Ручное редактирование этих файлов не требуется.

## Веб-интерфейс

Откройте в браузере:

```
http://<адрес_сервера>:8080
```

При первом входе введите `API_TOKEN` из `.env`. Токен сохраняется в `sessionStorage` браузера на время сессии.

## Настройка правила тревоги

```bash
curl -X POST http://localhost:8080/api/v1/devices/SENS-TH-00001/alert-rules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ваш API_TOKEN>" \
  -d '{
    "metric": "temperature_c",
    "operator": "gt",
    "threshold": -15.0,
    "cooldownMinutes": 15
  }'
```

## Настройка callback URL

Для получения HTTP-уведомлений при тревоге добавьте в `.env`:

```
ALERT_CALLBACK_URL=http://192.168.1.100:9000/hooks/sensor
```

Перезапустите сервер:

```bash
docker compose restart server
```

При срабатывании правила сервер отправит POST-запрос на указанный URL с информацией о тревоге.

## Swagger UI

Документация API доступна по адресу:

```
http://<адрес_сервера>:8080/api/docs
```
