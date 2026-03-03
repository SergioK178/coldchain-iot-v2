# HARDENING-SUMMARY.md

## P1 Hardening — итоги выполнения

**Дата:** 2026-03-03
**Спецификация:** [HARDENING-SPEC.md](./HARDENING-SPEC.md)

---

## H1: LWT / offline — два чётких пути ✅

### Контракт

| Сценарий | Кто публикует `0` | Механизм | Скорость |
|---|---|---|---|
| Graceful stop (Ctrl+C) | Firmware / симулятор (explicit publish) | Явная публикация `0` в `d/{serial}/s` перед disconnect | Мгновенно |
| Аварийный обрыв (kill -9, crash, потеря сети) | Broker (LWT) | Broker публикует LWT после keepalive timeout | ~90 сек |
| Нет сигналов | Сервер (timeout) | `DEVICE_OFFLINE_TIMEOUT_SEC` (default 300s) | ~5 мин |

### Что изменено

- **`tools/simulator/src/index.ts`**: graceful shutdown теперь явно публикует `0` перед `client.end()`. Комментарий исправлен — больше не утверждает, что LWT сработает при graceful stop.
- **`README.md`**: раздел "Симулятор" — описаны оба пути (explicit publish vs LWT).
- **`docs/P1/FIRMWARE-GUIDE.md`**: раздел энергосбережения — описаны оба пути. Раздел тестирования — два отдельных сценария (graceful + ungraceful).
- **`docs/api-reference.md`**: таблица LWT/Status — три строки (connect, graceful stop, аварийный обрыв) + блок-примечание.

---

## H2: ACL — строгая модель publish-only ✅

### Контракт

Устройство в P1:
- **MAY** publish → `d/{serial}/t`, `d/{serial}/s`
- **MUST NOT** subscribe на любой топик
- **MUST NOT** publish в чужие топики

### Что изменено

- **`apps/server/src/lib/mosquitto-files.ts`**: удалена строка `topic read d/${dev.serial}/s` из ACL-генерации. Устройства теперь имеют только write-права.
- **`docs/P1/FIRMWARE-GUIDE.md`**: таблица ACL — убрана строка Subscribe. Добавлено явное указание: "Устройство не должно подписываться — подписка будет отклонена ACL." Пример `mosquitto_sub` заменён на admin-credentials.
- **`docs/api-reference.md`**: уже содержал корректную формулировку — подтверждено.

---

## H3: Формат пароля — 32-char lowercase hex ✅

### Контракт

Plaintext MQTT-пароль: `^[a-f0-9]{32}$` (16 random bytes → hex).

### Что изменено

- **Код** (`mosquitto-files.ts:25-27`): уже корректен — `randomBytes(16).toString('hex')`.
- **`docs/api-reference.md`**: пример пароля заменён с mixed-case (`aB3dE5...`) на lowercase hex (`a7f3e9b1...`). Добавлено примечание о формате.
- **`docs/P1/FIRMWARE-GUIDE.md`**: добавлено описание формата пароля в раздел credentials.

---

## H4: Артефакты верификации

Тестовые скрипты существуют в `deploy/scripts/`:
- `e2e-test.sh` — API-тесты
- `e2e-with-simulators.sh` — полный E2E с симуляторами
- `smoke-load.sh` — smoke-нагрузка
- `backup.sh` / `restore.sh` — бэкап/восстановление

На текущем цикле hardening сохранены фактические артефакты:
- `artifacts/hardening/e2e-test.txt` — `29 passed, 0 failed`
- `artifacts/hardening/e2e-with-simulators.txt` — `18 passed, 0 failed`
- `artifacts/hardening/server-log.txt` — лог запуска стека (миграции/seed/reconcile/server up)

> Полный набор артефактов из `HARDENING-SPEC.md` (все сценарии H4) можно дозаполнить отдельным приёмочным прогоном, но базовые e2e/hardening прогоны уже зафиксированы.

---

## H5: Пилотные ограничения ✅

### Что изменено

- **`README.md`**: добавлен подраздел "Ограничения P1 (пилотная эксплуатация)" с перечнем компромиссов (UI в LAN, Swagger, MQTT 1883, Docker socket, Bearer token).
- **`deploy/docs/security.md`**: добавлен раздел "P1: Границы пилотной эксплуатации" с таблицей текущего статуса и планов P2.

---

## Дополнительные закрытия (после базового hardening) ✅

### H6: Глобальная авторизация API

- **`apps/server/src/app.ts`**: auth-hook подключён на root instance (`await authPlugin(app)`), чтобы защита токеном применялась ко всем `/api/*` маршрутам консистентно.

