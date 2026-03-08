# Безопасность

## MQTT

- **Анонимный доступ запрещён** (`allow_anonymous false` в конфигурации Mosquitto).
- **Per-device аутентификация**: каждый датчик получает уникальные username/password при регистрации (provisioning).
- **ACL (Access Control List)**: каждый датчик может публиковать только в свои топики (`d/{serial}/t` и `d/{serial}/s`). Чтение чужих топиков запрещено.
- **Пароли хранятся в хешированном виде** (PBKDF2-SHA512) в базе данных и файле `passwd`.

### MQTT порт

**Порт 1883 не должен быть доступен из интернета.** Настройте firewall так, чтобы порт был открыт только для устройств в локальной сети.

Пример (iptables):
```bash
# Разрешить MQTT только из подсети 192.168.1.0/24
iptables -A INPUT -p tcp --dport 1883 -s 192.168.1.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 1883 -j DROP
```

> MQTT over TLS (порт 8883) — вне scope P2. Используйте TLS-terminating proxy (например, Caddy) для защиты канала при необходимости.

### Перезагрузка Mosquitto (auth-sync)

В P2 отдельный sidecar-процесс `auth-sync` управляет `passwd`/`acl` файлами и перезагружает Mosquitto через внутренний HTTP API (`RELOAD_PORT=9080`). **Docker socket не используется.**

При старте сервер вызывает reconcile через auth-sync, пересобирая `passwd` и `acl` из базы данных. Ручное редактирование не требуется.
Canonical env: `MOSQUITTO_RELOAD_URL` (например, `http://mqtt:9080/reload`).

## Аутентификация API (P2)

P2 поддерживает две схемы аутентификации:

### JWT (основная, для UI и машинных клиентов)

1. Получите токены через `POST /api/v1/auth/login`:
   ```json
   { "email": "admin@example.com", "password": "..." }
   ```
2. В ответе — `accessToken` (Bearer JWT, короткий TTL) и `refreshToken` (HTTP-only cookie).
3. Используйте в запросах: `Authorization: Bearer <accessToken>`.
4. Обновляйте через `POST /api/v1/auth/refresh` (по cookie).

Защита: rate-limit на login и refresh; при превышении возвращается `429` и `Retry-After`.

### Роли

| Роль | Права |
|------|-------|
| `admin` | Полный доступ: provisioning, управление пользователями, webhooks, экспорт |
| `operator` | Просмотр устройств, данных, калибровки |

## Webhooks (P2)

- **HMAC-SHA256 подпись**: каждый запрос webhook подписывается секретом, заданным при создании.
- **Retry**: при неуспешной доставке — экспоненциальный backoff с ограниченным числом повторов.
- **Allowlist**: `WEBHOOK_ALLOWLIST_HOSTS` ограничивает допустимые хосты назначения (опционально).
- Localhost, private и link-local адреса отклоняются по умолчанию.

Заголовки webhook:
```
X-Webhook-ID: <webhook-id>
X-Delivery-ID: <uuid>
X-Timestamp: <unix-seconds>
X-Signature-256: sha256=<hmac-hex>
```

Верификация HMAC:
```python
import hmac, hashlib
expected = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
assert f"sha256={expected}" == x_signature_256_header
```

## Входные данные

- Все endpoints валидируются через Zod schemas.
- `WEBHOOK_ALLOWLIST_HOSTS` — опциональный comma-separated список разрешённых хостов для webhook URLs.

## Docker socket

В P2 Docker socket **не используется**. Mosquitto управляется через `auth-sync` sidecar (HTTP API). Это устраняет риск P1, при котором сервер имел доступ к Docker Engine через socket.

## Рекомендации

- Смените все пароли (`DB_PASSWORD`, `MQTT_ADMIN_PASSWORD`, `ADMIN_PASSWORD`) и `JWT_SECRET` перед продуктивной эксплуатацией.
- Используйте криптографически стойкие значения (минимум 32 символа для токенов).
- Не передавайте `JWT_SECRET` по незащищённым каналам.
- Для HTTPS: активируйте Caddy-профиль (`--profile https`) и настройте `Caddyfile`.

## Данные

- Credentials PostgreSQL задаются через `.env`, не используются значения по умолчанию.
- `.env.example` не содержит реальных секретов — только placeholder-комментарии.
- Данные хранятся в bind mounts (`./data/postgres`, `./data/mosquitto`) на хосте.

## Swagger UI

Swagger UI (`/api/docs`) доступен по умолчанию. В production рекомендуется отключить: задайте `SWAGGER_UI_ENABLED=false` в `.env`. Альтернатива: закрыть через reverse proxy или ограничить доступ по IP.

## API Proxy (Next.js → Backend)

Веб-интерфейс использует `/api/proxy` для проксирования запросов к backend. Реализована защита от path traversal: пути с `..` или `//` отклоняются. Auth-пути (`/api/v1/auth/`) не проксируются.

## Troubleshooting: provisioning и reconcile

### Где смотреть логи

```bash
# Логи сервера
docker compose logs server -f

# Логи auth-sync / Mosquitto
docker compose logs mqtt -f
```

### Как проверить, что reconcile отработал

В логах сервера при старте должны быть строки:
```
Running Mosquitto reconcile...
Mosquitto reconcile complete.
```

Также можно проверить содержимое файлов:
```bash
cat data/mosquitto/passwd   # Должны быть записи для admin и всех устройств
cat data/mosquitto/acl      # Должны быть ACL правила
```

### Mosquitto не принимает новые credentials

1. Убедитесь, что auth-sync контейнер (`mqtt`) запущен:
   ```bash
   docker compose ps
   ```
2. Проверьте логи auth-sync на ошибки reload.
3. Перезапустите mqtt-контейнер вручную (reconcile запустится автоматически):
   ```bash
   docker compose restart mqtt
   ```
