#!/bin/bash
set -euo pipefail

# =============================================================================
# Smoke Load Test
# Provisions 10 devices, runs 10 simulators at 10-second intervals.
# Monitors for errors and memory growth.
# Run from deploy/ directory with running docker compose stack.
# Requires: curl, jq, and tools/simulator available via pnpm.
# Usage: ./scripts/smoke-load.sh
# Duration: ~2 minutes, then cleanup.
# =============================================================================

API_URL="${API_URL:-http://localhost:8080}"
ADMIN_EMAIL="${ADMIN_EMAIL:?Set ADMIN_EMAIL env variable}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?Set ADMIN_PASSWORD env variable}"
REPO_ROOT="${REPO_ROOT:-$(cd .. && pwd)}"
DURATION_SEC="${DURATION_SEC:-120}"
INTERVAL_SEC=10
NUM_DEVICES=10

PIDS=()

cleanup() {
  echo ""
  echo "Stopping simulators..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  echo "All simulators stopped."
}

trap cleanup EXIT

api() {
  curl -sf -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" "$@"
}

echo "=== Smoke Load Test ==="
echo "Devices: $NUM_DEVICES, Interval: ${INTERVAL_SEC}s, Duration: ${DURATION_SEC}s"
echo ""

LOGIN=$(curl -sf -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ACCESS_TOKEN=$(echo "$LOGIN" | jq -r '.data.accessToken')
if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
  echo "[FATAL] Failed to get JWT access token via /auth/login"
  exit 1
fi

# --- Provision devices ---
echo "Provisioning $NUM_DEVICES devices..."
declare -A USERS PASSWORDS

for i in $(seq -w 1 $NUM_DEVICES); do
  SERIAL="SENS-TH-100${i}"
  RESP=$(api -X POST "$API_URL/api/v1/devices/provision" \
    -d "{\"serial\":\"$SERIAL\",\"displayName\":\"Load Test $i\",\"powerSource\":\"battery\"}" 2>/dev/null || echo '{"ok":false}')

  if [ "$(echo "$RESP" | jq -r '.ok')" = "true" ]; then
    USERS[$SERIAL]=$(echo "$RESP" | jq -r '.data.mqtt.username')
    PASSWORDS[$SERIAL]=$(echo "$RESP" | jq -r '.data.mqtt.password')
    echo "  Provisioned $SERIAL"
  else
    echo "  Skip $SERIAL (already exists or error)"
  fi
done

# --- Start simulators ---
echo ""
echo "Starting $NUM_DEVICES simulators..."

for SERIAL in "${!USERS[@]}"; do
  DEVICE_SERIAL="$SERIAL" \
  MQTT_URL="mqtt://localhost:${MQTT_PORT:-1883}" \
  MQTT_USERNAME="${USERS[$SERIAL]}" \
  MQTT_PASSWORD="${PASSWORDS[$SERIAL]}" \
  INTERVAL_SEC="$INTERVAL_SEC" \
  node --import tsx "$REPO_ROOT/tools/simulator/src/index.ts" > /dev/null 2>&1 &
  PIDS+=($!)
  echo "  Started simulator for $SERIAL (PID $!)"
done

echo ""
echo "Running for ${DURATION_SEC}s..."

# --- Monitor ---
START_TIME=$(date +%s)
ERRORS=0

while true; do
  ELAPSED=$(( $(date +%s) - START_TIME ))
  if [ "$ELAPSED" -ge "$DURATION_SEC" ]; then
    break
  fi

  sleep 15

  # Check health
  HEALTH=$(curl -sf "$API_URL/api/v1/health" 2>/dev/null || echo '{"ok":false}')
  if [ "$(echo "$HEALTH" | jq -r '.ok')" != "true" ]; then
    echo "  [ERROR] Health check failed at ${ELAPSED}s"
    ERRORS=$((ERRORS + 1))
  fi

  # Check devices
  DEVICES=$(api "$API_URL/api/v1/devices" 2>/dev/null || echo '{"ok":false}')
  ONLINE=$(echo "$DEVICES" | jq '[.data[] | select(.connectivityStatus == "online")] | length' 2>/dev/null || echo 0)
  echo "  [${ELAPSED}s] Health: ok, Online devices: $ONLINE"

  # Check container stats
  SERVER_MEM=$(docker stats --no-stream --format "{{.MemUsage}}" $(docker compose ps -q server 2>/dev/null) 2>/dev/null || echo "N/A")
  echo "  [${ELAPSED}s] Server memory: $SERVER_MEM"
done

# --- Final check ---
echo ""
echo "Final verification..."

HEALTH=$(curl -sf "$API_URL/api/v1/health" 2>/dev/null || echo '{"ok":false}')
if [ "$(echo "$HEALTH" | jq -r '.ok')" = "true" ]; then
  echo "  [PASS] Server healthy after load"
else
  echo "  [FAIL] Server unhealthy after load"
  ERRORS=$((ERRORS + 1))
fi

DEVICES=$(api "$API_URL/api/v1/devices" 2>/dev/null || echo '{"data":[]}')
TOTAL=$(echo "$DEVICES" | jq '.data | length')
echo "  Total devices: $TOTAL"

# Check readings exist
READINGS=$(api "$API_URL/api/v1/devices/SENS-TH-10001/readings?limit=5" 2>/dev/null || echo '{"data":[]}')
RCOUNT=$(echo "$READINGS" | jq '.data | length')
echo "  Readings for first device: $RCOUNT"

# Check server logs for errors
echo ""
echo "Server error log (last 20 lines with 'error'):"
docker compose logs server --tail=100 2>/dev/null | grep -i error | tail -20 || echo "  (none)"

echo ""
echo "==================================="
if [ "$ERRORS" -eq 0 ]; then
  echo "Smoke test PASSED"
else
  echo "Smoke test: $ERRORS errors detected"
fi
echo "==================================="

exit $ERRORS
