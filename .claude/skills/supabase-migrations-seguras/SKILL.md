---
name: supabase-migrations-seguras
description: Escrever e aplicar migrations SQL e edge functions no Supabase (self-hosted ou cloud) sem derrubar o banco. Cobre o padrão DDL-leve + backfill em lotes, timeouts obrigatórios, pré-voo de backup/disco, deploy de edge function, e o RUNBOOK DE EMERGÊNCIA quando o banco não sobe (disco cheio, "could not locate a valid checkpoint record", pg_wal apagado, catálogo inconsistente). Use quando o pedido envolver criar/revisar/aplicar migration, ALTER TABLE, backfill/UPDATE em massa, adicionar coluna, criar índice, deploy de edge function do Supabase, ou quando o Postgres não iniciar / o disco encher / o banco estiver em restart-loop.
---

# Migrations e edge functions no Supabase sem derrubar o banco

Escrito depois de um incidente real (14/08/2026, VPS de um cliente): uma migration com
`ADD COLUMN` + `UPDATE` de tabela inteira encheu o WAL, o Postgres parou, alguém
apagou o `pg_wal` pra liberar disco — e o banco **nunca mais subiu**. Perdeu-se o
`attnum 20` (`status`) da tabela `leads` no catálogo. Não havia backup lógico.

**As três regras que teriam evitado tudo:**
1. Backfill de tabela inteira vai em **lotes com commit**, nunca num `UPDATE` único.
2. `pg_dump` **antes** de qualquer migration que toca dados.
3. **Nunca apagar `pg_wal`.** Nunca. Nem com o disco em 100%.

---

## 1. Anatomia de uma migration segura

Toda migration começa com timeouts. Sem isso, ela trava o banco inteiro esperando lock.

```sql
SET lock_timeout = '5s';        -- desiste do lock em vez de enfileirar o mundo
SET statement_timeout = '60s';  -- migration morre sozinha em vez de rodar 3h
```

Depois, **separe DDL de backfill**. São dois arquivos, sempre.

### 1a. Arquivo de DDL — barato, instantâneo, seguro

```sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- ADD COLUMN sem DEFAULT volátil é metadata-only no PG11+: instantâneo, não reescreve.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS owner_instancia text,
  ADD COLUMN IF NOT EXISTS phone_chatid text;

-- CONCURRENTLY não bloqueia escrita. Exige rodar FORA de transação.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_phone_chatid
  ON public.leads(phone_chatid) WHERE phone_chatid IS NOT NULL;
```

### 1b. Arquivo de backfill — em lotes, com commit a cada lote

O erro que derrubou o banco foi exatamente isto **sem** o laço:

```sql
-- ❌ NUNCA: reescreve a tabela toda numa transação, WAL explode
UPDATE public.leads SET phone_chatid = split_part(remotejid,'@',1);
```

```sql
-- ✅ Em lotes. Cada commit libera WAL pra ser reciclado.
DO $$
DECLARE n int;
BEGIN
  LOOP
    UPDATE public.leads SET phone_chatid = split_part(remotejid,'@',1)
    WHERE id IN (
      SELECT id FROM public.leads
      WHERE phone_chatid IS NULL AND remotejid IS NOT NULL AND remotejid <> ''
      LIMIT 5000
    );
    GET DIAGNOSTICS n = ROW_COUNT;
    EXIT WHEN n = 0;
    COMMIT;                       -- só funciona em DO block (PG11+), fora de transação
    PERFORM pg_sleep(0.1);        -- deixa autovacuum e checkpoint respirarem
  END LOOP;
END $$;
```

Regras do backfill:
- Lote de **1k–10k linhas**. Tabela grande ou linha gorda → lote menor.
- O `WHERE` tem que **excluir o que já foi feito** (`IS NULL`), senão o laço é infinito.
- `COMMIT` dentro do laço é obrigatório — é ele que permite o WAL ser reciclado.
- Rodar via `psql`, nunca por editor web (timeout de HTTP mata no meio).

### Custo de cada operação — consulte antes de escrever

