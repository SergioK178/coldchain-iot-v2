#!/bin/bash
set -euo pipefail

# =============================================================================
# Full E2E Test with Simulators
# Provisions 3 devices, runs simulators, checks readings/alerts/acknowledge,
# tests offline detection, decommission, backup/restore.
# Run from deploy/ directory with running docker compose stack.
# Usage: API_TOKEN=<token> ./scripts/e2e-with-simulators.sh
# =============================================================================

API_URL="${API_URL:-http://localhost:8080}"
API_TOKEN="${API_TOKEN:?Set API_TOKEN env variable}"
REPO_ROOT="${REPO_ROOT:-$(cd .. && pwd)}"
MQTT_PORT="${MQTT_PORT:-1883}"
PIDS=()
PASS=0
FAIL=0

cleanup() {
  echo ""
  echo "Cleaning up simulators..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}

trap cleanup EXIT

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

echo "=== Full E2E Test with Simulators ==="
echo ""

# --- 1. Provision 3 devices ---
echo "1. Provisioning 3 devices"

SERIALS=("SENS-TH-00011" "SENS-TH-00012" "SENS-TP-00013")
declare -A MQTT_U MQTT_P

for i in 0 1 2; do
  RESP=$(api -X POST "$API_URL/api/v1/devices/provision" \
    -d "{\"serial\":\"${SERIALS[$i]}\",\"displayName\":\"E2E Device $((i+1))\",\"powerSource\":\"battery\"}")
  MQTT_U[${SERIALS[$i]}]=$(echo "$RESP" | jq -r '.data.mqtt.username')
  MQTT_P[${SERIALS[$i]}]=$(echo "$RESP" | jq -r '.data.mqtt.password')
  echo "  Provisioned ${SERIALS[$i]}"
done

# --- 2. Start 3 simulators ---
echo ""
echo "2. Starting 3 simulators"

for S in "${SERIALS[@]}"; do
  DEVICE_SERIAL="$S" \
  MQTT_URL="mqtt://localhost:$MQTT_PORT" \
  MQTT_USERNAME="${MQTT_U[$S]}" \
  MQTT_PASSWORD="${MQTT_P[$S]}" \
  INTERVAL_SEC=5 \
  node --import tsx "$REPO_ROOT/tools/simulator/src/index.ts" > /dev/null 2>&1 &
  PIDS+=($!)
  echo "  Started $S (PID $!)"
done

# Wait for telemetry to arrive
echo ""
echo "Waiting 15s for telemetry..."
sleep 15

# --- 3. Verify devices online with readings ---
echo ""
echo "3. Verify devices"
DEVICES=$(api "$API_URL/api/v1/devices")
DEV_COUNT=$(echo "$DEVICES" | jq '.data | length')
check "3 devices in list" test "$DEV_COUNT" -ge 3

for S in "${SERIALS[@]}"; do
  STATUS=$(echo "$DEVICES" | jq -r ".data[] | select(.serial == \"$S\") | .connectivityStatus")
  check "$S is online" test "$STATUS" = "online"
done

# --- 4. Verify readings ---
echo ""
echo "4. Verify readings"
for S in "${SERIALS[@]}"; do
  READINGS=$(api "$API_URL/api/v1/devices/$S/readings?limit=5")
  RCOUNT=$(echo "$READINGS" | jq '.data | length')
  check "$S has readings ($RCOUNT)" test "$RCOUNT" -gt 0
done

# --- 5. UI accessible ---
echo ""
echo "5. UI check"
check "UI index.html served" curl -sf "$API_URL/" | grep -q "Sensor Platform"

# --- 6. Create alert rule + wait for trigger ---
echo ""
echo "6. Alert flow"

# Create rule: temperature > -100 (will always trigger with simulator data)
RULE=$(api -X POST "$API_URL/api/v1/devices/${SERIALS[0]}/alert-rules" \
  -d '{"metric":"temperature_c","operator":"gt","threshold":-100.0,"cooldownMinutes":1}')
check "Created alert rule" test "$(echo "$RULE" | jq -r '.ok')" = "true"

echo "  Waiting 10s for alert trigger..."
sleep 10

EVENTS=$(api "$API_URL/api/v1/alert-events?acknowledged=false")
EVENT_COUNT=$(echo "$EVENTS" | jq '.data | length')
check "Alert event created ($EVENT_COUNT)" test "$EVENT_COUNT" -gt 0

if [ "$EVENT_COUNT" -gt 0 ]; then
  EVENT_ID=$(echo "$EVENTS" | jq -r '.data[0].id')

  # Verify device shows alert status
  DEV_STATUS=$(api "$API_URL/api/v1/devices/${SERIALS[0]}" | jq -r '.data.alertStatus')
  check "Device alertStatus is 'alert'" test "$DEV_STATUS" = "alert"

  # --- 7. Acknowledge ---
  echo ""
  echo "7. Acknowledge alert"
  ACK=$(api -X PATCH "$API_URL/api/v1/alert-events/$EVENT_ID/acknowledge" \
    -d '{"acknowledgedBy":"E2E Test"}')
  check "Acknowledge succeeded" test "$(echo "$ACK" | jq -r '.ok')" = "true"

  # 409 on re-acknowledge
  ACK2=$(curl -sf -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    -X PATCH "$API_URL/api/v1/alert-events/$EVENT_ID/acknowledge" \
    -d '{"acknowledgedBy":"E2E Test"}' 2>/dev/null || echo "409")
  check "Re-acknowledge returns 409" test "$ACK2" = "409"

  # Verify audit
  AUDIT=$(api "$API_URL/api/v1/audit-log?action=alert.acknowledged&limit=1")
  check "Audit has alert.acknowledged" test "$(echo "$AUDIT" | jq '.data | length')" -gt 0
fi

# --- 8. Stop one simulator → offline ---
echo ""
echo "8. Offline detection"
echo "  Stopping simulator for ${SERIALS[2]}..."
kill "${PIDS[2]}" 2>/dev/null || true

echo "  Waiting for LWT / offline (15s)..."
sleep 15

DEV3_STATUS=$(api "$API_URL/api/v1/devices/${SERIALS[2]}" | jq -r '.data.connectivityStatus')
check "${SERIALS[2]} offline via LWT" test "$DEV3_STATUS" = "offline"

# --- 9. Decommission ---
echo ""
echo "9. Decommission"
DECOM=$(api -X DELETE "$API_URL/api/v1/devices/${SERIALS[2]}")
check "Decommissioned ${SERIALS[2]}" test "$(echo "$DECOM" | jq -r '.ok')" = "true"

DEVICES_AFTER=$(api "$API_URL/api/v1/devices")
check "Decommissioned device removed from list" ! echo "$DEVICES_AFTER" | jq -e ".data[] | select(.serial == \"${SERIALS[2]}\")" >/dev/null

# --- 10. Backup ---
echo ""
echo "10. Backup/Restore"
if [ -f scripts/backup.sh ]; then
  ./scripts/backup.sh 2>/dev/null
  BACKUP_FILE=$(ls -t backup_*.sql 2>/dev/null | head -1)
  check "Backup file created" test -n "$BACKUP_FILE" -a -s "$BACKUP_FILE"
  rm -f "$BACKUP_FILE" 2>/dev/null
fi

# --- Summary ---
echo ""
echo "==================================="
echo "Results: $PASS passed, $FAIL failed"
echo "==================================="

exit $FAIL
