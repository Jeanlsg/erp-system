# Plano · Emissão de NF-e self-hosted na xlifevps (Opção B)

**Objetivo:** substituir a emissão simulada (`useEmitirNFeRemessa` grava protocolo mock) por emissão
**real** contra a SEFAZ, rodando 100% na infra própria — sem custo por nota.

**Contexto levantado:**
- VPS xlifevps: 2 vCPU · 8 GB RAM (~4 GB livres) · Docker Swarm gerenciado pelo EasyPanel + Traefik
- Lojas: **BA (Juazeiro)** e **PE (Petrolina)** — 2 CNPJs, 2 UFs ⇒ serviço precisa ser multi-loja
- Certificados A1 (.pfx) já são armazenados criptografados em `erp.erp_certificados_digitais`
  (senha via `erp.criptografar_senha_cert` / `descriptografar_senha_cert`)
- Config SEFAZ por loja em `erp.erp_configuracoes_sefaz` (ambiente hoje: homologação nas duas)
- Edge Functions Deno já rodam em `apps_supabase-functions-1`

---

## 1 · Escolha da stack

| Candidata | Veredito |
|---|---|
| **nfephp-org/sped-nfe (PHP)** | ✅ **Escolhida.** Lib open-source mais madura do Brasil: gera XML layout 4.00, assina (XMLDSig), transmite SOAP, eventos (cancelamento, CC-e, inutilização), contingência SVC/EPEC. Mantida ativamente, acompanha as Notas Técnicas. `sped-da` gera o DANFE em PDF. |
| ACBrLibNFe (Lazarus) | Funciona headless no Linux, mas o empacotamento em container é frágil e a API C é chata de expor via HTTP. Mais indicada para desktop. |
| Libs Node/Python | Imaturas ou abandonadas para o layout 4.00 completo. Descartadas. |

**Arquitetura:** um microserviço HTTP **stateless** (`nfe-service`) em PHP 8.3 + Slim, containerizado,
deployado pelo EasyPanel na própria xlifevps. Ele **não** guarda certificado nem nota — recebe tudo
na requisição e devolve XML assinado + protocolo + DANFE. Quem orquestra é uma **Edge Function**
(`emitir-nfe`) com service role, que já vive dentro do Supabase.

```
┌─────────┐   1. clique "Emitir"    ┌──────────────────────┐
│  ERP    │ ──────────────────────► │ Edge Function        │
│ (React) │                         │ emitir-nfe (Deno)    │
└─────────┘                         │  · monta payload     │
                                    │  · busca cert (.pfx  │
                                    │    + senha decripta) │
                                    └─────────┬────────────┘
                                              │ 2. POST /v1/nfe/emitir
                                              │    (Bearer token, rede interna)
                                    ┌─────────▼────────────┐
                                    │ nfe-service (PHP)    │
                                    │  · gera XML 4.00     │
                                    │  · assina XMLDSig    │
                                    │  · SOAP → SEFAZ      │──► SEFAZ BA (autorizadora própria)
                                    │  · monta DANFE PDF   │──► SEFAZ PE (roteado pela lib)
                                    └─────────┬────────────┘
                                              │ 3. XML autorizado + protocolo + PDF
                                    ┌─────────▼────────────┐
                                    │ Edge Function        │
                                    │  · erp_notas_fiscais │ status/protocolo/chave REAIS
                                    │  · bucket `fiscal`   │ XML + DANFE (guarda legal: 5 anos)
                                    └──────────────────────┘
```

A lib resolve o webservice correto por UF automaticamente (BA tem autorizadora própria; PE roteia
conforme o cadastro atual da SEFAZ) — nada de URL hardcoded.

---

## 2 · O microserviço `nfe-service`

### 2.1 Dockerfile

```dockerfile
FROM php:8.3-cli-alpine

# soap = transmissão SEFAZ · gd = DANFE (sped-da) · bcmath = dígito verificador
RUN apk add --no-cache libxml2-dev oniguruma-dev freetype-dev libjpeg-turbo-dev libpng-dev \
 && docker-php-ext-configure gd --with-freetype --with-jpeg \
 && docker-php-ext-install soap gd bcmath mbstring

# ⚠️ GOTCHA CRÍTICO: certificados A1 costumam ser PKCS#12 cifrado com RC2/3DES.
# OpenSSL 3 (Alpine atual) só abre esses .pfx com o provider LEGACY habilitado:
RUN printf '\n[provider_sect]\ndefault = default_sect\nlegacy = legacy_sect\n[default_sect]\nactivate = 1\n[legacy_sect]\nactivate = 1\n' \
  >> /etc/ssl/openssl.cnf

WORKDIR /app
COPY composer.json ./
RUN composer install --no-dev -o        # nfephp-org/sped-nfe, nfephp-org/sped-da, slim/slim
COPY src/ ./src/
EXPOSE 8100
CMD ["php", "-S", "0.0.0.0:8100", "src/index.php"]
```

Consumo estimado: **~120–180 MB RAM** ocioso — cabe com folga nos ~4 GB livres da VPS.

### 2.2 Endpoints

