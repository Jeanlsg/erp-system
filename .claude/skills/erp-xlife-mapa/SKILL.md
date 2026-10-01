---
name: erp-xlife-mapa
description: Ponto de entrada do ERP X-Life (repo erp-system) — o que o sistema faz, a stack inteira, onde cada coisa vive, convenções, variáveis do .env, o estado atual e o que falta para concluir o projeto, e qual skill do projeto usar em cada área. Use no começo de qualquer tarefa no erp-system, quando não souber onde algo está, ao planejar trabalho novo ou ao responder "o que falta".
---

# ERP X-Life — mapa do projeto

ERP de uma loja de suplementos com **duas filiais** (Petrolina-PE e Juazeiro-BA, a matriz),
optante do **Simples Nacional**, com PDV que emite NFC-e, estoque com lotes e validade,
financeiro, fiscal (NF-e, NFC-e, DF-e, SPED) e integração com o CRM da própria loja.
Tudo self-hosted numa VPS com EasyPanel.

## Stack

| Camada | Tecnologia | Onde |
|---|---|---|
| Front | React 18 + Vite 5 + TypeScript, Tailwind + shadcn/Radix, TanStack Query 5, zustand, react-router 6, recharts, zod/react-hook-form | `src/` |
| Servir o front | Docker (build Vite → nginx), EasyPanel constrói do GitHub por webhook | `Dockerfile`, `nginx.conf` |
| Banco | Supabase self-hosted: Postgres 15, PostgREST, GoTrue, Storage, pg_cron. Schema **`erp`** (este sistema) e **`public`** (o CRM) **no mesmo banco** | `supabase/migrations/NNN_*.sql` |
| Funções | Edge functions Deno (`erp-*`), publicadas por cópia no volume da VPS | `supabase/functions/` |
| Fiscal | `nfe-service`: PHP 8.3 + sped-nfe, container na rede interna, Bearer token | `services/nfe-service/` |
| Offline | Service worker (`public/sw.js`) + IndexedDB (`src/lib/offline/`), fila de vendas cifrada e idempotente | |
| Testes | vitest (unitário), eslint, tsc; Playwright só para gerar tutoriais | `src/**/*.test.ts` |

## Onde as coisas vivem

- `src/pages/` — 66 telas. As grandes: `pdv.tsx`, `produtos-estoque-lotes.tsx`, `usuarios.tsx`, `notas-fiscais.tsx`, `financeiro.tsx`.
- `src/lib/supabase-queries.ts` — todos os hooks de dados (~6 mil linhas). Chave de query estável e invalidação por função única (ex.: `invalidarProdutos`).
- `src/lib/store/auth-store.ts` — usuário logado, `can()`, papéis.
- `src/components/app-sidebar.tsx` — `sections` é a fonte única do menu **e** da tela "Páginas do sistema".
- `src/lib/offline/` — `db.ts`, `cifra.ts`, `fila-vendas.ts`, `catalogo.ts`, `conexao.ts`.
- `supabase/functions/erp-*` — emissão fiscal, eventos, DF-e, SPED, DANFE, envio de nota, criação de usuário, sync com o CRM.
- `scripts/` — `backup-diario.sh`, `RESTAURAR-BACKUP.md`, `virada-producao.sql`, `dados-demonstracao.sql`, `gerar-tutoriais.mjs`, `rotacionar-chave-certificado.sh`.
- `docs/` — `RUNBOOK-DADOS-REAIS.md` (virada para produção), `auditoria/` (auditoria funcional por módulo), `guia/` (PDF do cliente).

## Convenções

- Tudo em português: código de domínio, comentários, commits, mensagens de tela.
- Comentário explica **por quê**, com `⚠️` no que já causou bug. Leia os comentários antes de mudar um trecho: quase todos registram um defeito real.
- Migration nova = próximo número (`NNN_nome.sql`), `BEGIN/COMMIT`, idempotente.
- **Gravou? Diga o domínio que mudou:** `invalidarDominios(qc, "estoque")` / `...DOMINIOS_DA_VENDA`
  (`src/lib/dominios-cache.ts`), nunca uma lista de chaves solta.
- **Lista que pode passar de 1000 linhas:** `lerTudo(() => consulta.order(…).order("id"))`
  (`src/lib/ler-tudo.ts`). O PostgREST corta em 1000 sem erro.
- Cache: `staleTime` padrão 30 s e releitura ao voltar à aba (`src/main.tsx`). O cache inteiro é
  persistido no `localStorage` por 24 h.
- Cliente Supabase do front usa `db: { schema: 'erp' }`; por `curl`, mande `Accept-Profile: erp`.
- Nada de dado real em código, doc ou print: vai no `.env` (ignorado pelo git).

## Variáveis do `.env` (valores reais só lá; nomes em `.env.example`)

Carregue com `source .claude/skills/erp-deploy/scripts/env.sh`.

