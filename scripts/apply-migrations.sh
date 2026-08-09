#!/usr/bin/env bash
###############################################################################
# Script para aplicar migrations no Supabase automaticamente
#
# Uso:
#   ./scripts/apply-migrations.sh "postgresql://postgres:SENHA@host:5432/postgres"
#
# Ou defina DATABASE_URL no .env e rode:
#   ./scripts/apply-migrations.sh
###############################################################################

set -e  # Para se qualquer comando falhar

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Pegar DATABASE_URL do argumento ou .env
if [ -n "$1" ]; then
  DATABASE_URL="$1"
elif [ -f .env ]; then
  source <(grep -E '^DATABASE_URL=' .env | sed 's/^export //')
fi

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ DATABASE_URL não definida${NC}"
  echo "Uso: $0 'postgresql://postgres:SENHA@db.PROJETO.supabase.co:5432/postgres'"
  echo "Ou defina DATABASE_URL=... no .env"
  exit 1
fi

# Verificar se psql está instalado
if ! command -v psql &> /dev/null; then
  echo -e "${RED}❌ psql não encontrado. Instale PostgreSQL client.${NC}"
  echo "Ubuntu/Debian: sudo apt install postgresql-client"
  echo "macOS: brew install libpq"
  exit 1
fi

# Diretório de migrations
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../supabase/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo -e "${RED}❌ Diretório não encontrado: $MIGRATIONS_DIR${NC}"
  exit 1
fi

echo -e "${BLUE}🚀 Aplicador de Migrations${NC}"
echo -e "${BLUE}=====================================${NC}"
echo -e "📡 URL: ${DATABASE_URL%%@*}@***"
echo ""

# Listar migrations
MIGRATIONS=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort)
if [ -z "$MIGRATIONS" ]; then
  echo -e "${RED}❌ Nenhuma migration encontrada em $MIGRATIONS_DIR${NC}"
  exit 1
fi

TOTAL=$(echo "$MIGRATIONS" | wc -l)
CURRENT=0

for migration in $MIGRATIONS; do
  CURRENT=$((CURRENT + 1))
  filename=$(basename "$migration")
  
  echo -e "${YELLOW}[$CURRENT/$TOTAL]${NC} Aplicando: ${BLUE}$filename${NC}"
  
  if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration" > /tmp/migration_output.log 2>&1; then
    echo -e "  ${GREEN}✓ OK${NC}"
  else
    echo -e "  ${RED}✗ FALHOU${NC}"
    echo -e "${RED}Erros:${NC}"
    tail -20 /tmp/migration_output.log
    exit 1
  fi
done

echo ""
echo -e "${GREEN}✅ Todas as migrations foram aplicadas com sucesso!${NC}"
echo -e "Total: $TOTAL migrations"