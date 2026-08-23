#!/usr/bin/env bash
# ============================================================
# Backup diário do banco (schemas erp + public) com rotação.
# Instalado em /opt/backups/backup-diario.sh na VPS, via cron:
#   30 3 * * * /opt/backups/backup-diario.sh >> /opt/backups/backup.log 2>&1
# Mantém 14 dias. Restauração:
#   docker exec -i $(docker ps -qf name=supabase-db) \
#     pg_restore -U supabase_admin -d postgres --clean --if-exists <arquivo>
# ============================================================
set -euo pipefail
DEST=/opt/backups
DIA=$(date +%Y%m%d)
DB=$(docker ps -qf name=supabase-db)

docker exec "$DB" pg_dump -U supabase_admin -d postgres -Fc \
  --schema=erp --schema=public > "$DEST/erp-$DIA.dump.tmp"
mv "$DEST/erp-$DIA.dump.tmp" "$DEST/erp-$DIA.dump"

# rotação: apaga dumps com mais de 14 dias
find "$DEST" -name 'erp-*.dump' -mtime +14 -delete

echo "$(date -Is) backup ok: erp-$DIA.dump ($(du -h "$DEST/erp-$DIA.dump" | cut -f1))"
