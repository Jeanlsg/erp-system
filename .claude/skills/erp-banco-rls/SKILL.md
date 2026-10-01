---
name: erp-banco-rls
description: Banco do ERP X-Life (schema erp no Supabase self-hosted) — escrever migration, policy RLS e função SQL do jeito que não quebra, TESTAR a RLS como um usuário real (JWT simulado no psql), armadilhas do PostgREST (PGRST201/205/116), script da virada e backup/restore. Use ao criar/alterar tabela, policy ou função, ao investigar "new row violates row-level security", tela vazia sem erro, ou antes de rodar algo destrutivo.
---

# Banco e RLS do ERP X-Life

Schema **`erp`**, no mesmo Postgres do CRM (`public`). Acesso pela API é sempre do papel
`authenticated`; quem decide o que cada um vê/grava é a RLS. Carregue o `.env`:
`source .claude/skills/erp-deploy/scripts/env.sh`.

## Funções de apoio que as policies usam

| Função | Devolve |
|---|---|
| `erp.current_erp_user_id()` | id do usuário logado **se ativo** em `erp_usuarios`, senão null |
| `erp.is_erp_admin()` | papel principal `admin` **ou** `gerente` |
| `erp.is_erp_admin_safe()` | papel principal `admin` |

⚠️ A RLS olha o **papel principal** (`erp_usuarios.role`). As permissões da tela Usuários e
Permissões controlam **navegação**, não o banco: dar permissão a um operador de caixa não
libera nada que a policy proíbe.

## Escrevendo migration

- Arquivo `supabase/migrations/NNN_nome.sql`, `BEGIN; … COMMIT;`, idempotente
  (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS` antes de `CREATE POLICY`).
- Comentário no topo explicando o **defeito** que ela corrige, não só o que ela faz.
- Tabela nova: `ENABLE ROW LEVEL SECURITY`, `GRANT … TO authenticated`, e uma policy para
  **cada** operação que a tela faz.
- **`upsert` = INSERT + UPDATE.** Se a linha já existe (por exemplo, criada por trigger), o
  upsert vira UPDATE e precisa de policy de UPDATE. Foi o erro "USING expression" no
  fechamento de caixa (migration 075).
- Função que lê outro schema (`public.leads`, `auth.users`): `SECURITY DEFINER`,
  `SET search_path = erp, public`, e uma trava dentro (`WHERE erp.current_erp_user_id() IS NOT NULL`
  ou `erp.is_erp_admin_safe()`). Depois `REVOKE ALL … FROM public; GRANT EXECUTE … TO authenticated`.
- **Não use palavra reservada como nome de variável** em PL/pgSQL (`current_role`, `user`…).
  `is_erp_admin_safe()` devolveu `false` para todos por meses porque comparava
  `CURRENT_ROLE` (`'authenticated'`) com `'admin'` (migration 074).
- Tabela nova que referencia movimento (vendas, pessoas, produtos…) precisa entrar na lista
  `a_truncar` de `scripts/virada-producao.sql`, senão o TRUNCATE da virada falha no meio.

## Depois de aplicar (DDL nova)

```bash
ssh "$ERP_SSH_HOST" "docker exec $ERP_DB_CONTAINER psql -U supabase_admin -d postgres -c \"NOTIFY pgrst, 'reload schema';\""
```
Tela nova vazia sem erro = cache do PostgREST (PGRST205). Se o NOTIFY não bastar:
`docker restart $ERP_REST_CONTAINER`.

## Testar a RLS como um usuário real

Sempre dentro de uma transação desfeita:

```sql
BEGIN;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000000'; -- id LITERAL do usuário
SET LOCAL ROLE authenticated;
SELECT erp.current_erp_user_id(), erp.is_erp_admin();
-- a operação que a tela faz, com RETURNING para ver o efeito
ROLLBACK;
```

```bash
ssh "$ERP_SSH_HOST" "docker exec -i $ERP_DB_CONTAINER psql -U supabase_admin -d postgres -At" < teste.sql
```

Armadilhas deste teste (todas já aconteceram):
- **Claim antes do `SET ROLE`.** E use o id **literal**: um subselect para buscar o id depois
  do `SET ROLE` roda sob RLS e volta vazio — o teste "falha" sem a policy estar errada.
- Confira o id atual em `erp_usuarios`: usuário recriado ganha id novo.
- `'texto' || jsonb` tenta converter o texto em JSON → use `::text`.
- Teste com **cada papel** que usa a tela (admin, gerente, caixa, estoquista), não só com o admin.

## Armadilhas do PostgREST

| Código | Sintoma | Causa e saída |
|---|---|---|
| PGRST201 | lista vazia, sem exceção na tela | embed ambíguo: duas FKs para a mesma tabela → `alias:tabela!nome_da_fk(...)` |
| PGRST205 | tabela "não existe" | cache do schema → NOTIFY / restart do rest |
| PGRST116 | `.maybeSingle()` falha | mais de uma linha onde se esperava uma → UNIQUE no banco |
| corte de 1000 | lista/soma menor que o real, sem erro | `PGRST_DB_MAX_ROWS=1000` → `lerTudo()` no front, ou agregue no banco (RPC/view) |

## Backup, restauração e ensaio

- Backup diário na VPS em `$ERP_BACKUP_DIR` (globals + banco inteiro + `_supabase`), 14 dias — `scripts/backup-diario.sh`.
- Restauração testada: `scripts/RESTAURAR-BACKUP.md`. Restaurar num banco de outro nome dá 6 erros de `pg_cron` — esperados.
- **Destrutivo (DELETE/TRUNCATE em massa, DROP, a virada):** ensaie num clone do backup antes.
  Em produção, peça confirmação ao usuário.

Para DDL pesada (índice em tabela grande, backfill, `ALTER` que reescreve), siga também `supabase-migrations-seguras`.
