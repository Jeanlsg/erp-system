#!/usr/bin/env bash
# Auditoria heurística de logout: onde se sai, o que fica guardado no navegador,
# o que é limpo e quais chaves de identidade não levam o id do usuário.
# Uso: bash auditar-logout.sh [repo]   (padrão: diretório atual)
# Não prova nada sozinho: cada item é um lugar para LER.
set -u
R="${1:-.}"
cd "$R" || exit 1

EXCL=(--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=.next
      --exclude-dir=.nuxt --exclude-dir=.output --exclude-dir=coverage --exclude-dir=.git
      --exclude-dir=.claude --exclude-dir=vendor --exclude-dir=android --exclude-dir=ios)
INC=(--include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs'
     --include='*.vue' --include='*.svelte' --include='*.dart')
SRC=()
for d in src app lib pages components public packages apps; do [ -d "$d" ] && SRC+=("$d"); done
[ ${#SRC[@]} -eq 0 ] && SRC=(.)

g() { grep -rnE "${EXCL[@]}" "${INC[@]}" "$@" "${SRC[@]}" 2>/dev/null | grep -vE '\.(test|spec)\.' ; }
secao() { printf '\n=== %s ===\n' "$1"; }

secao "1. Onde se sai (definições e chamadas)"
g '(function|const|async)[[:space:]]+(logout|signOut|signout|sair|deslogar|handleLogout)\b|\b(logout|signOut|sair|deslogar)[[:space:]]*\(' | head -60

secao "1b. Saída seguida de navegação sem esperar a limpeza (até 3 linhas depois)"
g -A3 '\b(logout|signOut|sair|deslogar)[[:space:]]*\(' | awk '
  /^--$/ { bloco=""; chamada=0; next }
  { bloco = bloco $0 "\n" }
  # awk do macOS não tem \b: fronteira à mão
  /(^|[^A-Za-z_.])(logout|signOut|sair|deslogar)[[:space:]]*\(|\.(logout|signOut)[[:space:]]*\(/ && !/await|function|export|=>[[:space:]]*\{[[:space:]]*$/ { chamada=1 }
  chamada && /navigate\(|router\.(push|replace)|location\.(href|replace|assign)|redirect\(/ { printf "%s--\n", bloco; chamada=0 }
' | head -40

secao "2. O que persiste no navegador"
g 'persistQueryClient|PersistQueryClientProvider|create(Sync|Async)StoragePersister|persistStore|redux-persist|apollo3-cache-persist|persistCache|\bpersist\(|localStorage\.setItem|sessionStorage\.setItem|indexedDB\.open|localforage|new Dexie|openDB\(|caches\.open|AsyncStorage\.setItem|MMKV|SecureStore\.setItem|document\.cookie[[:space:]]*=' | head -80

secao "3. O que é limpo hoje"
g 'queryClient\.(clear|removeQueries|resetQueries|cancelQueries)|clearStore\(|resetStore\(|resetApiState|\.purge\(|persist\.clearStorage|clearStorage\(|localStorage\.(clear|removeItem)|sessionStorage\.(clear|removeItem)|deleteDatabase|\.clear\(\)|caches\.delete|AsyncStorage\.(clear|multiRemove|removeItem)|removeClient' | head -60

secao "4. Chaves de consulta de identidade/permissão SEM variável (só literais)"
TOK='(me|eu|users?|usuarios?|perfil|profile|permiss(ao|oes|ions?)|papel|papeis|roles?|admin|session|sessao|current|menu|paginas?|whoami)'
g "queryKey:[[:space:]]*\[[[:space:]]*['\"]([^'\"]*[_./-])?${TOK}([_./-][^'\"]*)?['\"][[:space:]]*\]" \
  | grep -vE 'invalidateQueries|removeQueries|refetchQueries|cancelQueries|setQueryData|getQueryData|resetQueries' | head -40
g "useSWR\([[:space:]]*['\"]([^'\"]*[_./-])?${TOK}([_./-][^'\"]*)?['\"]" | head -20
echo "(lista comum que depende da RLS, como 'usuarios', é coberta pela limpeza; o risco é a resposta"
echo " sobre QUEM está logado — 'sou admin?', 'minhas permissões', 'meu menu' — sem o id na chave)"

secao "5. Vigia de sessão"
g 'onAuthStateChange|onAuthStateChanged|onIdTokenChanged|BroadcastChannel|addEventListener\([[:space:]]*["'"'"']storage' | head -20

secao "6. Service worker: cache.put de algo que não é asset?"
for f in $(grep -rlE "${EXCL[@]}" "addEventListener\([[:space:]]*['\"]fetch" . 2>/dev/null); do
  echo "-- $f"; grep -nE 'cache\.put|\.put\(|caches\.match|origin|/api|supabase|graphql' "$f" | head -20
done

secao "Leitura"
cat <<'TXT'
- Toda linha da seção 2 precisa de um par na 3, dentro da função de saída (ou ser exceção
  documentada: fila não enviada, preferência do aparelho, chave do aparelho).
- A função de saída precisa: await signOut (com try/catch) -> limpeza -> só então navegar.
- O login precisa chamar a mesma limpeza.
- Seção 4 vazia, ou cada chave ali justificada.
- Seção 5 vazia = sessão expirada ou logout em outra aba não limpam nada.
TXT