| Operação | Custo | Bloqueia? |
|---|---|---|
| `ADD COLUMN` sem default / com default constante | instantâneo | lock curto |
| `ADD COLUMN` com default **volátil** (`now()`, `gen_random_uuid()`) | **reescreve a tabela** | sim, longo |
| `ALTER COLUMN TYPE` | **reescreve a tabela** | sim, longo |
| `UPDATE` sem `WHERE` restritivo | **reescreve a tabela** | WAL explode |
| `CREATE INDEX` | lê tudo | **bloqueia escrita** |
| `CREATE INDEX CONCURRENTLY` | lê tudo 2x | não bloqueia |
| `ADD CONSTRAINT ... CHECK` | valida tudo | sim → use `NOT VALID` + `VALIDATE` depois |
| `DROP COLUMN` | instantâneo | lock curto |

---

## 2. Pré-voo — antes de aplicar em produção

```bash
# 1) BACKUP LÓGICO. Não é opcional.
ssh $VPS "docker exec apps_supabase-db-1 pg_dump -U postgres -d postgres -Fc" \
  > backup-$(date +%Y%m%d-%H%M).dump
ls -lh backup-*.dump   # confira que não veio vazio

# 2) Folga de disco — precisa sobrar bem mais que a maior tabela tocada
ssh $VPS "df -h /"

# 3) Tamanho do que a migration vai tocar
ssh $VPS "docker exec apps_supabase-db-1 psql -U postgres -d postgres -c \
  \"SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) FROM pg_class
    WHERE relname IN ('leads','mensagens') ORDER BY pg_total_relation_size(oid) DESC;\""
```

Regra de folga: **livre > 3× o tamanho da maior tabela** que o backfill reescreve.
Sem essa folga, não rode — aumente o disco primeiro.

Durante a aplicação, em outro terminal:

```bash
watch -n5 'ssh $VPS "df -h / | tail -1; \
  docker exec apps_supabase-db-1 du -sh /var/lib/postgresql/data/pg_wal"'
```

Se o `pg_wal` passar de ~10 GB ou o disco cruzar 85%: **aborte o backfill**
(`SELECT pg_cancel_backend(pid)`), não espere encher.

---

## 3. Ordem de aplicação

1. Aplicar em **staging/cópia** primeiro. Sempre. Uma cópia do PGDATA num container
   isolado serve (`docker run` com o volume copiado numa porta alta).
2. Backup lógico de produção.
3. Aplicar o **DDL** (rápido).
4. Aplicar o **backfill** (lento, monitorado).
5. Regenerar o dump de schema versionado e o `types.ts`.

**Migration sempre vira arquivo versionado.** Aplicar direto pelo editor SQL do Studio
não deixa rastro e o schema de produção passa a divergir do repo. Esse drift é real e
silencioso — no CRM já apareceu como uma view com `security_invoker='false'` em produção
enquanto a migration mandava `on`, e uma tabela que existia em migration mas não no dump.

---

## 4. Edge functions

```bash
supabase functions deploy <nome> --project-ref <ref>          # cloud
# self-hosted: os arquivos vão pro volume do edge-runtime + restart do container
```

Checklist antes de subir:
- `verify_jwt` correto no `config.toml` — webhook de terceiro precisa `verify_jwt = false`,
  qualquer coisa que o usuário chama precisa `true`.
- Function que usa **service role bypassa RLS inteiro**. Toda checagem de permissão tem
  que ser feita na mão, no código.
- Segredos vêm de env ou de tabela **com RLS ligada**. Se for tabela, ela precisa de
  `ENABLE ROW LEVEL SECURITY` + `REVOKE ALL FROM anon, authenticated`. Sem isso o
  PostgREST expõe a tabela — os `GRANT` default do Supabase dão SELECT pra `anon`.
- Deploy de function **não é atômico com a migration**. Se a function depende de coluna
  nova: migration primeiro, function depois. Se a migration remove algo: function primeiro.

---

## 5. Tabela nova — checklist de segurança

Toda tabela criada em migration precisa disto, ou ela nasce exposta:

```sql
ALTER TABLE public.minha_tabela ENABLE ROW LEVEL SECURITY;

-- Tabela só de service_role (segredos, filas, logs):
REVOKE ALL ON public.minha_tabela FROM anon, authenticated;
GRANT ALL ON public.minha_tabela TO service_role;
-- e NENHUMA policy — RLS ligada sem policy nega todo mundo

-- Tabela que o app lê: RLS ligada + policy explícita por workspace/tenant
```

