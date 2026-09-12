#!/usr/bin/env bash
# ============================================================
# Backup diário COMPLETO do cluster Postgres (Supabase self-hosted).
#
# Instalado em /opt/backups/backup-diario.sh na VPS xlifevps, via cron:
#   30 3 * * * /opt/backups/backup-diario.sh >> /opt/backups/backup.log 2>&1
#
# Gera três arquivos por dia e mantém 14 dias:
#   globals-AAAAMMDD.sql     roles do cluster + hashes de senha
#   postgres-AAAAMMDD.dump   banco principal, TODOS os schemas
#   supabase-AAAAMMDD.dump   banco _supabase (analytics/pooler)
#
# POR QUE NÃO É MAIS SÓ `--schema=erp --schema=public`:
# o dump anterior pegava dois schemas e NÃO restaurava. As tabelas usam
# `extensions.uuid_generate_v4()` como default e têm FK para `auth.users`,
# então um restore num banco vazio falhava com ~830 erros e trazia 36 das
# 90 tabelas de `erp` — sem avisar. Pior: `auth` ficava de fora, ou seja,
# o backup não continha nenhum login. Servia para recuperar dados, não a
# instância. Descoberto em 12/09/2026 ao ensaiar a virada num clone.
#
# COMO RESTAURAR: veja scripts/RESTAURAR-BACKUP.md (procedimento testado).
# ============================================================
set -euo pipefail

DEST=/opt/backups
DIA=$(date +%Y%m%d)
DB=$(docker ps -qf name=supabase-db | head -1)

if [ -z "$DB" ]; then
  echo "$(date -Is) ERRO: container do banco não encontrado — backup NÃO foi feito"
  exit 1
fi

# globals carrega hash de senha: os arquivos nascem legíveis só pelo root
umask 077

# ---- 1. globals do cluster (roles, permissões, senhas) ----
# Sem isto, um restore sobe o banco sem nenhum login e sem as roles que o
# PostgREST/GoTrue esperam (authenticator, anon, authenticated, service_role…).
docker exec "$DB" pg_dumpall -U supabase_admin --globals-only \
  > "$DEST/globals-$DIA.sql.tmp"
mv "$DEST/globals-$DIA.sql.tmp" "$DEST/globals-$DIA.sql"

# ---- 2. banco principal, todos os schemas ----
# erp, public, auth, storage, vault, extensions, graphql, realtime,
# supabase_functions, cron, net.
docker exec "$DB" pg_dump -U supabase_admin -d postgres -Fc \
  > "$DEST/postgres-$DIA.dump.tmp"
mv "$DEST/postgres-$DIA.dump.tmp" "$DEST/postgres-$DIA.dump"

# ---- 3. banco _supabase (analytics do Logflare + estado do Supavisor) ----
# A stack recria se faltar, mas restaurar junto evita reconfiguração manual.
docker exec "$DB" pg_dump -U supabase_admin -d _supabase -Fc \
  > "$DEST/supabase-$DIA.dump.tmp"
mv "$DEST/supabase-$DIA.dump.tmp" "$DEST/supabase-$DIA.dump"

# ---- 4. conferência: um dump truncado é ilegível, e um backup que nunca
#         foi lido não é backup. `pg_restore -l` abre o índice do arquivo. ----
OBJ=$(docker exec -i "$DB" pg_restore -l < "$DEST/postgres-$DIA.dump" | grep -c ';' || true)
if [ "$OBJ" -lt 500 ]; then
  echo "$(date -Is) ERRO: postgres-$DIA.dump tem só $OBJ objetos (esperado >500) — dump suspeito"
  exit 1
fi

# ---- 5. rotação: 14 dias, inclusive o padrão antigo, que some sozinho ----
find "$DEST" -name 'postgres-*.dump' -mtime +14 -delete
find "$DEST" -name 'supabase-*.dump' -mtime +14 -delete
find "$DEST" -name 'globals-*.sql'   -mtime +14 -delete
find "$DEST" -name 'erp-*.dump'      -mtime +14 -delete

echo "$(date -Is) backup ok: postgres-$DIA.dump ($(du -h "$DEST/postgres-$DIA.dump" | cut -f1), $OBJ objetos)" \
  "+ supabase-$DIA.dump ($(du -h "$DEST/supabase-$DIA.dump" | cut -f1))" \
  "+ globals-$DIA.sql ($(du -h "$DEST/globals-$DIA.sql" | cut -f1))"
