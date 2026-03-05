# P2 SHOULD — Definition of Done

**Источник требований:** `docs/P2/P2-EVOLUTION.md`, секция SHOULD.  
**Назначение:** чек-лист для передачи коллеге; каждый пункт — критерий «сделано».

---

## F4 — Telegram-бот (NOT DONE)

- [ ] **Линковка пользователя с Telegram**
  - Страница `/settings/telegram`: генерация one-time кода (6 цифр), TTL 5 мин (in-memory или short-lived запись в БД).
  - Пользователь вводит код в боте; бот верифицирует и записывает `telegram_chat_id` в таблицу `users`.
- [ ] **Хранение telegram_chat_id**
  - Поле `telegram_chat_id` в `users` уже есть в схеме; обеспечить обновление при успешной привязке и опционально сброс в UI.
- [ ] **Уведомления по alert.triggered**
  - При срабатывании алерта отправлять уведомление в Telegram пользователям, у которых заполнен `telegram_chat_id` (payload: serial, name, value, threshold; без объёмного экспорта).
- [ ] **Интеграция бота в процесс**
  - Бот — часть Fastify (grammY, polling). Включение по env `TELEGRAM_BOT_TOKEN`; если не задан — бот не стартует, без ошибки.
- [ ] **Документация и тесты**
  - Описание env `TELEGRAM_BOT_TOKEN`, инструкция запуска в README/deploy.
  - Обновить `docs/P2/API-REFERENCE.md` (если появятся новые эндпоинты для кода/привязки).
  - E2E-smoke сценарий: привязка Telegram → триггер алерта → получение сообщения в чат (по возможности автоматизировать или описать шаги).
- [ ] Обновить `docs/P2/P2-CLOSURE-SUMMARY.md` (F4 → DONE).

---

## F8b — QR onboarding (NOT DONE)

- [ ] **QR-сканер на /onboard**
  - На странице `/onboard` добавить блок сканирования QR **над** ручной формой (ручная форма остаётся и продолжает работать).
  - Библиотека: например `html5-qrcode` или аналог; формат QR: минимум `serial`, опционально `displayName`, `zone` (или zoneId).
- [ ] **Валидация и fallback**
  - Если камера недоступна или пользователь отказывает в доступе — скрыть/свернуть сканер, ручной ввод без изменений.
  - После успешного скана — префилл полей формы (serial, при наличии displayName/zone).
- [ ] **Тест**
  - Сценарий: скан QR → префилл формы → отправка → успешный provision (unit/e2e по возможности).
- [ ] Обновить `docs/P2/P2-CLOSURE-SUMMARY.md` (F8b → DONE).

---

## F9 — CSV/PDF export (NOT DONE)

- [ ] **Backend**
  - Endpoint(ы) экспорта за период: по устройству и/или по локации (например `GET /api/v1/export/readings?deviceSerial=&locationId=&since=&until=&format=csv|pdf` или отдельные пути).
  - Ограничение объёма выборки (limit, max range); учёт timezone и локали дат; пустой результат — корректный ответ (пустой файл или 204).
  - Audit: запись факта экспорта (actor, scope, format) в `audit_log`.
- [ ] **Страница /export**
  - Выбор фильтров (устройство/локация, период), кнопки «Скачать CSV» / «Скачать PDF».
  - Обработка пустого результата и ошибок (toast + сообщение).
- [ ] Обновить OpenAPI и `docs/P2/API-REFERENCE.md`, `docs/P2/P2-CLOSURE-SUMMARY.md` (F9 → DONE).

---

## F10 — Calibration records (PARTIAL)

- [ ] **UI на /devices/[serial]**
  - Секция «Калибровки»: история записей с сортировкой по дате (новые сверху), дата, reference value, device value, offset, notes, кто откалибровал (actor).
  - Отображение текущего `calibrationOffsetC` и источника (последняя запись или «не калибровано»).
- [ ] **Форма создания калибровки**
  - Поля: reference value (°C), device value (°C), notes; actor подставляется из текущего пользователя (backend уже поддерживает).
  - Inline-валидация, success toast, disabled submit во время запроса.
- [ ] **Права и аудит**
  - Доступ к созданию/просмотру — admin/operator; проверить audit-события `calibration.recorded` и роли в API.
- [ ] Обновить `docs/P2/P2-CLOSURE-SUMMARY.md` (F10 → DONE).

---

## F11 — Cursor pagination (NOT DONE)

- [ ] **Backend**
  - В ответы list-endpoints добавить поле `cursor` (opaque string, base64-encoded `{ ts, id }` или аналог), `null` когда данных больше нет.
  - Endpoints: `GET /api/v1/devices/:serial/readings`, `GET /api/v1/alert-events`, `GET /api/v1/audit-log`, `GET /api/v1/webhooks/:id/deliveries`.
  - Query: `limit` + `cursor`; стабильная сортировка (например по времени DESC, затем по id).
- [ ] **UI**
  - В списках (readings на device detail, alert-events, audit-log, deliveries): кнопка «Ещё» / «Load more» или infinite scroll, передача `cursor` в следующий запрос.
- [ ] **Документация**
  - OpenAPI и примеры в `docs/P2/API-REFERENCE.md`: формат ответа `{ ok, data, cursor }`, примеры запроса с `cursor`.
- [ ] Обновить `docs/P2/P2-CLOSURE-SUMMARY.md` (F11 → DONE).

---

## F12 — HTTPS/Caddy (DONE optional)

- [ ] **Закрепить production-ready чек**
  - Secure cookie при работе через HTTPS (уже по коду; проверить, что при `Secure=true` cookie не уходит по HTTP).
  - Redirect HTTP → HTTPS в Caddy (при использовании profile `https`).
  - Краткая инструкция по сертификатам (self-signed / Let's Encrypt) в deploy/docs.
- [ ] **Smoke-test в документации**
  - Раздел в docs: как проверить TLS (браузер, curl), куки и логин через HTTPS (краткий сценарий шагов).
- [ ] При необходимости обновить `docs/P2/P2-CLOSURE-SUMMARY.md` (F12 — явно DONE optional).

---

## Доп. полировка UI (критично для консистентности)

- [ ] **Не авторизован**
  - На дашборде (и защищённых страницах): при 401 от API не показывать пустой экран; делать **redirect на /login** или явный CTA «Войти» (кнопка/баннер).
- [ ] **Таблицы**
  - Sticky header на таблицах (devices, alerts, locations, settings) — уже заложено в `TableHeader`; при необходимости проверить на больших списках.
  - Пагинация или виртуализация для больших списков (devices, alerts): либо «Load more»/cursor, либо ограничение + предупреждение при большом объёме.
- [ ] **Страница устройств (/devices)**
  - Quick-filters: статус (онлайн/офлайн), тревога (да/нет), локация (select).
  - Строка поиска по serial/displayName (фильтр на клиенте или query к API).
- [ ] **Sidebar**
  - Явный индикатор текущего пользователя и роли (email + role).
  - Кнопка «Выход» в верхней зоне на mobile (видимая без скролла вниз).
- [ ] **Формы (onboard, settings, locations, alerts)**
  - Единый паттерн: **inline-ошибки** под полями (из ответа API или zod), **success toast** после успешной мутации, **disabled state** на submit на время запроса.

---

**Итог:** закрытие пункта = все чек-боксы по нему отмечены и при необходимости обновлены `API-REFERENCE.md` и `P2-CLOSURE-SUMMARY.md`.
