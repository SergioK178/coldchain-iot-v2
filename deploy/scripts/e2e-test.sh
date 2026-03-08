#!/bin/bash
set -euo pipefail

# =============================================================================
# E2E Integration Test
# Run from deploy/ directory with running docker compose stack.
# Requires: curl, jq
# Usage: ./scripts/e2e-test.sh
# =============================================================================

API_URL="${API_URL:-http://localhost:8080}"
ADMIN_EMAIL="${ADMIN_EMAIL:?Set ADMIN_EMAIL env variable}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?Set ADMIN_PASSWORD env variable}"
PASS=0
FAIL=0

check() {
  local desc="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc"
    FAIL=$((FAIL + 1))
  fi
}

api() {
  curl -sf -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" "$@"
}

echo "=== E2E Integration Test ==="
echo ""

LOGIN=$(curl -sf -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ACCESS_TOKEN=$(echo "$LOGIN" | jq -r '.data.accessToken')
if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
  echo "[FATAL] Failed to get JWT access token via /auth/login"
  exit 1
fi

# --- 1. Health ---
echo "1. Health check"
HEALTH=$(curl -sf "$API_URL/api/v1/health")
check "GET /health returns ok" test "$(echo "$HEALTH" | jq -r '.ok')" = "true"
check "version is 0.1.0" test "$(echo "$HEALTH" | jq -r '.data.version')" = "0.1.0"

# --- 2. Provision 3 devices ---
echo ""
echo "2. Provisioning devices"

BASE_ID=$(( (RANDOM % 9000) + 1000 ))
SERIAL1=$(printf "SENS-TH-%05d" "$BASE_ID")
SERIAL2=$(printf "SENS-TH-%05d" "$((BASE_ID + 1))")
SERIAL3=$(printf "SENS-TP-%05d" "$((BASE_ID + 2))")
SERIALS=("$SERIAL1" "$SERIAL2" "$SERIAL3")
NAMES=("Морозилка 1" "Морозилка 2" "Зонд холодильника")
POWERS=("battery" "battery" "wired")
declare -A MQTT_USER MQTT_PASS

# Best effort cleanup for idempotent reruns.
for S in "${SERIALS[@]}"; do
  curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -X DELETE "$API_URL/api/v1/devices/$S" >/dev/null 2>&1 || true
done

for i in 0 1 2; do
  RESP=$(api -X POST "$API_URL/api/v1/devices/provision" \
    -d "{\"serial\":\"${SERIALS[$i]}\",\"displayName\":\"${NAMES[$i]}\",\"powerSource\":\"${POWERS[$i]}\"}" 2>/dev/null || echo '{"ok":false,"error":{"code":"REQUEST_FAILED"}}')

  OK=$(echo "$RESP" | jq -r '.ok' 2>/dev/null || echo "false")
  if [ "$OK" = "true" ]; then
    MQTT_USER[${SERIALS[$i]}]=$(echo "$RESP" | jq -r '.data.mqtt.username')
    MQTT_PASS[${SERIALS[$i]}]=$(echo "$RESP" | jq -r '.data.mqtt.password')
    check "Provisioned ${SERIALS[$i]}" true
  else
    ERR_CODE=$(echo "$RESP" | jq -r '.error.code // ""' 2>/dev/null || true)
    check "Provisioned ${SERIALS[$i]} (or already exists)" test "$ERR_CODE" = "DEVICE_ALREADY_PROVISIONED"
  fi
done

# --- 3. List devices ---
echo ""
echo "3. Verify device listing"
DEVICES=$(api "$API_URL/api/v1/devices")
DEV_COUNT=$(echo "$DEVICES" | jq '.data | length')
check "GET /devices returns >= 3 devices" test "$DEV_COUNT" -ge 3

for S in "${SERIALS[@]}"; do
  if echo "$DEVICES" | jq -e ".data[] | select(.serial == \"$S\")" >/dev/null 2>&1; then
    check "Device $S in list" true
  else
    check "Device $S in list" false
  fi
done

# --- 4. Get single device ---
echo ""
echo "4. Get single device"
DEV1=$(api "$API_URL/api/v1/devices/${SERIALS[0]}")
check "GET /devices/${SERIALS[0]} returns ok" test "$(echo "$DEV1" | jq -r '.ok')" = "true"
check "Has serial field" test "$(echo "$DEV1" | jq -r '.data.serial')" = "${SERIALS[0]}"
check "Has deviceType TH" test "$(echo "$DEV1" | jq -r '.data.deviceType')" = "TH"

# --- 5. Patch device ---
echo ""
echo "5. Patch device"
PATCHED=$(api -X PATCH "$API_URL/api/v1/devices/${SERIALS[0]}" \
  -d '{"displayName":"Морозилка Обновленная"}')
check "PATCH displayName" test "$(echo "$PATCHED" | jq -r '.ok')" = "true"

# --- 6. Create alert rule ---
echo ""
echo "6. Alert rules"
RULE=$(api -X POST "$API_URL/api/v1/devices/${SERIALS[0]}/alert-rules" \
  -d '{"metric":"temperature_c","operator":"gt","threshold":-15.0,"cooldownMinutes":1}')
check "Created alert rule" test "$(echo "$RULE" | jq -r '.ok')" = "true"
RULE_ID=$(echo "$RULE" | jq -r '.data.id')

RULES=$(api "$API_URL/api/v1/devices/${SERIALS[0]}/alert-rules")
check "GET alert-rules returns rule" test "$(echo "$RULES" | jq '.data | length')" -ge 1

# Validate metric vs capabilities
BAD_RULE=$(api -X POST "$API_URL/api/v1/devices/${SERIALS[2]}/alert-rules" \
  -d '{"metric":"humidity_pct","operator":"gt","threshold":80}' 2>/dev/null || echo '{"ok":false}')
check "Rejects humidity rule for TP device" test "$(echo "$BAD_RULE" | jq -r '.ok')" = "false"

# --- 7. Alert events ---
echo ""
echo "7. Alert events"
EVENTS=$(api "$API_URL/api/v1/alert-events?acknowledged=false")
check "GET /alert-events returns ok" test "$(echo "$EVENTS" | jq -r '.ok')" = "true"

# --- 8. Readings ---
echo ""
echo "8. Readings"
READINGS=$(api "$API_URL/api/v1/devices/${SERIALS[0]}/readings?limit=10")
check "GET /readings returns ok" test "$(echo "$READINGS" | jq -r '.ok')" = "true"

# --- 9. Audit log ---
echo ""
echo "9. Audit log"
AUDIT=$(api "$API_URL/api/v1/audit-log?limit=20")
check "GET /audit-log returns ok" test "$(echo "$AUDIT" | jq -r '.ok')" = "true"
AUDIT_COUNT=$(echo "$AUDIT" | jq '.data | length')
check "Audit log has entries" test "$AUDIT_COUNT" -gt 0
if echo "$AUDIT" | jq -e '.data[] | select(.action == "device.provisioned")' >/dev/null 2>&1; then
  check "Has device.provisioned action" true
else
  check "Has device.provisioned action" false
fi

# --- 10. 404 for unknown device ---
echo ""
echo "10. Error cases"
NOT_FOUND=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "$API_URL/api/v1/devices/SENS-XX-99999" 2>/dev/null || echo "000")
check "Unknown device returns 404" test "$NOT_FOUND" = "404"

