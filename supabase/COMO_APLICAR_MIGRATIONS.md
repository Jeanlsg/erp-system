# 🚀 Como Aplicar as Migrations no Supabase

Existem **5 formas** de aplicar as migrations automaticamente. Escolha a mais conveniente:

---

## 1️⃣ Script Bash (Linux/macOS/WSL) — **RECOMENDADO**

**Pré-requisito:** PostgreSQL client instalado (`psql`)

```bash
# Ubuntu/Debian
sudo apt install postgresql-client

# macOS
brew install libpq
```

**Como usar:**

1. Pegue a `DATABASE_URL` no Supabase: **Settings → Database → Connection string → URI**
2. Execute:

```bash
# Opção A: direto como argumento
./scripts/apply-migrations.sh "postgresql://postgres:SENHA@db.PROJETO.supabase.co:5432/postgres"

# Opção B: via .env (adicione DATABASE_URL=...)
./scripts/apply-migrations.sh

# Opção C: via npm
npm run migrate:bash
```

---

## 2️⃣ Script PowerShell (Windows)

```powershell
# Adicione PostgreSQL ao PATH (já vem se instalou Postgres)
# Geralmente em: C:\Program Files\PostgreSQL\16\bin

.\scripts\apply-migrations.ps1 -DatabaseUrl "postgresql://postgres:SENHA@db.PROJETO.supabase.co:5432/postgres"

# Ou via npm
npm run migrate:ps1
```

---

## 3️⃣ Script Node.js (qualquer SO)

**Pré-requisito:** Variáveis de ambiente configuradas

```bash
# .env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui

# Executar
npm run migrate
```

⚠️ **Limitação:** A API REST do Supabase não suporta DDL completo (CREATE TABLE, ALTER TABLE). Para migrations complexas, prefira psql.

---

## 4️⃣ Supabase CLI (oficial)

**Instalação:**
```bash
npm install -g supabase
supabase login
supabase link --project-ref SEU_PROJECT_REF
```

**Aplicar:**
```bash
supabase db push   # Aplica migrations pendentes
# ou
npm run db:push
```

**Vantagem:** Detecta quais migrations já foram aplicadas e aplica apenas as novas.

---

## 5️⃣ GitHub Actions (automático em deploy)

Configure o secret `SUPABASE_DATABASE_URL` no GitHub:

**Settings → Secrets and variables → Actions → New repository secret**
- Name: `SUPABASE_DATABASE_URL`
- Value: `postgresql://postgres:...@db.PROJETO.supabase.co:5432/postgres`

A cada push em `main` que alterar arquivos em `supabase/migrations/`, as migrations rodam automaticamente!

**Para rodar manualmente:** Actions → "Apply Supabase Migrations" → Run workflow

---

## 🗂️ Estrutura de Migrations

```
supabase/
└── migrations/
    ├── 001_initial_schema.sql          # 16 tabelas base
    ├── 002_auth_setup.sql              # Trigger de auth
    ├── 003_boletos_crediario_promissorias.sql
    ├── 004_pagamentos_taxas.sql        # Bandeiras, comissões
    ├── 005_crm_marketing.sql           # Avaliações, fidelidade
    ├── 006_documentos_pix_sefaz.sql    # PIX, SEFAZ, config
    ├── 007_cobranca_parcerias_notificacoes.sql
    ├── 008_alter_tables.sql            # 60+ ALTER TABLE
    ├── 009_rls_policies.sql            # 100+ policies RLS
    ├── 010_views.sql                   # 8 views úteis
    └── 011_agenda_cheques.sql          # Agenda, Cheques
```

**Ordem importa!** Execute sempre na sequência 001 → 011.

---

## 🔍 Verificar se funcionou

Após aplicar, rode no Supabase SQL Editor:

```sql
-- Ver todas as tabelas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Contar registros seed
SELECT 'lojas' AS tabela, COUNT(*) FROM erp_lojas
UNION ALL SELECT 'categorias', COUNT(*) FROM erp_categorias
UNION ALL SELECT 'produtos', COUNT(*) FROM erp_produtos
UNION ALL SELECT 'estoque', COUNT(*) FROM erp_estoque;

-- Ver views criadas
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**Resultado esperado:**
- 56 tabelas com prefixo `erp_`
- 8 views com prefixo `v_erp_`
- 2 lojas no seed, 5 categorias, 5 produtos, 10 registros de estoque

---

## ⚠️ Problemas Comuns

**"password authentication failed"**
→ Confira a senha no Supabase Dashboard → Settings → Database

**"permission denied"**
→ Use o usuário `postgres` (dono do schema)

**"relation already exists"**
→ Alguma migration já foi aplicada parcialmente. Limpe o schema e reexecute:
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

**"function exec_sql does not exist"**
→ A API REST do Supabase não suporta DDL. Use psql (Opção 1 ou 2).

---

## 📝 Notas Importantes

- O `.env` contém apenas credenciais do frontend (`VITE_*`)
- Para rodar migrations, use **SUPABASE_URL** e **SUPABASE_SERVICE_ROLE_KEY** (separadas)
- A service_role_key NUNCA vai pro frontend (tem permissão total no banco)
- Após aplicar migrations, limpe o cache do navegador e faça login novamente