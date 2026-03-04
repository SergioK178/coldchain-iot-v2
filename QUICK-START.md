1) Запуск пайплайна (локально)

Подготовка окружения:
cd deploy
cp .env.example .env
Заполнить обязательные переменные в deploy/.env:
DB_PASSWORD
MQTT_ADMIN_PASSWORD
API_TOKEN
Запуск стека:
cd deploy
docker compose up -d --build
Проверка:
docker compose ps
curl http://localhost:8080/api/v1/health
Что поднимается автоматически:

db (PostgreSQL + TimescaleDB)
mqtt (Mosquitto)
server (API + UI + Swagger)
Сервер на старте:

применяет миграции/seed,
делает reconcile Mosquitto (passwd/acl из БД),
подписывается на d/+/t и d/+/s,
запускает offline-check таймер.
2) Подключение датчика (provisioning)
Устройство регистрируется через API, после чего получает MQTT credentials.

Пример:

curl -X POST http://localhost:8080/api/v1/devices/provision \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serial":"SENS-TH-00001",
    "displayName":"Морозилка №1",
    "powerSource":"battery"
  }'
В ответе придут:

mqtt.username
mqtt.password (показывается один раз)
topic: d/<serial>/t
statusTopic: d/<serial>/s
3) Что настраивается на датчике
На прошивке/устройстве нужно задать:

MQTT broker: mqtt://<host>:1883
Username/Password из provisioning
Telemetry topic: d/<serial>/t
Status topic: d/<serial>/s
LWT на статус-топик со значением 0
При connect публиковать статус 1
Payload телеметрии по контракту проекта
ACL в P1:

устройство может только publish в свои d/<serial>/t и d/<serial>/s,
subscribe устройству запрещен.
4) Проверка подключения

В UI: http://<host>:8080 устройство должно стать online.
Через API:
curl -H "Authorization: Bearer $API_TOKEN" http://localhost:8080/api/v1/devices
curl -H "Authorization: Bearer $API_TOKEN" "http://localhost:8080/api/v1/devices/SENS-TH-00001/readings?limit=10"
5) Автотесты пайплайна
Из deploy/:

API_TOKEN=... ./scripts/e2e-test.sh
API_TOKEN=... REPO_ROOT=/projects/coldchain-iot-v2 ./scripts/e2e-with-si

Для физического датчика нужен такой контракт.

Получить credentials через provisioning
POST /api/v1/devices/provision
Из ответа взять:
mqtt.username
mqtt.password
topic (d/<SERIAL>/t)
statusTopic (d/<SERIAL>/s)
Настроить MQTT-клиент на датчике
Broker: mqtt://<server-ip>:1883
Auth: username/password из provisioning
clientId: уникальный, например dev_<SERIAL>_<chipid>
LWT:
topic: d/<SERIAL>/s
payload: 0
retain: true
qos: 1
Поведение при подключении
Сразу publish в d/<SERIAL>/s: payload 1, retain true, qos 1
Затем publish телеметрии в d/<SERIAL>/t по таймеру (например, каждые 30–60 сек), qos 1
Формат телеметрии (JSON)
{
  "v": 1,
  "id": "SENS-TH-00001",
  "ts": 1772530000,
  "mid": "12345",
  "t": -18.4,
  "h": 47.2,
  "bat": 96,
  "rssi": -67,
  "fw": "1.0.0"
}
v, id, ts, mid обязательны
mid уникален для каждого сообщения (важно для дедупликации)
t для T/TH/TP
h только для TH/HM
bat обычно для battery-устройств (не обязателен для wired TP)
Поведение при отключении
Graceful stop: publish 0 в d/<SERIAL>/s, затем disconnect
Аварийный обрыв: 0 отправит broker по LWT автоматически
Важные ограничения P1
Датчик не должен subscribe ни на какие топики (ACL запретит)
Публиковать можно только в свои d/<SERIAL>/t и d/<SERIAL>/s