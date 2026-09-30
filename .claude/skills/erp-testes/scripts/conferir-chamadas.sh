#!/usr/bin/env bash
# Confere, SÓ LENDO, se tudo que o front chama existe no servidor:
#   .rpc('x')              → função no schema erp
#   .from('x')             → tabela/view no schema erp (buckets de storage aparecem como "fora")
#   functions.invoke('x')  → pasta publicada em ERP_FUNCTIONS_DIR
# Botão que chama coisa inexistente falha só na hora do clique; isto acha antes.
# Uso: bash .claude/skills/erp-testes/scripts/conferir-chamadas.sh
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
source .claude/skills/erp-deploy/scripts/env.sh || exit 1
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

grep -rhoE "\.rpc\(\s*['\"][a-z_0-9]+['\"]" src | grep -oE "['\"][a-z_0-9]+['\"]" | tr -d "'\"" | sort -u > "$tmp/rpc"
grep -rhoE "\.from\(\s*['\"][a-z_0-9]+['\"]" src | grep -oE "['\"][a-z_0-9]+['\"]" | tr -d "'\"" | sort -u > "$tmp/from"
grep -rhoE "functions\.invoke(<[^>]*>)?\(\s*['\"][a-z_0-9-]+['\"]" src | grep -oE "['\"][a-z_0-9-]+['\"]" | tr -d "'\"" | sort -u > "$tmp/fn"

ssh -o ConnectTimeout=15 "$ERP_SSH_HOST" "docker exec -i $ERP_DB_CONTAINER psql -U supabase_admin -d postgres -At" > "$tmp/db" <<'SQL'
SELECT 'F|' || p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'erp';
SELECT 'T|' || table_name FROM information_schema.tables WHERE table_schema = 'erp';
SQL
ssh -o ConnectTimeout=15 "$ERP_SSH_HOST" "ls '$ERP_FUNCTIONS_DIR'" > "$tmp/fnvps"

echo "front chama: $(wc -l < "$tmp/rpc") RPCs · $(wc -l < "$tmp/from") tabelas/views · $(wc -l < "$tmp/fn") edge functions"
falta=0
echo "-- RPCs ausentes no schema erp:";          while read -r x; do grep -qx "F|$x" "$tmp/db" || { echo "   $x"; falta=1; }; done < "$tmp/rpc"
echo "-- tabelas/views ausentes (buckets de storage aparecem aqui):"; while read -r x; do grep -qx "T|$x" "$tmp/db" || echo "   $x"; done < "$tmp/from"
echo "-- edge functions não publicadas:";        while read -r x; do grep -qx "$x" "$tmp/fnvps" || { echo "   $x"; falta=1; }; done < "$tmp/fn"
[ "$falta" = 0 ] && echo "OK: nenhuma RPC ou edge function faltando."
