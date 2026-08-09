#!/usr/bin/env bash
# =============================================================================
# supabase/gen-env.sh
# -----------------------------------------------------------------------------
# Gera o arquivo `.env` do stack Supabase self-hosted definido em
# supabase/docker-compose.yml. Todas as variáveis referenciadas pelo compose
# são preenchidas — segredos gerados via openssl; domínios/SMTP entram por CLI.
#
# Uso:
#   ./supabase/gen-env.sh <dominio-supabase> <dominio-crm> [dominio_resend]
#
# Configuração SMTP (Resend):
#   export RESEND_API_KEY="re_xxxxx"
#   export RESEND_DOMAIN="seudominio.com.br"
#   export RESEND_SENDER_NAME="Nome do Remetente"
#
# Saída:
#   supabase/.env.<dominio_resend>-supabase   (chmod 600 — guarde em local seguro)
#
# NUNCA reaproveite os secrets de outra instância.
# Requer: bash, openssl, python3 (assinatura HS256 dos JWTs).
# =============================================================================
set -euo pipefail

usage() { echo "uso: $0 <dominio-supabase> <dominio-crm> [dominio_resend]" >&2; exit 1; }
[[ $# -ge 2 ]] || usage

SUPABASE_DOMAIN="$1"
CRM_DOMAIN="$2"
DOMINIO_RESEND="${3:-${CRM_DOMAIN_RAW}}"
TENANT_ID="$DOMINIO_RESEND"

# Remove "https://" se já vier na URL para evitar duplicação
normalize_url() {
    echo "$1" | sed -E 's|^https?://||'
}

SUPABASE_DOMAIN_RAW="$(normalize_url "$SUPABASE_DOMAIN")"
CRM_DOMAIN_RAW="$(normalize_url "$CRM_DOMAIN")"

# Nome do arquivo: .env.<dominio_resend>-supabase
ENV_FILENAME=".env.${DOMINIO_RESEND}-supabase"
[[ -e "$ENV_FILENAME" ]] && { echo "!! $ENV_FILENAME já existe — apague antes de regenerar"; exit 2; }

need() { command -v "$1" >/dev/null 2>&1 || { echo "!! faltando: $1"; exit 3; }; }
need openssl; need python3

# --- Configuração SMTP Resend -----------------------------------------------
# Se não definir as variáveis, usa valores placeholder
RESEND_API_KEY="${RESEND_API_KEY:-}"
RESEND_DOMAIN="${RESEND_DOMAIN:-${DOMINIO_RESEND}}"
RESEND_SENDER_NAME="${RESEND_SENDER_NAME:-${DOMINIO_RESEND} CRM}"
RESEND_SENDER_EMAIL="${RESEND_SENDER_EMAIL:-noreply@${RESEND_DOMAIN}}"

if [[ -n "$RESEND_API_KEY" ]]; then
    echo "✓ SMTP Resend configurado: $RESEND_SENDER_EMAIL"
else
    echo "⚠ SMTP não configurado — defina RESEND_API_KEY, RESEND_DOMAIN e RESEND_SENDER_NAME"
fi

rand_hex()    { openssl rand -hex "${1:-32}"; }
rand_base64() { openssl rand -base64 "${1:-32}" | tr -d '\n=+/' | cut -c1-"${2:-32}"; }

JWT_SECRET="$(rand_hex 32)"
POSTGRES_PASSWORD="$(rand_base64 32 32)"
DASHBOARD_PASSWORD="$(rand_base64 24 24)"
SECRET_KEY_BASE="$(rand_hex 32)"
VAULT_ENC_KEY="$(rand_hex 16)"
LOGFLARE_PUBLIC_ACCESS_TOKEN="$(rand_hex 32)"
LOGFLARE_PRIVATE_ACCESS_TOKEN="$(rand_hex 32)"
POOLER_TENANT_ID="$(rand_hex 8)"

JWT_KEYS=$(python3 - "$JWT_SECRET" "$TENANT_ID" <<'PYEOF'
import base64, hmac, hashlib, json, sys, time
secret, ref = sys.argv[1], sys.argv[2]
def b64(x): return base64.urlsafe_b64encode(x).rstrip(b"=").decode()
def sign(payload):
    h = b64(json.dumps({"alg":"HS256","typ":"JWT"}, separators=(",",":")).encode())
    b = b64(json.dumps(payload, separators=(",",":")).encode())
    msg = f"{h}.{b}".encode()
    s = b64(hmac.new(secret.encode(), msg, hashlib.sha256).digest())
    return f"{h}.{b}.{s}"
now = int(time.time()); exp = now + 60*60*24*365*10
print(sign({"iss":"supabase","ref":ref,"role":"anon","iat":now,"exp":exp}),
      sign({"iss":"supabase","ref":ref,"role":"service_role","iat":now,"exp":exp}))
PYEOF
)
ANON_KEY=$(echo "$JWT_KEYS" | awk '{print $1}')
SERVICE_ROLE_KEY=$(echo "$JWT_KEYS" | awk '{print $2}')

# --- Variáveis extras -------------------------------------------------------
GLOBAL_S3_BUCKET="${TENANT_ID}-storage"
STORAGE_TENANT_ID="$(rand_hex 8)"
REGION="local"
PG_META_CRYPTO_KEY="$(rand_hex 32)"
IMGPROXY_AUTO_WEBP="true"
PGRST_DB_MAX_ROWS="${PGRST_DB_MAX_ROWS:-1000}"
PGRST_DB_EXTRA_SEARCH_PATH="${PGRST_DB_EXTRA_SEARCH_PATH:-public}"

# --- S3 Protocol (Storage local) ------------------------------------------
S3_PROTOCOL_ACCESS_KEY_ID="${S3_PROTOCOL_ACCESS_KEY_ID:-$(rand_hex 16)}"
S3_PROTOCOL_ACCESS_KEY_SECRET="${S3_PROTOCOL_ACCESS_KEY_SECRET:-$(rand_hex 32)}}"

# --- SMTP via Resend --------------------------------------------------------
SMTP_ADMIN_EMAIL="${SMTP_ADMIN_EMAIL:-${RESEND_SENDER_EMAIL}}"
SMTP_HOST="smtp.resend.com"
SMTP_PORT="465"
SMTP_USER="resend"
SMTP_PASS="${RESEND_API_KEY:-CHANGE_ME_RESEND_API_KEY}"
SMTP_SENDER_NAME="${RESEND_SENDER_NAME}"
DOCKER_SOCKET_LOCATION="${DOCKER_SOCKET_LOCATION:-/var/run/docker.sock}"

OUT="$(dirname "$0")/${ENV_FILENAME}"

umask 077
cat > "$OUT" <<EOF
############################################################
# Supabase self-hosted — env do stack supabase/docker-compose.yml
# Tenant: ${TENANT_ID}
# Gerado em: $(date -u +%FT%TZ)
############################################################

# --- Postgres --------------------------------------------------------------
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# --- URLs públicas ---------------------------------------------------------
SITE_URL=https://${CRM_DOMAIN_RAW}
SUPABASE_PUBLIC_URL=https://${SUPABASE_DOMAIN_RAW}
API_EXTERNAL_URL=https://${SUPABASE_DOMAIN_RAW}
ADDITIONAL_REDIRECT_URLS=https://${CRM_DOMAIN_RAW}

# --- JWT / API keys --------------------------------------------------------
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=3600
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}

# --- Studio (dashboard) ----------------------------------------------------
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}
STUDIO_DEFAULT_ORGANIZATION=${TENANT_ID}
STUDIO_DEFAULT_PROJECT=${TENANT_ID}
OPENAI_API_KEY=