Views precisam de `WITH (security_invoker = true)`, senão rodam como owner e
**furam a RLS da tabela de baixo**.

---

## 6. 🚨 RUNBOOK DE EMERGÊNCIA — o banco não sobe

### A regra que não se quebra

```
NUNCA apague arquivos de /var/lib/postgresql/data/pg_wal/
```

Com disco cheio, o Postgres para mas está **íntegro** — é reversível. Apagando o WAL,
ele passa a não conseguir recuperar: vira corrupção de catálogo e perda de dados.

**Disco cheio, o que fazer:** apagar logs de container (`/var/lib/docker/containers/*/*.log`),
imagens órfãs (`docker image prune -a`), dumps velhos, `/tmp`. Ou aumentar o volume.
Nunca o `pg_wal`.

### Diagnóstico

```bash
docker logs --tail 60 apps_supabase-db-1
docker inspect apps_supabase-db-1 --format \
  'Exit={{.State.ExitCode}} Restarts={{.RestartCount}} OOM={{.State.OOMKilled}}'
```

| Sintoma no log | Causa | Ação |
|---|---|---|
| `could not locate a valid checkpoint record` | `pg_wal` vazio/apagado | seção abaixo |
| `No space left on device` | disco cheio | liberar espaço (não o WAL) e reiniciar |
| `database system was not properly shut down` | crash normal | deixa recuperar sozinho, **não interfira** |
| `invalid page in block` | corrupção de dados | restaurar backup |
| `OOMKilled=true` | memória | subir limite do container |

### `could not locate a valid checkpoint record`

Ordem obrigatória. **Nada aqui roda no PGDATA de produção direto.**

**Passo 1 — congelar o estado. Antes de qualquer outra coisa.**

```bash
docker stop apps_supabase-db-1
D=/etc/easypanel/projects/apps/supabase/code/supabase/code/volumes/db/data
mkdir -p /root/pgdata-rescue-$(date +%Y%m%d)
cp -a $D /root/pgdata-rescue-$(date +%Y%m%d)/pgdata-atual
```

**Passo 2 — ler o estado (read-only):**

```bash
docker run --rm -v $D:/d:ro --entrypoint /usr/lib/postgresql/bin/pg_controldata \
  supabase/postgres:15.8.1.085 /d | grep -iE "state|Time of latest|system identifier"
```

**Passo 3 — testar recuperação numa CÓPIA descartável, nunca no original:**

```bash
T=/root/pgdata-test; rm -rf $T; cp -a /root/pgdata-rescue-*/pgdata-atual $T
chown -R 105:106 $T
docker run --rm --user postgres -v $T:/d \
  --entrypoint /usr/lib/postgresql/bin/pg_resetwal supabase/postgres:15.8.1.085 -n /d   # dry-run
docker run --rm --user postgres -v $T:/d \
  --entrypoint /usr/lib/postgresql/bin/pg_resetwal supabase/postgres:15.8.1.085 -f /d   # real
docker run -d --name pgtest --user postgres -v $T:/var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=test -p 127.0.0.1:55432:5432 supabase/postgres:15.8.1.085
```

`pg_resetwal` **descarta transações não-checkpointadas** e pode deixar o catálogo
inconsistente. Serve só pra abrir o banco e extrair um dump — o cluster resultante
**não volta pra produção**.

**Passo 4 — procurar dano de catálogo** (a assinatura de WAL perdido):

```sql
SELECT c.oid, c.relname, c.relnatts AS pg_class_diz,
       (SELECT count(*) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0) AS reais
FROM pg_class c
WHERE c.relkind='r' AND c.relnamespace='public'::regnamespace
  AND c.relnatts <> (SELECT count(*) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0);
```

Se der linha, é `ALTER TABLE` que morreu pela metade: `pg_class` conta N colunas e
`pg_attribute` tem N-1. **Qualquer query naquela tabela falha** com
`pg_attribute catalog is missing 1 attribute(s)`.

Achar o buraco e identificar a coluna pelo dump de schema versionado:

```sql
SELECT g FROM generate_series(1, <relnatts>) g
WHERE NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=<oid> AND attnum=g);
```

