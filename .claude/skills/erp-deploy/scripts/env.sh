#!/usr/bin/env bash
# Carrega as variáveis ERP_* e CRM_* do .env da raiz do repositório.
# Uso: source .claude/skills/erp-deploy/scripts/env.sh
#
# Lê só essas chaves (as VITE_* ficam de fora) e não usa `source .env`:
# um valor com espaço ou aspas quebraria o shell. Nada é impresso.
_raiz="$(git -C "$(dirname "${BASH_SOURCE[0]:-$0}")" rev-parse --show-toplevel 2>/dev/null)"
_env="${_raiz:-.}/.env"
if [ ! -f "$_env" ]; then
  echo "env.sh: $_env não existe — copie .env.example para .env e preencha." >&2
  return 1 2>/dev/null || exit 1
fi
while IFS= read -r _linha; do
  case "$_linha" in
    ERP_*=*|CRM_*=*)
      _chave="${_linha%%=*}"
      _valor="${_linha#*=}"
      _valor="${_valor%%[[:space:]]#*}"          # comentário no fim da linha
      _valor="${_valor%"${_valor##*[![:space:]]}"}" # espaços à direita
      export "$_chave=$_valor"
      ;;
  esac
done < "$_env"
unset _raiz _env _linha _chave _valor
