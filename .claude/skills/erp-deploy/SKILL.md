---
name: erp-deploy
description: Publicar e conferir o ERP X-Life na VPS — front (webhook do EasyPanel), edge functions erp-*, migrations do schema erp e o nfe-service — com as regras que já derrubaram produção. Use para "sobe/publica/deploy", "está no ar?", "o que está publicado", rollback, ou antes de qualquer mudança que precise chegar à produção.
---

# Deploy do ERP X-Life

Todos os valores reais (host, webhook, containers, caminhos) estão no `.env`. Carregue antes:

```bash
source .claude/skills/erp-deploy/scripts/env.sh
```

**Conferir o que está no ar (só leitura):** `bash .claude/skills/erp-deploy/scripts/verificar-deploy.sh`
— mostra o container do front, o commit que o EasyPanel construiu, e se nfe-service e cada edge function `erp-*` batem com o repositório.

## Regras que não se negociam

1. **Publicar é ação com efeito externo.** Só com pedido explícito do usuário.
2. **Um deploy de front por vez.** Dois webhooks seguidos se cancelam; em 23/09/2026 o segundo abortou o build do primeiro e derrubou o EasyPanel.
3. **O webhook constrói do GitHub:** `git push` antes de disparar.
4. **Verificar pelo container novo + `healthy` + commit construído**, nunca pelo HTTP 200 do webhook nem por "Up N minutes".
5. **Antes de publicar o front**, localmente (o lint não está no build):
   ```bash
   npx eslint src && npx tsc --noEmit && npx vitest run && npx vite build
   ```

## Front

```bash
git push origin main
curl -s -o /dev/null -w "webhook HTTP %{http_code}\n" -X POST "$ERP_DEPLOY_WEBHOOK"
# 2–4 min depois:
bash .claude/skills/erp-deploy/scripts/verificar-deploy.sh   # container novo, healthy, commit = origin/main
```

O service worker serve a navegação em network-first: a versão nova chega no próximo carregamento de página. Aba aberta num SPA não recarrega sozinha.

## Edge functions (`erp-*`)

Publicação = copiar os `.ts` da função (menos os `*.test.ts`) para o volume e reiniciar o
container de funções. ⚠️ Função com mais de um arquivo (`erp-emitir-nfe` importa `./rateio.ts`):
copiar só o `index.ts` derruba a função com "module not found".

```bash
f=erp-emitir-nfe
for a in supabase/functions/$f/*.ts; do
  case "$a" in *.test.ts) continue;; esac
  n=$(basename "$a")
  ssh "$ERP_SSH_HOST" "[ -f '$ERP_FUNCTIONS_DIR/$f/$n' ] && cp '$ERP_FUNCTIONS_DIR/$f/$n' '$ERP_FUNCTIONS_DIR/$f/$n.bak-$(date +%Y%m%d)'; true"
  scp -q "$a" "$ERP_SSH_HOST:$ERP_FUNCTIONS_DIR/$f/$n"
done
ssh "$ERP_SSH_HOST" "docker restart $ERP_FUNCTIONS_CONTAINER"
bash .claude/skills/erp-deploy/scripts/verificar-deploy.sh   # compara todos os .ts
```

- O volume de funções é **compartilhado com o CRM**. Nunca sincronize a pasta inteira; copie só a função que mudou.
- Função do CRM (`api-leads` etc.) vive no repo do CRM (`$CRM_REPO_DIR`) e vai para outras VPS também — mudança lá precisa de commit **no repo do CRM**.
- Logs: `ssh "$ERP_SSH_HOST" "docker logs --since 15m $ERP_FUNCTIONS_CONTAINER 2>&1 | grep -i erp-"`.

## Migrations (schema `erp`)

```bash
ssh "$ERP_SSH_HOST" "docker exec -i $ERP_DB_CONTAINER psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -At" \
  < supabase/migrations/NNN_nome.sql
# tabela, view ou função NOVA: o PostgREST cacheia o schema
ssh "$ERP_SSH_HOST" "docker exec $ERP_DB_CONTAINER psql -U supabase_admin -d postgres -c \"NOTIFY pgrst, 'reload schema';\""
# se a tela nova continuar vazia (PGRST205): docker restart $ERP_REST_CONTAINER
```

- Migration destrutiva ou pesada: ensaie num clone do backup antes (receita em `erp-banco-rls`) e siga `supabase-migrations-seguras`.
- O workflow `.github/workflows/migrations.yml` **não roda**: o `.gitignore` ignora `.github/`. Aplicação é manual, como acima.

## nfe-service

O código fica em `services/nfe-service/`; na VPS, em `$ERP_NFE_SERVICE_DIR`, e roda como container avulso na rede `$ERP_DOCKER_NETWORK` (sem porta pública).

```bash
rsync -a --exclude vendor services/nfe-service/ "$ERP_SSH_HOST:$ERP_NFE_SERVICE_DIR/"
ssh "$ERP_SSH_HOST" "
  cd $ERP_NFE_SERVICE_DIR && docker build -t nfe-service:latest . &&
  TOKEN=\$(docker inspect $ERP_NFE_SERVICE_CONTAINER --format '{{range .Config.Env}}{{println .}}{{end}}' | grep ^NFE_SERVICE_TOKEN= | cut -d= -f2-) &&
  docker rm -f $ERP_NFE_SERVICE_CONTAINER &&
  docker run -d --name $ERP_NFE_SERVICE_CONTAINER --network $ERP_DOCKER_NETWORK --restart unless-stopped \
    -e NFE_SERVICE_TOKEN=\"\$TOKEN\" -e TZ=America/Bahia nfe-service:latest"
```

- `composer.lock` trava a versão do sped-nfe: sem ele, um rebuild já pulou de 5.1 para 5.2 e quebrou `model()`.
- Leia o token do container atual antes de removê-lo: ele é o mesmo que as edge functions usam.
- Teste sem SEFAZ: `services/nfe-service/tests/dryrun-nfce.php` (instruções no cabeçalho).

## Rollback

- **Front:** `git revert` do commit + novo deploy (um só).
- **Edge function:** copiar de volta o `index.ts.bak-AAAAMMDD` e reiniciar o container.
- **Migration:** escreva o SQL de volta **antes** de aplicar. Dados apagados só voltam pelo backup (`scripts/RESTAURAR-BACKUP.md`).