| Variável | Para quê |
|---|---|
| `ERP_SSH_HOST` | alias SSH da VPS |
| `ERP_URL` | URL pública do ERP |
| `ERP_DEPLOY_WEBHOOK` | webhook de deploy do EasyPanel (**segredo**) |
| `ERP_APP_SERVICE`, `ERP_APP_CODE_DIR` | serviço Swarm do front e checkout que o EasyPanel construiu |
| `ERP_DB_CONTAINER`, `ERP_REST_CONTAINER`, `ERP_FUNCTIONS_CONTAINER`, `ERP_FUNCTIONS_DIR` | Supabase na VPS |
| `ERP_NFE_SERVICE_CONTAINER`, `ERP_NFE_SERVICE_DIR`, `ERP_DOCKER_NETWORK` | nfe-service |
| `ERP_BACKUP_DIR` | backups diários |
| `ERP_LOJA_PETROLINA_ID`, `ERP_LOJA_JUAZEIRO_ID` | ids das lojas |
| `ERP_ADMIN_EMAIL`, `ERP_ADMIN_USER_ID` | dono do sistema (admin principal) |
| `ERP_TESTE_EMAIL`, `ERP_TESTE_SENHA` | conta de teste para E2E/tutoriais |
| `CRM_REPO_DIR` | checkout local do CRM (onde vive a `api-leads`) |

## Qual skill usar

| Área | Skill do projeto |
|---|---|
| Publicar front, edge function, migration, nfe-service; conferir o que está no ar | `erp-deploy` |
| Migration, RLS, função SQL, PostgREST, backup, script da virada | `erp-banco-rls` (+ `supabase-migrations-seguras` para DDL pesada) |
| NF-e, NFC-e, eventos, DF-e, SPED, certificado, regras de BA/PE | `erp-fiscal` |
| IBS/CBS, NT 2025.002, 2027 | `erp-reforma-ibs-cbs` |
| PDV, pagamento, caixa, offline, atalhos | `erp-pdv-caixa` |
| Qualquer teste: unitário, lint, RLS, E2E, homologação, auditoria | `erp-testes` |
| Venda → lead no CRM, busca de lead, ganho | `erp-integracao-crm` |
| Papéis, permissões, usuários × funcionários, páginas ligadas/desligadas | `erp-permissoes-paginas` (+ `rbac-telas-por-cargo`) |
| Tutoriais com print, guia em PDF, dados de demonstração | `erp-tutoriais-guia` |
| Layout que quebra em telas pequenas | `responsive-design` |
| Envio de nota pelo WhatsApp (Uazapi) | `uazapi` |

## Estado (30/09/2026)

- Produção com dados **limpos** desde 12/09 (script da virada). Preservados: lojas, certificados, config SEFAZ, a conta do cliente.
- **Nenhuma nota emitida em produção.** As duas lojas em **homologação**, sem CSC; Juazeiro sem certificado vinculado na config SEFAZ.
- Front publicado atrás do `main` (confira com `erp-deploy/scripts/verificar-deploy.sh`).
- Edge functions `erp-*` e nfe-service iguais ao repositório.
- `.gitignore` ignora `.github/`: o workflow `migrations.yml` existe só localmente e **não roda** no GitHub.
- Lint não faz parte do build: rode `npx eslint src` antes de publicar (já houve tela branca por hook depois de `return`).

## O que falta para concluir (por prioridade)

**Go-live fiscal**
1. CSC de produção nas duas lojas, certificado de Juazeiro, troca para produção (ordem no `docs/RUNBOOK-DADOS-REAIS.md`).
2. Devolução: `refNFe` é proibido na NF-e de devolução a partir de 05/10/2026 → usar `DFeReferenciado` por item (regra VC02-14). Hoje o nfe-service usa `refNFe`.
3. Rever a opção "Sem nota" do PDV e a venda offline sem cupom no ato (ver `erp-fiscal`).

**Conformidade (ver `erp-fiscal`)**
4. PE: pagamento eletrônico vinculado à NFC-e (TEF) — obrigatório desde 2019.
5. Pagamento detalhado na nota (hoje só a forma principal), valor aproximado dos tributos (Lei 12.741), CPF obrigatório por valor e em entrega.
6. Devolução de consumidor com nota de entrada, parcial, sem exigir CPF; unificar com a tela Devoluções.
7. Antecipação de ICMS nas compras interestaduais (BA e PE); EFD mensal de Juazeiro (BA exige do Simples).

**2027 (ver `erp-reforma-ibs-cbs`)**
8. Grupo IBS/CBS em cada item até **04/01/2027** (senão, rejeição 1115); schema PL_010 no nfe-service.

**Condicional**
9. NFS-e pelo Emissor Nacional (obrigatória desde 01/11/2026) se a loja prestar serviço.

**Privacidade**
10. O persister do React Query grava TODAS as consultas no `localStorage` por 24 h — CPF de
    cliente, contas, usuários — no computador do balcão. Proposta: persistir só o que precisa
    abrir sem internet (catálogo já tem espelho próprio em IndexedDB).
