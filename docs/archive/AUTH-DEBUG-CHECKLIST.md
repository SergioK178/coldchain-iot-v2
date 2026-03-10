# Чеклист диагностики 401 после логина (архив)

> Временная документация по отладке авторизации. Проблемы исправлены. Краткая справка по 401 — в deploy/docs/install-guide.md (таблица «Частые проблемы»).

Логи показывают: **"Refresh 401: invalid or expired token"** — cookie доходит, токен приходит, но backend его отклоняет.

**С версии с диагностикой** в логах есть `reason`:
- `NOT_FOUND` — токен не найден в БД (хеш не совпал: JWT_SECRET, кодировка cookie, старый токен)
- `EXPIRED` — токен истёк
- `USER_NOT_FOUND` — пользователь удалён

## Быстрые действия

1. Для HTTPS: `AUTH_COOKIE_SECURE=true` в `.env`
2. Очистить cookie в браузере, войти заново
3. Проверить `docker compose logs server` — reason в логах

## Подробный чеклист (архив)

<details>
<summary>Развернуть полный чеклист</summary>

### Cookie и Set-Cookie (браузер)
- DevTools → Application → Cookies — после логина должен быть refreshToken
- DevTools → Network — запросы к /api/proxy должны содержать Cookie

### Backend
- JWT_SECRET не меняется между рестартами
- `docker compose exec db psql -U sensors -d sensors -c "SELECT id, user_id, expires_at FROM refresh_tokens ORDER BY id DESC LIMIT 5;"`

### Прокси
- Next.js auth proxy и /api/proxy передают Cookie и X-Forwarded-Proto

</details>
