# Резервное копирование и восстановление

## Что бэкапить

| Компонент | Путь | Важность | Примечание |
|---|---|---|---|
| База данных | `./data/postgres/` | Критично | Все данные: устройства, показания, правила, аудит |
| Mosquitto данные | `./data/mosquitto/` | Не критично | Файлы `passwd` и `acl` восстанавливаются автоматически через reconcile при старте сервера |

## Резервное копирование

### С помощью скрипта

```bash
cd deploy
./scripts/backup.sh
```

Создаст файл `backup_YYYYMMDD_HHMMSS.sql` в текущей директории.

### Вручную

```bash
docker compose exec -T db pg_dump -U sensors sensors > backup.sql
```

### Автоматизация (cron)

Рекомендуется настроить ежедневное резервное копирование:

```bash
# Добавить в crontab -e:
0 3 * * * cd /path/to/deploy && ./scripts/backup.sh >> /var/log/sensor-backup.log 2>&1
```

## Восстановление

### С помощью скрипта

```bash
cd deploy
./scripts/restore.sh backup_20250715_030000.sql
```

### Вручную

```bash
docker compose exec -T db psql -U sensors sensors < backup.sql
```

### Процедура восстановления на новой машине

1. Скопируйте `deploy/` на новую машину
2. Настройте `.env`
3. Запустите:
   ```bash
   docker compose up -d
   ```
4. Дождитесь, пока БД станет healthy:
   ```bash
   docker compose ps
   ```
5. Восстановите данные:
   ```bash
   ./scripts/restore.sh backup.sql
   ```
6. Перезапустите сервер (чтобы reconcile пересобрал passwd/acl из восстановленных данных):
   ```bash
   docker compose restart server
   ```

После перезапуска сервер выполнит reconcile и автоматически восстановит файлы `passwd` и `acl` из базы данных. Отдельный бэкап этих файлов не требуется.
