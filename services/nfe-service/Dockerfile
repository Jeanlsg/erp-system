# ============================================================================
# nfe-service — emissão de NF-e self-hosted (sped-nfe)
# Roda na rede interna do projeto `apps` (EasyPanel/xlifevps), SEM porta pública.
# ============================================================================
FROM php:8.3-cli-alpine

# soap = webservices SEFAZ · gd = DANFE (sped-da) · bcmath = dígitos verificadores
RUN apk add --no-cache libxml2-dev freetype-dev libjpeg-turbo-dev libpng-dev icu-dev \
 && docker-php-ext-configure gd --with-freetype --with-jpeg \
 && docker-php-ext-install soap gd bcmath \
 && apk del libxml2-dev freetype-dev libjpeg-turbo-dev libpng-dev icu-dev \
 && apk add --no-cache libxml2 freetype libjpeg-turbo libpng icu-libs

# ⚠️ Certificados A1 (.pfx) usam PKCS#12 com RC2/3DES — OpenSSL 3 exige o provider LEGACY:
RUN printf '\n[openssl_init]\nproviders = provider_sect\n\n[provider_sect]\ndefault = default_sect\nlegacy = legacy_sect\n\n[default_sect]\nactivate = 1\n\n[legacy_sect]\nactivate = 1\n' \
  >> /etc/ssl/openssl.cnf

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
# composer.lock junto: sem ele cada rebuild sorteia versões novas da lib.
# Foi assim que o sped-nfe pulou de 5.1 para 5.2 e quebrou model(), que
# passou a exigir int. Versões travadas = rebuild reprodutível.
COPY composer.json composer.lock ./
RUN composer install --no-dev -o --no-interaction 2>&1 | tail -5

COPY src/ ./src/

ENV TZ=America/Bahia
EXPOSE 8100

HEALTHCHECK --interval=60s --timeout=10s CMD php -r 'exit(strpos(@file_get_contents("http://127.0.0.1:8100/healthz"), "ok")===false?1:0);'

CMD ["php", "-S", "0.0.0.0:8100", "-t", "src", "src/index.php"]
