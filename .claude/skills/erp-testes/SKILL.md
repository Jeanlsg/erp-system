---
name: erp-testes
description: Como testar o ERP X-Life em todas as camadas — unitário (vitest), lint/tipos/build, conferência front × servidor (acha botão que chama RPC/tabela/função inexistente), RLS com JWT simulado, E2E no navegador com Playwright e conta de teste, fiscal em homologação, ensaio de backup/virada e auditoria funcional tela a tela — com as regras de segurança para testar em produção. Use antes de publicar, para validar uma correção, investigar "botão que não faz nada", ou montar uma bateria de testes.
---

# Testes do ERP X-Life

Carregue o `.env` quando precisar da VPS: `source .claude/skills/erp-deploy/scripts/env.sh`.

## Regras de segurança (valem sempre)

- Há **só produção** (sem staging). Em produção: nada destrutivo nem com efeito externo
  (excluir, enviar e-mail/WhatsApp, emitir/cancelar nota, gerar cobrança) sem pedido explícito.
  Documente o que não foi testado por isso.
- Teste de escrita no banco: dentro de `BEGIN … ROLLBACK`.
- E2E com **conta de teste** (`ERP_TESTE_EMAIL`/`ERP_TESTE_SENHA`): criar, usar, **desativar ao fim**.
- **Só dados fictícios.** Nenhum print com cliente real; se não der para evitar, borre antes de salvar.
- Não corrija sem aprovação durante uma auditoria: registre, classifique e proponha.

## Camadas, da mais barata à mais cara

| # | Camada | Comando | Pega |
|---|---|---|---|
| 1 | Unitário | `npx vitest run` | regra pura em `src/lib/*` e componentes com `.test.ts` |
| 2 | Lint | `npx eslint src` | hook depois de `return` (já deu tela branca); não está no build |
| 3 | Tipos | `npx tsc --noEmit` | contrato de hook/tipo quebrado |
| 4 | Build | `npx vite build` | import/asset quebrado |
| 5 | Front × servidor | `bash .claude/skills/erp-testes/scripts/conferir-chamadas.sh` | `.rpc`, `.from` e `functions.invoke` que não existem na VPS (buckets `certificados`, `fiscal`, `midias` aparecem como "fora" e estão certos) |
| 6 | RLS | receita na skill `erp-banco-rls` | policy que barra o papel real da tela |
| 7 | E2E | Playwright (abaixo) | fluxo inteiro na tela |
| 8 | Fiscal | skill `erp-fiscal` (dry-run e homologação) | XML inválido, rejeição |
| 9 | Ensaio | `scripts/RESTAURAR-BACKUP.md` num banco clone | migration destrutiva, script da virada |

Mudança em regra de negócio: extraia para função pura em `src/lib/` e escreva o teste junto
(padrão de `pagamentos-venda`, `faixas-comissao`, `fechamento-por-forma`).

## E2E com Playwright

O projeto não tem Playwright nas dependências; instale fora do repo:

```bash
T="$(mktemp -d)"; cd "$T" && npm i -s playwright@1 && npx playwright install chromium
```

Login (o mesmo do gerador de tutoriais, `scripts/gerar-tutoriais.mjs`):

```js
await page.goto(`${process.env.ERP_URL}/login`, { waitUntil: "networkidle" });
await page.fill("#email", process.env.ERP_TESTE_EMAIL);
await page.fill("#senha", process.env.ERP_TESTE_SENHA);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"));
```

- Local: `npm run dev` sobe em `http://localhost:3000`, contra o **mesmo banco de produção** do `.env`.
- Escopo em `page.locator("main")`: sem isso os grupos do menu lateral entram como controles.
- Botão só com ícone: leia `title`/`aria-label`.
- Registre `console` (erros), `requestfailed` e respostas HTTP ≥ 400 — é por aí que aparece o
  PGRST201 (lista vazia sem exceção) e o 401/403 de RLS.
- Confirme o efeito **no banco**, não só na tela: toast verde já mentiu (LGPD "confirmava" sem gravar).

## Auditoria funcional (tela a tela)

Método de `docs/auditoria/`: para cada página ativa, abrir, acionar cada controle, conferir o
efeito no banco, classificar (bloqueante / grave / menor) e propor a correção. O relatório
final fica em `docs/auditoria/99-relatorio-final.md`. Páginas desligadas por flag são auditadas à parte.

## Antes de publicar

```bash
npx eslint src && npx tsc --noEmit && npx vitest run && npx vite build \
  && bash .claude/skills/erp-testes/scripts/conferir-chamadas.sh
```