| Método | Rota | Faz o quê |
|---|---|---|
| GET | `/v1/status` | Consulta status do serviço SEFAZ da UF (`SefazStatus`) — usado no health-check do ERP |
| POST | `/v1/nfe/emitir` | Recebe payload da nota + pfx base64 + senha → gera XML, assina, envia (`sefazEnviaLote` síncrono), retorna `{ chave, protocolo, xml_autorizado, danfe_pdf_base64, codigo, motivo }` |
| POST | `/v1/nfe/cancelar` | Evento de cancelamento (até 24h/UF) → XML do evento + protocolo |
| POST | `/v1/nfe/cce` | Carta de Correção Eletrônica |
| POST | `/v1/nfe/inutilizar` | Inutilização de faixa de numeração |
| POST | `/v1/danfe` | Re-gera o DANFE a partir de um XML autorizado |

Payload de emissão (o que a Edge Function monta a partir de `erp_vendas`/`erp_remessas`):

```jsonc
{
  "ambiente": 2,                      // 1=produção 2=homologação (da erp_configuracoes_sefaz)
  "certificado": { "pfx_base64": "...", "senha": "..." },
  "emitente":  { "cnpj": "...", "razao": "...", "ie": "...", "crt": 1, "endereco": {...} },  // da erp_lojas
  "destinatario": { "cpf_cnpj": "...", "nome": "...", "endereco": {...} },                   // da erp_pessoas / loja destino
  "nota": { "serie": 1, "numero": 123, "natureza": "VENDA", "cfop": "5102", "modelo": 55 },
  "itens": [ { "codigo": "SKU1", "descricao": "...", "ncm": "21069090", "cfop": "5102",
               "quantidade": 2, "valor_unitario": 99.9, "csosn": "102" } ],
  "pagamentos": [ { "forma": "01", "valor": 199.8 } ]
}
```

### 2.3 Segurança

- **Rede:** o container entra na **mesma rede Docker** do projeto `apps` no EasyPanel — a Edge
  Function chama `http://apps_nfe-service:8100` **sem passar pela internet**. Nenhum domínio público
  no Traefik (se um dia precisar de acesso externo, aí sim subdomínio + TLS).
- **Auth:** header `Authorization: Bearer <NFE_SERVICE_TOKEN>` (env var nos dois lados; gerar com
  `openssl rand -hex 32`).
- O certificado trafega só dentro da rede interna do host e **nunca** é gravado em disco no
  microserviço (fica em memória durante a requisição).

---

## 3 · Integração no ERP

### 3.1 Edge Function `emitir-nfe` (nova)

1. Valida usuário (`erp_usuarios`, permissão `fiscal.emitir`).
2. Carrega venda/remessa + itens + loja + destinatário.
3. **Valida pré-requisitos e devolve erro claro se faltar:** certificado ativo e não vencido,
   config SEFAZ, IE da loja, **NCM em todos os produtos**, endereço completo do emitente.
4. Baixa o `.pfx` do bucket `certificados` + decripta a senha (`erp.descriptografar_senha_cert`).
5. Incrementa numeração **com lock** (`erp.incrementar_numeracao_nfe` já existe).
6. `POST nfe-service /v1/nfe/emitir` (timeout 30 s).
7. **Autorizada (cStat 100):** grava em `erp_notas_fiscais` chave/protocolo/status **reais**, sobe
   XML e DANFE no bucket `fiscal`, vincula `venda_id`/remessa.
8. **Rejeitada (cStat ≠ 100):** grava status `rejeitada` + `codigo_retorno`/`mensagem_retorno` reais
   (ex.: 539 duplicidade, 225 schema) — a numeração usada é inutilizada depois ou reaproveitada
   conforme o caso.
9. **Timeout/SEFAZ fora:** grava `pendente_transmissao` e um retry job reprocessa (ver 3.3).

Edge Functions `cancelar-nfe` e `cce-nfe` seguem o mesmo molde.

### 3.2 Mudanças no schema (migration 038)

```sql
ALTER TABLE erp.erp_notas_fiscais
  ADD COLUMN IF NOT EXISTS xml_path      TEXT,      -- bucket fiscal
  ADD COLUMN IF NOT EXISTS danfe_path    TEXT,
  ADD COLUMN IF NOT EXISTS cstat         VARCHAR(4),
  ADD COLUMN IF NOT EXISTS tentativas    INT DEFAULT 0;

ALTER TABLE erp.erp_produtos
  ADD COLUMN IF NOT EXISTS ncm   VARCHAR(8),
  ADD COLUMN IF NOT EXISTS cest  VARCHAR(7),
  ADD COLUMN IF NOT EXISTS cfop_padrao VARCHAR(4) DEFAULT '5102',
  ADD COLUMN IF NOT EXISTS csosn VARCHAR(4) DEFAULT '102';   -- Simples Nacional

-- bucket fiscal (XML autorizado: guarda legal de 5 anos)
INSERT INTO storage.buckets (id, name, public) VALUES ('fiscal','fiscal',false)
ON CONFLICT DO NOTHING;
```