# --- Auth (GoTrue) ---------------------------------------------------------
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false
SECURITY_CAPTCHA_ENABLED=false
SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION=false
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRED_CHARACTERS=
MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
MAILER_URLPATHS_INVITE=/auth/v1/verify
MAILER_URLPATHS_RECOVERY=/auth/v1/verify
MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify

# --- SMTP (troque pelo seu provedor) --------------------------------------
SMTP_ADMIN_EMAIL=${SMTP_ADMIN_EMAIL}
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_SENDER_NAME=${SMTP_SENDER_NAME}

# --- PostgREST -------------------------------------------------------------
PGRST_DB_SCHEMAS=public,storage,graphql_public
PGRST_DB_MAX_ROWS=${PGRST_DB_MAX_ROWS}
PGRST_DB_EXTRA_SEARCH_PATH=${PGRST_DB_EXTRA_SEARCH_PATH}

# --- Meta (Postgres Meta) --------------------------------------------------
PG_META_CRYPTO_KEY=${PG_META_CRYPTO_KEY}

# --- Storage ---------------------------------------------------------------
GLOBAL_S3_BUCKET=${GLOBAL_S3_BUCKET}
STORAGE_TENANT_ID=${STORAGE_TENANT_ID}
REGION=${REGION}
IMGPROXY_AUTO_WEBP=${IMGPROXY_AUTO_WEBP}
S3_PROTOCOL_ACCESS_KEY_ID=${S3_PROTOCOL_ACCESS_KEY_ID}
S3_PROTOCOL_ACCESS_KEY_SECRET=${S3_PROTOCOL_ACCESS_KEY_SECRET}

# --- Realtime / Vault ------------------------------------------------------
SECRET_KEY_BASE=${SECRET_KEY_BASE}
VAULT_ENC_KEY=${VAULT_ENC_KEY}

# --- Edge Functions --------------------------------------------------------
FUNCTIONS_VERIFY_JWT=false

# --- Kong (reverse proxy interno) ------------------------------------------
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443
KONG_PORT=8000

# --- Analytics (Logflare) --------------------------------------------------
LOGFLARE_PUBLIC_ACCESS_TOKEN=${LOGFLARE_PUBLIC_ACCESS_TOKEN}
LOGFLARE_PRIVATE_ACCESS_TOKEN=${LOGFLARE_PRIVATE_ACCESS_TOKEN}
GOOGLE_PROJECT_ID=supabase
GOOGLE_PROJECT_NUMBER=1

# --- Pooler (Supavisor) ----------------------------------------------------
POOLER_TENANT_ID=${POOLER_TENANT_ID}
POOLER_DEFAULT_POOL_SIZE=20
POOLER_MAX_CLIENT_CONN=100
POOLER_DB_POOL_SIZE=5

# --- Imgproxy / Storage ----------------------------------------------------
IMGPROXY_ENABLE_WEBP_DETECTION=true

# --- Docker socket (serviço vector) ----------------------------------------
DOCKER_SOCKET_LOCATION=${DOCKER_SOCKET_LOCATION}
EOF

chmod 600 "$OUT"
echo "✓ gerado: $(pwd)/$OUT"
echo ""
echo "Próximos passos:"
echo "  1) revise SMTP_* (se for usar email)"
echo "  2) docker compose --env-file $OUT up -d"
echo ""
echo "GUARDE ESTE ARQUIVO — os segredos não são recuperáveis."
