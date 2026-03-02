#!/bin/bash
set -euo pipefail

BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"

docker compose exec -T db pg_dump \
  -U "${DB_USER:-sensors}" \
  "${DB_NAME:-sensors}" > "$BACKUP_FILE"

echo "Backup saved to $BACKUP_FILE"