### H7: Статика/UI fallback

- **`apps/server/src/plugins/static.ts`**:
  - исправлена ошибка `reply.sendFile is not a function` (корректная регистрация static-plugin + fallback),
  - для отсутствующих ассетов (`/favicon.ico`, `/flutter_service_worker.js`) возвращается `404`, а не `index.html`,
  - SPA fallback сохранён для обычных non-API роутов.

### H8: Provisioning/reprovision edge-cases

- **`apps/server/src/services/provision.ts`**:
  - повторная регистрация того же `serial` (включая ранее decommissioned) возвращает `DEVICE_ALREADY_PROVISIONED`,
  - SQL unique violation (`23505`) маппится в бизнес-ошибку `409`, без утечки в `500`.

### H9: Mosquitto runtime hardening

- **`apps/server/src/lib/mosquitto-files.ts`**:
  - генерация hash в полностью совместимом формате `$7$...`,
  - после атомарной записи применяются `chmod 0700` и `chown 1883:1883` (best-effort) для `passwd`/`acl`,
  - сняты предупреждения/ошибки брокера по владельцу/правам и декодированию соли.

### H10: DB/queries и устойчивость e2e

- **`packages/db/src/schema.ts`, `packages/db/src/migrate.ts`**: `readings.message_id` приведён к `TEXT` до `create_hypertable` (закрыт warning TimescaleDB).
- **`apps/server/src/services/device.ts`**: исправлен запрос агрегации unack alerts (`inArray` вместо проблемного `ANY`).
- **`deploy/scripts/e2e-test.sh`, `deploy/scripts/e2e-with-simulators.sh`**:
  - улучшена идемпотентность повторных прогонов,
  - offline-проверка через аварийный stop симулятора и polling до 60 секунд.

---

## Полный список изменённых файлов

| Файл | H# | Тип изменения |
|---|---|---|
| `tools/simulator/src/index.ts` | H1 | Код: explicit offline publish перед disconnect |
| `apps/server/src/lib/mosquitto-files.ts` | H2 | Код: удалена read-permission для устройств |
| `README.md` | H1, H5 | Docs: offline-поведение, пилотные ограничения |
| `docs/api-reference.md` | H1, H3 | Docs: LWT-таблица, формат пароля |
| `docs/P1/FIRMWARE-GUIDE.md` | H1, H2, H3 | Docs: ACL, тестирование offline, формат пароля |
| `deploy/docs/security.md` | H5 | Docs: границы пилотной эксплуатации |
| `apps/server/src/app.ts` | H6 | Код: глобальное применение auth hook |
| `apps/server/src/plugins/static.ts` | H7 | Код: fixed SPA fallback и 404 для отсутствующих ассетов |
| `apps/server/src/services/provision.ts` | H8 | Код: защита от reprovision + mapping 23505 -> 409 |
| `packages/db/src/schema.ts` | H10 | Код: `readings.message_id` -> `text` |
| `packages/db/src/migrate.ts` | H10 | Код: post-migration guard для `message_id=text` |
| `apps/server/src/services/device.ts` | H10 | Код: исправлен SQL для alert aggregation |
| `deploy/scripts/e2e-test.sh` | H10 | Скрипт: стабильность/idempotent rerun |
| `deploy/scripts/e2e-with-simulators.sh` | H10 | Скрипт: стабильность, LWT/offline polling |
| `artifacts/hardening/e2e-test.txt` | H4 | Артефакт: 29 passed / 0 failed |
| `artifacts/hardening/e2e-with-simulators.txt` | H4 | Артефакт: 18 passed / 0 failed |
| `artifacts/hardening/server-log.txt` | H4 | Артефакт: логи запуска/инициализации |

---

## Статус

| Пункт | Статус |
|---|---|
| H1 — LWT/offline alignment | ✅ Выполнено |
| H2 — ACL publish-only | ✅ Выполнено |
| H3 — Password format | ✅ Выполнено |
| H4 — Артефакты верификации | ✅ Базовые e2e/hardening артефакты сохранены |
| H5 — Пилотные ограничения | ✅ Выполнено |
| H6 — Глобальная авторизация API | ✅ Выполнено |
| H7 — Static/UI fallback hardening | ✅ Выполнено |
| H8 — Provisioning conflict handling | ✅ Выполнено |
| H9 — Mosquitto runtime permissions/hash | ✅ Выполнено |
| H10 — DB/e2e stability fixes | ✅ Выполнено |
| Server build | ✅ Компилируется |
