# =============================================================================
# Dockerfile — ERP System (Vite + Nginx)
# =============================================================================

# ===== Build stage =====
FROM --platform=linux/amd64 node:20-alpine AS builder
WORKDIR /app

# ARGs para variáveis do cliente
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ARG VITE_SITE_URL=""
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_SITE_URL=$VITE_SITE_URL

# Cria .env.production com os ARGs
RUN echo "VITE_SUPABASE_URL=$VITE_SUPABASE_URL" > .env.production && \
    echo "VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY" >> .env.production && \
    echo "VITE_SITE_URL=$VITE_SITE_URL" >> .env.production

# Instala dependências
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copia código e builda
COPY . .
RUN rm -rf node_modules/.vite dist && npm run build

# Cabeçalhos de segurança: a CSP libera o Supabase desta instalação. A origem
# é o VITE_SUPABASE_URL que o próprio build usou (loadEnv do Vite: build arg
# ou o .env que o EasyPanel grava), em https e wss — sem escrever o endereço
# no repo. Sem ela o build para: a CSP sairia bloqueando o banco.
RUN url=$(node --input-type=module -e "import { loadEnv } from 'vite'; process.stdout.write(loadEnv('production', process.cwd(), 'VITE_').VITE_SUPABASE_URL || '')") && \
    origem=$(printf '%s' "$url" | sed -E 's#^(https?://[^/]+).*#\1#') && \
    { test -n "$origem" || { echo "VITE_SUPABASE_URL vazio: a CSP não teria o Supabase"; exit 1; }; } && \
    ws=$(printf '%s' "$origem" | sed -E 's#^http#ws#') && \
    sed -e "s#__SUPABASE_WS__#$ws#g" -e "s#__SUPABASE__#$origem#g" nginx-seguranca.conf > /app/seguranca.conf

# ===== Runtime stage =====
FROM --platform=linux/amd64 nginx:1.27-alpine AS runner

RUN apk add --no-cache wget

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/seguranca.conf /etc/nginx/seguranca.conf
COPY --from=builder /app/dist /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/health || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
