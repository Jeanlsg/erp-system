#!/usr/bin/env bash
###############################################################################
# Wrapper simplificado usando Supabase CLI (se instalado)
#
# Instalação:
#   npm install -g supabase
#   supabase login
#   supabase link --project-ref SEU_PROJECT_REF
#
# Uso:
#   ./scripts/db-push.sh
###############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔄 Sincronizando migrations com Supabase..."

# Se Supabase CLI estiver instalado, usa o comando oficial
if command -v supabase &> /dev/null; then
  cd "$PROJECT_ROOT"
  supabase db push
  exit 0
fi

# Fallback: usa o script genérico
echo "⚠️  Supabase CLI não encontrado. Usando script genérico..."
exec "$SCRIPT_DIR/apply-migrations.sh"