Cruze os `attnum` vizinhos com o `CREATE TABLE` do dump — a ordem bate e revela a
coluna perdida. Reinserir em `pg_attribute` exige `allow_system_table_mods=on`;
é cirurgia de catálogo, faça só na cópia e com o tipo exato do dump.

**Passo 5 — extrair e recarregar limpo:**

```bash
docker exec pgtest pg_dumpall -U postgres > /root/resgate.sql
```

Restaure num cluster **novo e vazio**. Não reaproveite o PGDATA remendado.

### `pg_resetwal`: os três parâmetros que quase sempre faltam

Rodar só `-f` costuma não bastar. Cada omissão dá um erro diferente:

| Erro ao subir | Parâmetro que falta |
|---|---|
| catálogo/linhas "sumidas", `relnatts` maior que `pg_attribute` | `-x <NextXID>` |
| `MultiXactId N has not been created yet -- apparent wraparound` | `-m <next>,<oldest>` |
| `xlog flush request X is not satisfied --- flushed only to Y` | `-l <arquivo WAL>` |

Como achar os valores **sem chutar**, olhando o que existe no disco:

```bash
ls -la $PGDATA/pg_xact/            # cada segmento cobre 1.048.576 XIDs
# 0000..0003 com o ultimo de 237568 bytes -> 3*1048576 + 237568*4 = 4.096.000
ls -la $PGDATA/pg_multixact/offsets/   # cada segmento cobre 65.536 multixacts
```

O `-x` tem que cair **dentro** de um segmento existente do `pg_xact`, senão o Postgres
morre com `Could not open file "pg_xact/000N"`. Errar para baixo deixa dados invisíveis;
errar para cima quebra o boot. O `-l` tem que ser **maior** que o maior LSN gravado nas
páginas (o número aparece na própria mensagem de erro do checkpoint).

Um `pg_control` apontando para um checkpoint muito antigo **não significa** que os dados
são antigos. Antes de anunciar perda, ajuste o `-x` e confira `max()` de uma coluna de
data — o dado costuma estar lá, só invisível.

### Efeitos colaterais do `pg_resetwal` no catálogo

Depois do reset, o catálogo fica com fantasmas que aparecem em um snapshot e somem em outro:

- **`pg_dump` trava e não há como destravar.** Ele varre o catálogo inteiro e enxerga
  tuplas que a sua sessão não enxerga — então você não consegue apagá-las. Não insista.
  **Use `COPY` tabela a tabela**, que só toca a tabela pedida e funciona.
- `duplicate key ... already exists` num `INSERT` de linha que o `SELECT` não acha:
  índice de catálogo com entrada órfã. `REINDEX` às vezes resolve; se não, é fantasma.
- Tabela com `relnatts` diferente da contagem de `pg_attribute`: `ALTER TABLE` que morreu
  pela metade. Se as colunas faltantes são novas e vazias, o conserto limpo é **reverter
  `relnatts`** para o valor anterior, não recriar a coluna à mão.

### Ordem de preferência na recuperação

1. Backup lógico recente (`pg_dump`) — sempre o melhor
2. Snapshot/volume do provedor
3. `pg_resetwal` numa cópia + extração por `COPY` + recarga em cluster limpo
4. Extração manual de heap (`pg_filedump`) — último recurso

---

## 7. Gotchas da imagem `supabase/postgres`

**`postgres` NÃO é superuser real.** Na imagem do Supabase o superuser é **`supabase_admin`**.
Comandos de catálogo/manutenção falham com `permission denied` se você usar `-U postgres`:

```bash
docker exec $DB psql -U supabase_admin -d postgres -c "..."   # ✅
docker exec $DB psql -U postgres -d postgres -c "..."         # ❌ permission denied
docker exec $DB psql -U supabase_admin -tAc "SELECT rolname FROM pg_roles WHERE rolsuper;"
```

**`allow_system_table_mods` não é settável em runtime** — precisa subir o servidor com ele:

```bash
docker run ... supabase/postgres:15.8.1.085 postgres -c allow_system_table_mods=on
```

**`pg_resetwal` recusa rodar como root.** Use `--user postgres` (uid 105) e ajuste o dono
do diretório antes (`chown -R 105:106 $PGDATA`).

