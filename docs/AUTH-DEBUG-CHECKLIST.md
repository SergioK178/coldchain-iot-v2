# Чеклист диагностики 401 после логина

Логи показывают: **"Refresh 401: invalid or expired token"** — cookie доходит, токен приходит, но backend его отклоняет.

**С версии с диагностикой** в логах есть `reason`:
- `NOT_FOUND` — токен не найден в БД (хеш не совпал: JWT_SECRET, кодировка cookie, старый токен)
- `EXPIRED` — токен истёк
- `USER_NOT_FOUND` — пользователь удалён

## 1. Cookie и Set-Cookie (браузер)

### 1.1 Проверить, что cookie устанавливается
- DevTools → Application → Cookies → `https://coldchain-service.site`
- После логина должен появиться `refreshToken` (HttpOnly, Path=/)
- Если cookie **нет** — проблема в Set-Cookie (см. п. 2)

### 1.2 Проверить, что cookie отправляется
- DevTools → Network → запрос к `/api/proxy` или `/api/auth/refresh`
- Request Headers → должен быть `Cookie: refreshToken=...`
- Если Cookie **нет** в запросе — браузер не отправляет (SameSite, Secure, Domain)

### 1.3 Очистить все cookie
- Удалить все cookie для `coldchain-service.site` и `*.coldchain-service.site`
- Войти заново и проверить п. 1.1–1.2

---

## 2. Set-Cookie в ответе логина

### 2.1 Проверить ответ /api/auth/login
- DevTools → Network → POST `/api/auth/login`
- Response Headers → должен быть `Set-Cookie: refreshToken=...; HttpOnly; SameSite=Lax; Path=/; Max-Age=...`
- Для HTTPS должен быть `Secure`

### 2.2 Если Set-Cookie отсутствует или обрезан
- Проблема в Next.js auth proxy (`apps/web/app/api/auth/[...path]/route.ts`)
- Или в backend (`apps/server/src/routes/auth.ts`)

---

## 3. Backend: JWT_SECRET и хеш

### 3.1 JWT_SECRET одинаков везде
- В `deploy/.env`: `JWT_SECRET` задан и не меняется между рестартами
- Хеш токена зависит от JWT_SECRET — при смене секрета все токены невалидны

### 3.2 Проверить refresh_tokens в БД
```bash
docker compose exec db psql -U sensors -d sensors -c "SELECT id, user_id, expires_at FROM refresh_tokens ORDER BY id DESC LIMIT 5;"
```
- После логина должна появиться новая запись
- `expires_at` — в будущем (через 7 дней)

---

## 4. Двойной логин (race)

Логи показывают **два** успешных login подряд. Каждый создаёт новый токен.

### 4.1 Отключить двойную отправку формы
- В `apps/web/app/login/page.tsx` — кнопка `disabled` во время запроса, текст «Вход...»
- Предотвратить двойной клик

### 4.2 Проверить, какой токен в cookie
- Если первый login вернул token A, второй — token B
- Cookie = token B (последний ответ)
- Refresh должен использовать token B — он должен быть в БД

---

## 5. Прокси и заголовки

### 5.1 Next.js auth proxy
- `apps/web/app/api/auth/[...path]/route.ts` — копирует `request.headers` в backend
- Удаляется только `host`
- Cookie и X-Forwarded-Proto должны проходить

### 5.2 Next.js proxy (/api/proxy)
- `apps/web/app/api/proxy/route.ts` — берёт `request.headers.get('cookie')` и передаёт в refresh
- Проверить: cookie не пустой при запросе от браузера

### 5.3 Caddy
- `deploy/config/caddy/Caddyfile` — не должен обрезать Cookie
- Caddy по умолчанию пробрасывает все заголовки

---

## 6. Кодирование cookie

### 6.1 Backend
- `setRefreshCookie`: `encodeURIComponent(value)`
- `getRefreshFromCookie`: `decodeURIComponent(m[1].trim())`

### 6.2 Спецсимволы
- Токен = base64url (A-Za-z0-9_-) — encodeURIComponent не меняет
- Если токен как-то искажается — хеш не совпадёт

---

## 7. AUTH_COOKIE_SECURE

### 7.1 Для HTTPS
- В `deploy/.env`: `AUTH_COOKIE_SECURE=true`
- Иначе cookie может ставиться без Secure → браузер может не принять на HTTPS

### 7.2 X-Forwarded-Proto
- Caddy добавляет `X-Forwarded-Proto: https` при проксировании
- Backend использует это для `shouldUseSecureCookie`

---

## 8. Быстрые проверки на сервере

```bash
# 1. JWT_SECRET задан
docker compose exec server printenv JWT_SECRET | wc -c
# Должно быть > 64

# 2. AUTH_COOKIE_SECURE
docker compose exec server printenv AUTH_COOKIE_SECURE
# Для HTTPS: true

# 3. Токены в БД после логина
docker compose exec db psql -U sensors -d sensors -c "SELECT COUNT(*) FROM refresh_tokens;"
# Должно расти после каждого логина
```

---

## 9. Гипотеза: старый токен в cookie

Если в cookie остался **старый** токен (от предыдущей сессии):
- Он уже использован (ротация) или истёк
- Backend вернёт "invalid or expired"

**Действие:** полностью очистить cookie, закрыть все вкладки, открыть сайт заново и войти.

---

## 10. Рекомендуемые правки

1. **Защита от двойного submit** — сделано
2. **Явный AUTH_COOKIE_SECURE=true** в .env для HTTPS
3. **Диагностика reason** — при 401 логируется NOT_FOUND / EXPIRED / USER_NOT_FOUND
