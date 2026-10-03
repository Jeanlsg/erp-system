#!/usr/bin/env bash
# Mostra, SÓ LENDO, o que está publicado na VPS: container do front, commit
# que o EasyPanel construiu, e se edge functions e nfe-service batem com o repo.
# Uso: bash .claude/skills/erp-deploy/scripts/verificar-deploy.sh
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
source .claude/skills/erp-deploy/scripts/env.sh || exit 1

echo "== local: $(git log -1 --format='%h %s')  (origin/main: $(git rev-parse --short origin/main 2>/dev/null))"
ssh -o ConnectTimeout=15 "$ERP_SSH_HOST" "
  echo '== front (container e commit construído)'
  docker ps --filter name=${ERP_APP_SERVICE}. --format '   {{.Names}} · {{.Status}}'
  cd '$ERP_APP_CODE_DIR' 2>/dev/null && echo \"   commit: \$(git log -1 --format='%h %s')\"
  echo '== nfe-service'
  docker ps --filter name=$ERP_NFE_SERVICE_CONTAINER --format '   {{.Names}} · {{.Status}}'
  echo \"   index.php na VPS: \$(md5sum '$ERP_NFE_SERVICE_DIR/src/index.php' | cut -c1-32)\"
"
echo "   index.php local:  $(md5 -q services/nfe-service/src/index.php 2>/dev/null || md5sum services/nfe-service/src/index.php | cut -c1-32)"

echo "== edge functions erp-* (repo × VPS)"
# todos os .ts da função (menos testes): função com mais de um arquivo
# precisa de todos lá, senão cai com "module not found"
for d in supabase/functions/erp-*/; do
  f="$(basename "$d")"
  for a in "$d"*.ts; do
    case "$a" in *.test.ts) continue;; esac
    n="$(basename "$a")"
    l="$(md5 -q "$a" 2>/dev/null || md5sum "$a" | cut -c1-32)"
    r="$(ssh -o ConnectTimeout=15 "$ERP_SSH_HOST" "md5sum '$ERP_FUNCTIONS_DIR/$f/$n' 2>/dev/null | cut -c1-32")"
    rot="$f"; [ "$n" = "index.ts" ] || rot="$f/$n"
    if [ "$l" = "$r" ]; then echo "   igual      $rot"; elif [ -z "$r" ]; then echo "   FALTA      $rot"; else echo "   DIFERENTE  $rot"; fi
  done
done
