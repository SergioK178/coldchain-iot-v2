#!/bin/bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: ./restore.sh <backup_file.sql>"
  exit 1
fi

if [ ! -f "$1" ]; then
  echo "Error: file $1 not found"
  exit 1
fi

docker compose exec -T db psql \
  -U "${DB_USER:-sensors}" \
  "${DB_NAME:-sensors}" < "$1"

echo "Restore from $1 complete"
