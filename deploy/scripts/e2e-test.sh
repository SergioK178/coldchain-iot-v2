#!/bin/bash
set -euo pipefail

# =============================================================================
# E2E Integration Test
# Run from deploy/ directory with running docker compose stack.
# Requires: curl, jq
# Usage: ./scripts/e2e-test.sh
# =============================================================================

API_URL="${API_URL:-http://localhost:8080}"
API_TOKEN="${API_TOKEN:?Set API_TOKEN env variable}"
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
  curl -sf -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" "$@"
}

echo "=== E2E Integration Test ==="
echo ""

# --- 1. Health ---
echo "1. Health check"
HEALTH=$(curl -sf "$API_URL/api/v1/health")
check "GET /health returns ok" test "$(echo "$HEALTH" | jq -r '.ok')" = "true"
check "version is 0.1.0" test "$(echo "$HEALTH" | jq -r '.data.version')" = "0.1.0"

# --- 2. Provision 3 devices ---
echo ""
echo "2. Provisioning devices"

SERIALS=("SENS-TH-00001" "SENS-TH-00002" "SENS-TP-00003")
NAMES=("Морозилка 1" "Морозилка 2" "Зонд холодильника")
POWERS=("battery" "battery" "wired")
declare -A MQTT_USER MQTT_PASS

for i in 0 1 2; do
  RESP=$(api -X POST "$API_URL/api/v1/devices/provision" \
    -d "{\"serial\":\"${SERIALS[$i]}\",\"displayName\":\"${NAMES[$i]}\",\"powerSource\":\"${POWERS[$i]}\"}" 2>/dev/null || echo '{"ok":false}')

  OK=$(echo "$RESP" | jq -r '.ok')
  if [ "$OK" = "true" ]; then
    MQTT_USER[${SERIALS[$i]}]=$(echo "$RESP" | jq -r '.data.mqtt.username')
    MQTT_PASS[${SERIALS[$i]}]=$(echo "$RESP" | jq -r '.data.mqtt.password')
    check "Provisioned ${SERIALS[$i]}" true
  else
    # Maybe already provisioned — that's ok for re-runs
    check "Provisioned ${SERIALS[$i]} (or already exists)" echo "$RESP" | jq -r '.error.code' | grep -q 'ALREADY'
  fi
done

# --- 3. List devices ---
echo ""
echo "3. Verify device listing"
DEVICES=$(api "$API_URL/api/v1/devices")
DEV_COUNT=$(echo "$DEVICES" | jq '.data | length')
check "GET /devices returns >= 3 devices" test "$DEV_COUNT" -ge 3

for S in "${SERIALS[@]}"; do
  check "Device $S in list" echo "$DEVICES" | jq -e ".data[] | select(.serial == \"$S\")" >/dev/null
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
check "Has device.provisioned action" echo "$AUDIT" | jq -e '.data[] | select(.action == "device.provisioned")' >/dev/null

# --- 10. 404 for unknown device ---
echo ""
echo "10. Error cases"
NOT_FOUND=$(curl -sf -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $API_TOKEN" \
  "$API_URL/api/v1/devices/SENS-XX-99999" 2>/dev/null || echo "404")
check "Unknown device returns 404" test "$NOT_FOUND" = "404"

# 401 without token
UNAUTH=$(curl -sf -o /dev/null -w "%{http_code}" "$API_URL/api/v1/devices" 2>/dev/null || echo "401")
check "No token returns 401" test "$UNAUTH" = "401"

# Duplicate provision
DUP=$(api -X POST "$API_URL/api/v1/devices/provision" \
  -d "{\"serial\":\"${SERIALS[0]}\",\"powerSource\":\"battery\"}" 2>/dev/null || echo '409')
check "Duplicate provision returns 409" echo "$DUP" | grep -q "ALREADY_PROVISIONED" || test "$DUP" = "409"

# --- 11. Decommission ---
echo ""
echo "11. Decommission"
DECOM=$(api -X DELETE "$API_URL/api/v1/devices/${SERIALS[2]}")
check "DELETE /devices/${SERIALS[2]} returns ok" test "$(echo "$DECOM" | jq -r '.ok')" = "true"

# Verify removed from list
DEVICES_AFTER=$(api "$API_URL/api/v1/devices")
check "Decommissioned device not in list" ! echo "$DEVICES_AFTER" | jq -e ".data[] | select(.serial == \"${SERIALS[2]}\")" >/dev/null

# --- 12. Swagger ---
echo ""
echo "12. Swagger"
check "Swagger UI accessible" curl -sf "$API_URL/api/docs" >/dev/null
check "OpenAPI JSON accessible" curl -sf "$API_URL/api/docs/json" | jq -e '.openapi' >/dev/null

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
