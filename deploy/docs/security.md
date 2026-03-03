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

MQTT over TLS (порт 8883) — запланировано в P2.

## API

- Все endpoints (кроме `/api/v1/health`) требуют заголовок `Authorization: Bearer {API_TOKEN}`.
- `API_TOKEN` — статическая строка, задаётся в `.env`. Минимальная длина: 32 символа.
- Входные данные валидируются на каждом endpoint (Zod schema validation).

Полноценная аутентификация (пользователи, роли, JWT) — запланировано в P2.

### Рекомендации

- Смените все пароли (`DB_PASSWORD`, `MQTT_ADMIN_PASSWORD`, `API_TOKEN`) перед продуктивной эксплуатацией.
- Используйте криптографически стойкие пароли (минимум 32 символа).
- Не передавайте `API_TOKEN` по незащищённым каналам.

## Docker socket (P1 exception)

В P1 контейнер `server` имеет read-only доступ к Docker socket (`/var/run/docker.sock`). Это необходимо для отправки сигнала SIGHUP в Mosquitto после обновления файлов `passwd`/`acl`, чтобы Mosquitto перечитал конфигурацию без перезапуска.

**Риски:**
- Доступ к Docker socket фактически предоставляет контроль над Docker Engine на хосте.
- Mount выполнен в режиме read-only, но Docker API всё равно позволяет выполнять операции через HTTP.

**Почему это допустимо в P1:**
- Система предназначена для изолированной on-premise установки в локальной сети клиента.
- Контейнер server не принимает произвольный ввод, который мог бы быть использован для злоупотребления Docker API.

**План замены в P2:**
- Переход на Mosquitto Dynamic Security Plugin или external auth plugin, который не требует пересборки файлов и SIGHUP.

## P1: Границы пилотной эксплуатации

Текущая сборка предназначена для контролируемого пилота в изолированной LAN.

| Аспект | Статус P1 | Планы |
|---|---|---|
| UI (веб-интерфейс) | Доступен в LAN; API-вызовы требуют Bearer token | P2: ролевая авторизация |
| Swagger UI (`/api/docs`) | Доступен в LAN — осознанный компромисс | P2: отключение в production |
| MQTT (порт 1883) | Plaintext, только LAN. **Не выставлять в интернет** | P2: MQTT over TLS (8883) |
| Docker socket | Read-only mount для SIGHUP Mosquitto | P2: Dynamic Security Plugin |
| Аутентификация API | Статический Bearer token | P2: JWT + пользователи/роли |
| Webhook | Один POST, без повторов, без HMAC | P2: HMAC + retries |

**Не используйте эту сборку** для неконтролируемого развёртывания с доступом из интернета.

---

## Данные

- Credentials PostgreSQL задаются через `.env`, не используются значения по умолчанию.
- `.env.example` не содержит реальных паролей — только placeholder-комментарии.
- Данные хранятся в bind mounts (`./data/postgres`, `./data/mosquitto`) на хосте клиента.

## Troubleshooting: provisioning и reconcile

### Где смотреть логи

```bash
# Логи сервера
docker compose logs server -f

# Логи Mosquitto
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

### SIGHUP не применился

Если после provisioning устройство не может подключиться:

1. Проверьте, что контейнер Mosquitto называется `mqtt`:
   ```bash
   docker compose ps
   ```

2. Проверьте, что Docker socket доступен:
   ```bash
   docker compose exec server ls -la /var/run/docker.sock
   ```

3. Попробуйте перезапустить Mosquitto вручную:
   ```bash
   docker compose restart mqtt
   ```

4. Если SIGHUP не работает в вашем окружении (rootless Docker, Podman), перезапускайте Mosquitto после каждого provisioning:
   ```bash
   docker compose restart mqtt
   ```
