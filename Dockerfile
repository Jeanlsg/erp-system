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

# ===== Runtime stage =====
FROM --platform=linux/amd64 nginx:1.27-alpine AS runner

RUN apk add --no-cache wget

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/health || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
