#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "${BACKUP_DIR}"

echo "=== TenantFloe Backup — ${TIMESTAMP} ==="

# PostgreSQL
docker compose exec -T postgres pg_dump -U ac tenantfloe \
  | gzip > "${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"
echo "✓ Database backup: ${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"

# Redis
docker compose exec redis redis-cli BGSAVE
sleep 2
docker compose cp redis:/data/dump.rdb "${BACKUP_DIR}/redis_${TIMESTAMP}.rdb"
echo "✓ Redis backup: ${BACKUP_DIR}/redis_${TIMESTAMP}.rdb"

# Rotate backups older than 30 days
find "${BACKUP_DIR}" -name "*.gz" -mtime +30 -delete
find "${BACKUP_DIR}" -name "*.rdb" -mtime +30 -delete
echo "✓ Old backups pruned"