**`postmaster.pid` sobrevive ao `docker rm`.** Se o `pg_resetwal` disser
*"Is a server running?"* com o container já removido, apague o arquivo antes.

**`gen-env.sh`** (`supabase/gen-env.sh` no repo do CRM) gera só `POSTGRES_PASSWORD`.
Ele **não** gera `ANON_KEY`/`SERVICE_ROLE_KEY` a partir do `JWT_SECRET` — é aí que nasce
o par inconsistente descrito na seção 8. Ao criar um stack novo, gere os três juntos.

## 8. Stack novo do Supabase: dois erros que dão 503 no realtime

**Chaves de pares diferentes.** Se `ANON_KEY` não foi assinada com o `JWT_SECRET` que está
nos containers, o healthcheck do realtime (que usa a própria anon key) devolve 403, o
container fica `unhealthy` e o proxy responde **503** no WebSocket. Verifique a assinatura
em vez de comparar de olho:

```python
# HS256: base64url(HMAC(secret, header.payload)) tem que bater com a assinatura
expected = b64u(hmac.new(secret.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest())
```

Se não bater, regere `ANON_KEY` e `SERVICE_ROLE_KEY` a partir do `JWT_SECRET` **atual**
(mantendo `ref`, `iat` e `exp`). Não mexa no `JWT_SECRET`.

**Alias de rede faltando.** O `kong.yml` do Supabase roteia o WebSocket para o hostname
fixo `realtime-dev.supabase-realtime:4000` — que no compose oficial é o `container_name`.
Em EasyPanel/compose customizado o container vira `<stack>-realtime-1` e o Kong **não
resolve o upstream** → 503, mesmo com o realtime `healthy`. Corrija no compose:

```yaml
  realtime:
    networks:
      default:
        aliases: [realtime-dev, realtime-dev.supabase-realtime]
```

Diagnóstico rápido: `docker exec <kong> getent hosts realtime-dev.supabase-realtime`.
**Reinicie o Kong depois** — ele cacheia DNS e não pega o alias novo sozinho.

## 9. Restaurando dados em cluster limpo

- **`TRUNCATE ... CASCADE` leva as filhas junto.** `TRUNCATE leads CASCADE` apaga
  `mensagens`, `historico_alteracoes`, `atividades` e mais. Confira as dependências antes,
  ou use `DELETE`.
- **Colunas camelCase precisam de aspas** no `\copy`. O header do CSV traz `isAdmin`, mas
  sem aspas o Postgres procura `isadmin` e falha. Gere a lista de colunas já quotada.
- **Colunas geradas não aceitam INSERT** (`auth.users.confirmed_at`,
  `auth.identities.email`). Importe numa staging onde a coluna é normal e faça
  `INSERT ... SELECT` omitindo-a.
- **`\copy` cortado deixa CSV truncado sem erro.** Confira se o arquivo termina em newline
  e se a última linha tem o mesmo número de delimitadores do header.
- **`session_replication_role = replica`** desliga FK e trigger durante a carga — permite
  importar em qualquer ordem. Lembre de voltar para `origin`.

## 10. Checklist rápido

**Antes de escrever:**
- [ ] DDL e backfill em arquivos separados
- [ ] `lock_timeout` + `statement_timeout` no topo
- [ ] Backfill em lotes com `COMMIT`, `WHERE` que exclui o já-feito
- [ ] Índice novo com `CONCURRENTLY`
- [ ] Sem default volátil em `ADD COLUMN`
- [ ] Tabela nova com RLS + `REVOKE` de `anon, authenticated`
- [ ] View nova com `security_invoker = true`

**Antes de aplicar:**
- [ ] Testado em cópia/staging
- [ ] `pg_dump` feito e conferido (não veio vazio)
- [ ] Disco com folga > 3× a maior tabela tocada
- [ ] Monitor de disco e `pg_wal` rodando em outro terminal

**Depois:**
- [ ] Dump de schema versionado regenerado
- [ ] `types.ts` regenerado
- [ ] Migration commitada (nunca só aplicada à mão)

**Se der errado:**
- [ ] `docker stop` e **copiar o PGDATA** antes de tentar qualquer conserto
- [ ] Nunca apagar `pg_wal`
- [ ] Toda tentativa de reparo roda em cópia, nunca no original
