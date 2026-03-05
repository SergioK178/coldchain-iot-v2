# F6: Mosquitto auth без docker.sock — final decision

**Дата:** 2026-03-05  
**Статус:** Implemented in P2

## Принятое решение

В P2 реализован sidecar-подход `mosquitto-auth-sync`:

- `server` после provisioning/decommission вызывает `MOSQUITTO_RELOAD_URL` (HTTP POST).
- `mqtt` контейнер (combined image) сам:
  - читает активные устройства из БД,
  - пересобирает `passwd`/`acl`,
  - отправляет `SIGHUP` локальному процессу Mosquitto.

## Security / Ops constraints

- docker.sock **не монтируется** в `server`.
- reload endpoint (`:9080`) доступен только внутри compose-сети (без publish на host).
- `passwd`/`acl` выставляются с безопасными правами и владельцем `mosquitto` uid/gid.

## Что подтверждает закрытие F6

- `deploy/docker-compose.yml`:
  - `mqtt` использует image `sensor-mosquitto-auth-sync`.
  - у `server` нет `docker.sock`.
  - у `mqtt` нет host publish для `9080`.
- `apps/server/src/services/provision.ts`:
  - при `MOSQUITTO_RELOAD_URL` сервер не пишет файлы и не работает с docker.sock.
- `tools/mosquitto-auth-sync`:
  - единая точка rebuild/reload.

## Остаток

- Добавить/расширить e2e smoke, который явно проверяет reload path через sidecar при provision/decommission.