# 401 without token
UNAUTH=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/v1/devices" 2>/dev/null || echo "000")
check "No token returns 401" test "$UNAUTH" = "401"

# Duplicate provision
DUP=$(api -X POST "$API_URL/api/v1/devices/provision" \
  -d "{\"serial\":\"${SERIALS[0]}\",\"powerSource\":\"battery\"}" 2>/dev/null || echo '409')
if echo "$DUP" | grep -q "ALREADY_PROVISIONED" || test "$DUP" = "409"; then
  check "Duplicate provision returns 409" true
else
  check "Duplicate provision returns 409" false
fi

# --- 11. Decommission ---
echo ""
echo "11. Decommission"
DECOM=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" -X DELETE "$API_URL/api/v1/devices/${SERIALS[2]}")
check "DELETE /devices/${SERIALS[2]} returns ok" test "$(echo "$DECOM" | jq -r '.ok')" = "true"

# Verify removed from list
DEVICES_AFTER=$(api "$API_URL/api/v1/devices")
if ! echo "$DEVICES_AFTER" | jq -e ".data[] | select(.serial == \"${SERIALS[2]}\")" >/dev/null 2>&1; then
  check "Decommissioned device not in list" true
else
  check "Decommissioned device not in list" false
fi

# --- 12. Swagger ---
echo ""
echo "12. Swagger"
check "Swagger UI accessible" curl -sf "$API_URL/api/docs" >/dev/null
if curl -sf "$API_URL/api/docs/json" | jq -e '.openapi' >/dev/null 2>&1; then
  check "OpenAPI JSON accessible" true
else
  check "OpenAPI JSON accessible" false
fi

# --- 13. Backup/Restore ---
echo ""
echo "13. Backup"
if [ -f scripts/backup.sh ]; then
  ./scripts/backup.sh 2>/dev/null && BACKUP_FILE=$(ls -t backup_*.sql 2>/dev/null | head -1)
  check "Backup created" test -n "$BACKUP_FILE" -a -s "$BACKUP_FILE"
  rm -f "$BACKUP_FILE" 2>/dev/null
else
  echo "  [SKIP] backup.sh not found"
fi

# --- Summary ---
echo ""
echo "==================================="
echo "Results: $PASS passed, $FAIL failed"
echo "==================================="

exit $FAIL