> **NCM é obrigatório no XML.** Hoje `erp_produtos` não tem a coluna — sem NCM a SEFAZ rejeita
> (cStat 778). A tela de produto ganha os 4 campos fiscais.

### 3.3 Frontend

- `useEmitirNFeRemessa` passa a chamar a Edge Function (some o mock de protocolo).
- `notas-fiscais.tsx`: botão **Emitir NF-e** nas vendas sem nota, badge por `cstat` real,
  download de XML e DANFE do bucket, botão Cancelar (com justificativa ≥ 15 chars) e CC-e.
- Painel do Contador: exportar XMLs do período (zip) — substitui o item "Notas fiscais emitidas: —".
- Retry: pg_cron a cada 5 min reprocessa `pendente_transmissao` com `tentativas < 5`.

---

## 4 · Deploy na xlifevps via EasyPanel

1. Repositório `nfe-service` (pode ser pasta `services/nfe-service` no próprio repo do ERP).
2. EasyPanel → projeto **apps** → **+ Service → App**, build por Dockerfile (git ou upload).
   Ficar no projeto `apps` garante a rede compartilhada com o Supabase.
3. Env vars: `NFE_SERVICE_TOKEN` (o mesmo vai nas secrets das Edge Functions), `TZ=America/Bahia`.
4. **Sem domínio público** — não criar rota no Traefik.
5. Limites do container: 512 MB RAM / 0.5 CPU (EasyPanel → Advanced → Resources).
6. Deploy das Edge Functions: `supabase functions deploy emitir-nfe cancelar-nfe cce-nfe`
   (ou copiar para o volume do container `apps_supabase-functions-1`, como já é feito hoje).
7. Health-check: `GET /v1/status?uf=BA` no painel do EasyPanel.

---

## 5 · Homologação → Produção (por loja/UF)

Checklist **por CNPJ** (BA e PE são independentes):

1. Certificado A1 válido do CNPJ instalado no ERP ✔ (fluxo já existe)
2. Inscrição Estadual ativa e regime tributário correto na `erp_configuracoes_sefaz`
3. **Credenciamento NF-e** na SEFAZ da UF (portal da SEFAZ-BA / SEFAZ-PE — normalmente automático
   para quem tem IE, mas conferir)
4. Ambiente **homologação**: emitir nota de teste (destinatário fica "SEM VALOR FISCAL"),
   validar cStat 100, cancelamento e CC-e
5. Série de produção definida (manter série 1; numeração começa do 1 em produção)
6. Virar `ambiente = producao` na config da loja — **uma loja por vez**
7. Guarda: conferir XMLs no bucket `fiscal` + backup (o EasyPanel já faz backup do volume do MinIO/storage? — validar; senão, cron de `rclone` para fora da VPS)

> **NFC-e (cupom, modelo 65) fica para a fase 2:** exige além do certificado o **CSC/ID Token**
> gerado no portal da SEFAZ de cada UF. O `sped-nfe` também emite NFC-e, então o serviço já nasce
> pronto — é só outra rota `/v1/nfce/emitir` + campo CSC na config.

---

## 6 · Esforço e manutenção

| Etapa | Estimativa |
|---|---|
| Microserviço PHP (emitir + status + DANFE) | 1–2 dias |
| Eventos (cancelar, CC-e, inutilizar) | 1 dia |
| Edge Functions + migration 038 + campos fiscais no produto | 1 dia |
| Frontend (botões, badges, downloads, retry) | 1 dia |
| Homologação nas 2 UFs + ajustes de rejeição | 1–3 dias (depende da SEFAZ) |
| **Total** | **~1 semana útil** |

**Manutenção contínua (o custo real da opção B):**
- `composer update nfephp-org/sped-nfe` quando sai Nota Técnica nova (2–4×/ano) — a lib absorve as
  mudanças de layout; sem isso as notas começam a ser rejeitadas na data-limite da NT
- Renovação anual dos certificados A1 (o ERP já alerta vencimento)
- Monitorar rejeições recorrentes (view simples sobre `cstat`)

**Riscos honestos:**
- Regra fiscal é o risco nº 1: CFOP/CSOSN/NCM errados geram rejeição ou, pior, nota autorizada com
  tributação errada. **Validar a matriz fiscal com o contador antes de produção** (Simples Nacional
  presumido: CSOSN 102 default — confirmar).
- SEFAZ fora do ar acontece → por isso o status `pendente_transmissao` + retry (contingência SVC
  automática fica como melhoria posterior).
- OpenSSL legacy (item 2.1) é o gotcha técnico clássico — já tratado no Dockerfile.

---

## 7 · Ordem de implementação

1. Migration 038 (campos fiscais + bucket) e telas de produto com NCM/CFOP/CSOSN
2. `nfe-service` + deploy EasyPanel + `GET /v1/status` funcionando contra homologação
3. Edge Function `emitir-nfe` + troca do mock no front
4. Nota de homologação autorizada nas 2 lojas (BA e PE)
5. Eventos (cancelamento, CC-e, inutilização)
6. Retry/pendências + export do contador
7. Go-live produção loja a loja
8. Fase 2: NFC-e no PDV (CSC por loja)
