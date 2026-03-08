# Настройка деплоя через GitHub Actions

## 1. Подготовка VPS

На сервере должен быть клонирован репозиторий:

```bash
cd /var/www
git clone https://github.com/YOUR_ORG/coldchain-iot-v2.git
cd coldchain-iot-v2
```

Создайте `deploy/.env` с секретами (DB_PASSWORD, JWT_SECRET и т.д.).

## 2. SSH-ключ для деплоя

Создайте отдельный ключ для GitHub Actions:

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f deploy_key -N ""
```

- **Публичный ключ** (`deploy_key.pub`) — добавьте на VPS в `~/.ssh/authorized_keys` пользователя, от которого будет деплой
- **Приватный ключ** (`deploy_key`) — добавьте в GitHub Secrets (см. ниже)

## 3. GitHub Secrets

В репозитории: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Описание |
|--------|----------|
| `DEPLOY_HOST` | IP или hostname VPS (например `77.110.112.137`) |
| `DEPLOY_USER` | SSH-пользователь (например `root`) |
| `DEPLOY_SSH_KEY` | Содержимое приватного ключа (`cat deploy_key`) |
| `DEPLOY_PATH` | (опционально) Путь к репо на VPS, по умолчанию `/var/www/coldchain-iot-v2` |

## 4. Проверка

После push в `master` или `main`:

1. Запускается **CI** — сборка и проверки
2. Запускается **Deploy** — SSH на VPS, `git pull`, `docker compose build && up`

Ручной запуск: **Actions → Deploy → Run workflow**.

## 5. Деплой для владельцев компаний (форк)

Каждая компания может:
- **Сделать форк** репозитория
- Добавить свои Secrets (DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY, DEPLOY_PATH)
- При push в `master`/`main` деплой пойдёт на их VPS

Репозиторий обязателен — GitHub Actions привязан к репо. Без репо — только ручной деплой или другой CI.

## 6. Без HTTPS-профиля

Если не используете Caddy (HTTPS), измените в `deploy.yml`:

```yaml
docker compose -f deploy/docker-compose.yml build --no-cache
docker compose -f deploy/docker-compose.yml up -d
```

(уберите `--profile https`)

чек