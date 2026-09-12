# Como restaurar o backup do ERP X-Life

Procedimento **testado em 12/09/2026** contra o backup real da VPS `xlifevps`.
Gerado por `scripts/backup-diario.sh` (cron diário, 3h30 UTC, retenção 14 dias).

## O que cada arquivo contém

| Arquivo | Tamanho típico | O que tem |
|---|---|---|
| `globals-AAAAMMDD.sql` | ~6 KB | as 13 roles do cluster, com senhas e `search_path`. **Sem isto o ERP não funciona** — é aqui que vive o `search_path` com o schema `erp` em `anon`, `authenticated`, `service_role` e `supabase_admin` |
| `postgres-AAAAMMDD.dump` | ~40 MB | o banco principal inteiro: `erp` (90 tabelas, 21 views, 55 funções), `public`, `auth` (os logins), `storage`, `vault`, `extensions`, `cron` (16 jobs agendados) e os demais |
| `supabase-AAAAMMDD.dump` | ~170 KB | o banco `_supabase` (analytics do Logflare, estado do Supavisor) |

Os três são do mesmo instante. **Restaure sempre o trio do mesmo dia.**

## Restaurar num servidor novo (perda total)

```bash
# 0. suba a stack do Supabase no EasyPanel e espere o container do banco ficar healthy.
#    O Postgres precisa ser a MESMA major version: 15.
DB=$(docker ps -qf name=supabase-db | head -1)
docker exec "$DB" psql -U supabase_admin -d postgres -Atc 'show server_version'

# 1. roles PRIMEIRO. Sem elas, o passo 2 falha em cascata nos GRANTs.
#    "role already exists" é esperado e inofensivo: a stack cria algumas ao subir.
docker exec -i "$DB" psql -U supabase_admin -d postgres < globals-AAAAMMDD.sql

# 2. banco principal. --clean --if-exists derruba o que a stack criou vazio.
docker exec -i "$DB" pg_restore -U supabase_admin -d postgres \
  --clean --if-exists --no-owner --no-acl < postgres-AAAAMMDD.dump

# 3. banco de analytics (opcional; a stack recria se faltar)
docker exec -i "$DB" pg_restore -U supabase_admin -d _supabase \
  --clean --if-exists --no-owner --no-acl < supabase-AAAAMMDD.dump

# 4. reinicie quem mantém conexão e cache de schema
docker restart apps_supabase-rest-1 apps_supabase-auth-1 apps_supabase-functions-1
```

### Conferir que voltou

```bash
docker exec "$DB" psql -U supabase_admin -d postgres -Atc "
select 'tabelas erp='||(select count(*) from pg_tables where schemaname='erp')
    ||' auth='||(select count(*) from pg_tables where schemaname='auth')
    ||'  LOGINS='||(select count(*) from auth.users)
    ||'  lojas='||(select count(*) from erp.erp_lojas)
    ||'  certificados='||(select count(*) from erp.erp_certificados_digitais)
    ||'  jobs cron='||(select count(*) from cron.job)"
```

Esperado no backup de 12/09/2026: `tabelas erp=90 auth=20 LOGINS=2 lojas=2 certificados=2 jobs cron=16`.

Depois: **faça login na aplicação**. Se a tela abre mas toda listagem vem vazia, o
`search_path` das roles não entrou — reaplique o `globals-*.sql` e reinicie o
`apps_supabase-rest-1`. Esse é o sintoma clássico de ter restaurado só o dump
sem as globals (veja "O erro que isto corrige", abaixo).

## Restaurar só os dados, no mesmo servidor

Para voltar atrás de uma operação errada (um `virada-producao.sql` rodado antes da
hora, por exemplo) sem mexer em logins nem configuração:

```bash
# restaura SÓ o schema erp, sobre o banco que já está rodando
docker exec -i "$DB" pg_restore -U supabase_admin -d postgres \
  --clean --if-exists --no-owner --no-acl --schema=erp < postgres-AAAAMMDD.dump
docker restart apps_supabase-rest-1
```

## Ensaiar sem risco (o que fazer antes de qualquer operação destrutiva)

Restaure num banco de rascunho no mesmo cluster e faça o teste lá:

```bash
docker exec "$DB" psql -U supabase_admin -d postgres -qc 'CREATE DATABASE ensaio;'
docker exec -i "$DB" pg_restore -U supabase_admin -d ensaio --no-owner --no-acl \
  < postgres-AAAAMMDD.dump
# … rode o que quer testar contra o banco `ensaio` …
docker exec "$DB" psql -U supabase_admin -d postgres -qc 'DROP DATABASE ensaio;'
```

**Restaurar num banco com outro nome produz exatamente 6 erros, todos de `pg_cron`**
("can only create extension in database postgres"). É esperado: o pg_cron só existe
no banco chamado `postgres`. Qualquer erro ALÉM desses 6 é problema de verdade.

## O erro que isto corrige

Até 12/09/2026 o backup rodava assim:

```bash
pg_dump -U supabase_admin -d postgres -Fc --schema=erp --schema=public
```

Dois schemas apenas. Ao ensaiar a virada num clone, esse dump **não restaurou**:

- **833 erros** e **36 das 90 tabelas** de `erp` — sem nenhum aviso, o banco ficava pela metade
- as tabelas usam `extensions.uuid_generate_v4()` como default, e o schema `extensions` não estava no dump
- as tabelas têm FK para `auth.users`, e o schema `auth` não estava no dump — ou seja, **o backup não continha nenhum login**
- o `search_path` com o schema `erp` vive em config de role, que `--schema` não captura: a API subiria cega para o `erp` inteiro

Servia para recuperar *dados* com trabalho manual. Não servia para recuperar a *instância*.
O formato atual restaura num Postgres vazio com os 6 erros conhecidos de `pg_cron` e nada mais.
