# Plano · Páginas Faltantes e Otimização do Banco (xlifevps)

**Projeto:** `erp-system` → `https://erp.lojaxlife.com.br`
**Banco:** Supabase self-hosted `apps_supabase` na VPS **xlifevps** (187.127.38.203), schema `erp`
**Data da auditoria:** 11/08/2026
**Método:** leitura de `src/App.tsx` (105 rotas), `src/components/app-sidebar.tsx` (89 itens de menu),
60 arquivos em `src/pages/`, comparação com o ERP de referência (`supplement-store-erp-x-life/src/routes/`)
e inspeção direta do Postgres via `ssh xlifevps → docker exec apps_supabase-db-1 psql`.

> ⚠️ O `MAPA_UNIFICADO.md` declara **"100% implementado"**. Isso não bate com o código: 13 telas do menu
> renderizam apenas um placeholder, 6 arquivos de página existem mas não estão roteados, e ~20 telas são
> somente-leitura (sem criar/editar/excluir). Este documento substitui aquele status.

---

## Sumário executivo

| Frente | Achado | Severidade |
|---|---|:--:|
| Telas do menu que abrem placeholder | 13 | 🔴 |
| Páginas do modelo de referência sem nenhuma rota | 8 | 🟠 |
| Arquivos de página prontos mas não roteados (código morto) | 6 | 🟠 |
| Telas existentes sem CRUD (só leitura) | 20 | 🟠 |
| Links/botões apontando para rota inexistente | 2 | 🟡 |
| Botões sem ação nenhuma (`<Button>` sem `onClick`) | 15 | 🟡 |
| Rota duplicada (a 2ª nunca é usada) | 1 | 🟡 |
| Políticas RLS sem `initplan` (avaliadas linha a linha) | 154 | 🔴 |
| Chaves estrangeiras sem índice | 86 | 🟠 |
| Tabelas com política `USING (true)` para qualquer autenticado | 4 | 🔴 |
| Tabelas nunca analisadas (`reltuples = -1`) | 64 de 66 | 🟠 |
| Tabelas no banco sem nenhum uso no front | 10 | 🟡 |

---

# PARTE A — Páginas que faltam

## A1 · Telas do menu que abrem só um placeholder 🔴

Estão no menu lateral, o usuário clica e vê um card "em construção". São as mais urgentes porque
já estão visíveis para o cliente.

| # | Item do menu | Rota | Arquivo atual | O que precisa ser feito |
|:-:|---|---|---|---|
| 1 | Pedido / Pré-venda | `/controle-comercial/pedido` | `controle-comercial.tsx` | CRUD de pedido sobre `erp_pedidos` + conversão em venda |
| 2 | Orçamento | `/controle-comercial/orcamento` | `controle-comercial.tsx` | Orçamento com validade e conversão em pedido/venda — **falta tabela** |
| 3 | Ordem de Serviço | `/controle-comercial/os` | `controle-comercial.tsx` | OS (abertura, técnico, peças, mão de obra) — **falta tabela** |
| 4 | Venda Consignada | `/controle-comercial/consignacao` | `controle-comercial.tsx` | Saída consignada + acerto/retorno — **falta tabela** |
| 5 | Locação | `/controle-comercial/locacao` | `controle-comercial.tsx` | Contrato de locação, período, devolução — **falta tabela** |
| 6 | Transferências | `/estoque.transferencia` | `estoque.transferencia.tsx` | Já existe `remessas.tsx` funcional — **basta corrigir a rota** (ver A5) |
| 7 | Pedidos iFood | `/ifood` | `integracoes.tsx` | Integração iFood (ou remover do menu até haver contrato) |
| 8 | ExApp Pedidos | `/exapp-pedidos` | `integracoes.tsx` | Pedidos via WhatsApp (UAZAPI já roda na mesma VPS) |
| 9 | TEF / SITEF | `/tef-sitef` | `integracoes.tsx` | Integração TEF |
| 10 | iFood Marketplace | `/marketplace-ifood` | `marketplace-ifood.tsx` | Idem #7 |
| 11 | Treinamento | `/treinamento/tutoriais` | `treinamento.tsx` | Lista de vídeos/materiais (pode usar `erp_downloads`) |
| 12 | Ajuda | `/ajuda` | `ajuda.tsx` | FAQ / central de ajuda |
| 13 | Serviços Oferecidos | `/gestao/servicos` | `P()` inline no `App.tsx` | CRUD sobre `erp_servicos` (tabela existe e está vazia) |

Também são placeholders, mas **fora do menu** (rotas legado): `/fiscal`, `/configuracoes`.

---

## A2 · Páginas do ERP de referência que não existem aqui 🟠

Comparação com `supplement-store-erp-x-life/src/routes/` e `MAPA_GESTAO_EMPRESARIAL.md`.

| Página de referência | Rota esperada | Situação | Tabela no banco |
|---|---|---|:--:|
| Consulta Veículos / Frota | `/gestao/consulta-veiculos` | **não existe rota nem arquivo** | ✅ `erp_veiculos`, `erp_veiculo_abastecimentos`, `erp_veiculo_manutencoes` |
| Transportadoras | `/gestao/transportadoras` | arquivo existe, **sem rota** (link quebrado no hub) | ✅ `erp_transportadoras` |
| Agenda Telefônica | `/gestao/agenda-telefonica` | arquivo existe, **sem rota nem menu** | ✅ `erp_agenda_telefonica` |
| Relatório de Entregas Futuras | `/gestao/relatorio-entregas` | **não existe** | ⚠️ deriva de `erp_pedidos` |
| Transferência Bancária | `/gestao/transferencia-bancaria` | **não existe** | ✅ `erp_contas_bancarias` |
| Detalhe do Produto | `/produtos/:id` | **não existe** (só a listagem) | ✅ |
| Detalhe da Venda | `/vendas/:id` | **não existe** (não dá para abrir uma venda) | ✅ |
| Outbox Fiscal / detalhe NF | `/fiscal/outbox`, `/fiscal/:id` | **não existe** | ✅ `erp_notas_fiscais` |
| Nova Devolução | `/devolucoes/nova` | **não existe** (só listagem) | ⚠️ falta tabela |
| Nova Compra | `/compras/novo` | **não existe** (só listagem + importar NFe) | ✅ `erp_compras` |

**Tabelas que precisam ser criadas** para fechar o Controle Comercial e Devoluções:
`erp_orcamentos` + `erp_orcamento_itens`, `erp_ordens_servico` + `erp_os_itens`,
`erp_consignacoes` + `erp_consignacao_itens`, `erp_locacoes`, `erp_devolucoes` + `erp_devolucao_itens`.

---

## A3 · Arquivos de página prontos, porém não roteados (código morto) 🟠

Estão em `src/pages/` mas não são importados em `App.tsx` — nem entram no bundle útil, nem aparecem no menu.

| Arquivo | Linhas | Tem CRUD? | Decisão sugerida |
|---|:--:|:--:|---|
| `transportadoras.tsx` | 129 | criar/excluir + dialog | **Rotear** em `/gestao/transportadoras` + item no menu Catálogo |
| `agenda-telefonica.tsx` | 169 | criar/excluir + dialog | **Rotear** em `/gestao/agenda-telefonica` + item no menu Cadastros |
| `lotes.tsx` | 257 | criar | Redundante com `produtos-estoque-lotes.tsx` → **excluir** |
| `products.tsx` | 160 | só leitura | Redundante → **excluir** |
| `estoque.tsx` | 161 | editar | Redundante → **excluir** |
| `produtos-estoque.tsx` | 583 | CRUD completo | Versão anterior de `produtos-estoque-lotes.tsx` → **excluir após diff** |

---

## A4 · Telas existentes que são só "vitrine" (falta CRUD) 🟠

Renderizam dados do Supabase, mas não têm nenhum botão que grave. Para o ERP ser operável, cada uma
precisa de dialog de criação/edição e exclusão.

| Tela | Rota | Falta | Prioridade |
|---|---|---|:--:|
| Notas Fiscais / Faturamento | `/notas-fiscais`, `/faturamento` | **emitir NF-e/NFC-e** (não há mutation nem Edge Function de emissão) | 🔴 |
| Kits & Combos | `/kits` | criar/editar kit e seus itens (`erp_kit_itens` está morta) | 🔴 |
| Clientes | `/gestao/clientes` | criar/editar/excluir cliente | 🔴 |
| Fornecedores | `/gestao/fornecedores` | criar/editar/excluir | 🔴 |
| Compras | `/compras` | criar compra manual (hoje só importando XML) | 🔴 |
| Vendas | `/vendas` | abrir venda, cancelar, imprimir | 🟠 |
| Pedidos | `/pedidos` | criar/alterar pedido | 🟠 |
| Devoluções | `/devolucoes` | registrar devolução | 🟠 |
| Gerador de Boletos | `/gerador-boletos` | gerar boleto (linha digitável, PDF) | 🟠 |
| Promissórias | `/promissoria` | gerar promissória | 🟠 |
| Crediário Próprio | `/crediario-proprio` | gerar carnê, baixar parcela | 🟠 |
| Cartão Fidelidade | `/cartao-fidelidade` | lançar pontos (`..._movimentacoes` está morta) | 🟠 |
| E-mail Marketing | `/email-marketing` | criar campanha e disparar | 🟡 |
| Mala Direta | `/mala-direta` | criar/imprimir | 🟡 |
| Torpedos SMS | `/torpedos` | criar/enviar | 🟡 |
| Downloads | `/config/downloads` | upload de arquivo | 🟡 |
| Lojas | `/lojas` | criar/editar loja | 🟠 |
| Relatórios | `/relatorios` | filtros de período, drill-down, exportação | 🟠 |
| Config. Empresarial | `/config/empresarial` | salvar alterações | 🟠 |
| Pedidos Delivery | `/pedidos-delivery` | só muda status; falta criar/editar | 🟡 |

---

## A5 · Defeitos de roteamento 🟡

| Problema | Local | Efeito | Correção |
|---|---|---|---|
| Rota `estoque.transferencia` declarada **duas vezes** (linhas 230 e 239 do `App.tsx`) | `src/App.tsx:230` e `src/App.tsx:239` | Vence a primeira → o menu "Transferências" abre o **placeholder** em vez de `RemessasPage` | Apagar a linha 230 e o arquivo `estoque.transferencia.tsx` |
| Link para `/gestao/transportadoras` | `src/pages/gestao.tsx:9` | Rota não existe → cai no `<Navigate to="/">` e o usuário é jogado no dashboard sem aviso | Criar a rota (A3) |
| Navegação para `/dashboard` | `src/components/feature-guard.tsx:97` | Rota não existe (o dashboard é `/`) → mesmo bounce silencioso | Trocar por `/` |
| "Relatórios Financeiros" e "Contas a Pagar/Receber" apontam para a **mesma** `/financeiro` | `app-sidebar.tsx:159-160` | Dois itens de menu, uma tela só | Separar em `/financeiro` e `/financeiro/contas` |
| "Faturamento" é um alias literal de "Notas Fiscais" (`faturamento.tsx` só re-exporta) | `src/pages/faturamento.tsx` | Dois itens de menu, uma tela só | Implementar faturamento (CFOP/natureza) ou remover do menu |
| Rota `*` faz `Navigate to="/"` sem tela de 404 | `src/App.tsx:249` | Todo link quebrado vira "voltou pro dashboard sozinho" | Criar página 404 explícita |

---

# PARTE B — Botões sem ação dentro das páginas

Auditoria de `<Button>` sem `onClick`, sem `asChild` e sem `type="submit"`.

| Arquivo | Linha | Botão | O que deveria fazer |
|---|:--:|---|---|
| `customers.tsx` | 39 | "Novo Cliente" | Abrir dialog de cadastro (`erp_pessoas`) |
| `fornecedores.tsx` | 59 | "Novo Fornecedor" | Abrir dialog de cadastro |
| `lotes.tsx` | 89 | "Novo Lote" | (arquivo será removido — ver A3) |
| `orders.tsx` | 70 | "Novo Pedido" | Abrir dialog de pedido |
| `products.tsx` | 53 / 71 / 86 | "Novo Produto", "Ver lotes", ação da linha | (arquivo será removido — ver A3) |
| `financeiro.tsx` | 171 | "Nova Conta" | Dialog de conta a pagar/receber |
| `financeiro.tsx` | 310 | "Imprimir" | Gerar PDF/impressão do relatório |
| `documentos.tsx` | 111 | ícone Download | Baixar do bucket `midias` |
| `email-inteligente.tsx` | 78 | "Configurar" | Dialog de configuração da automação |
| `gesta-final.tsx` | 378 | "Imprimir Etiqueta" | Impressão de etiqueta de código de barras |
| `gesta-final.tsx` | 991 / 999 | "Gerar" (demonstrativos) | Gerar DRE / Balancete |
| `gesta-final.tsx` | 1007 | "Importar OFX" | Upload + conciliação bancária |

Além desses, todas as telas listadas em **A4** têm cabeçalho com botão de ação que não existe —
ao implementar o CRUD, o botão nasce junto.

---

# PARTE C — Banco de dados na xlifevps

## Retrato atual

- **VPS:** 2 vCPU · 7,9 GB RAM · 96 GB disco (22 GB usados) — compartilhada com CRM Overdrive, Evolution API e EasyPanel.
- **Schema `erp`:** 66 tabelas · 12 views · 154 políticas RLS · **2,5 MB** de dados.
- Volume é irrisório hoje; **nada está lento por tamanho**. Os itens abaixo são estruturais — corrigir
  agora custa uma migration, corrigir com 500 mil linhas custa uma janela de manutenção.

## C1 · RLS sem `initplan` — impacto O(linhas) 🔴

Todas as 154 políticas chamam `is_erp_admin()` / `current_erp_user_id()` **diretamente**. Sem envolver
em `(SELECT ...)`, o Postgres executa a função **uma vez por linha avaliada**.

Evidência: `erp_usuarios` tem **1 linha** e já acumulou **11.239 index scans** — são as políticas
consultando o usuário atual repetidamente. E `erp_feature_flags` (80 linhas) leva **2,24 ms de média**
por SELECT, num banco de 2,5 MB.

```sql
-- Padrão a aplicar em TODAS as políticas:
--   USING (is_erp_admin())                    →  USING ((SELECT erp.is_erp_admin()))
--   USING (current_erp_user_id() IS NOT NULL) →  USING ((SELECT erp.current_erp_user_id()) IS NOT NULL)
```

Ganho esperado: de N chamadas de função para 1 por query.

## C2 · Duas políticas permissivas por SELECT 🟠

Cada tabela tem `erp_admin_write` com `FOR ALL` **+** `erp_user_select` com `FOR SELECT`. Como `ALL`
inclui SELECT, todo SELECT avalia **as duas** políticas e faz OR do resultado.

```sql
-- Trocar o FOR ALL do admin por políticas só de escrita:
DROP POLICY erp_admin_write ON erp.<tabela>;
CREATE POLICY erp_admin_insert ON erp.<tabela> FOR INSERT TO authenticated WITH CHECK ((SELECT erp.is_erp_admin()));
CREATE POLICY erp_admin_update ON erp.<tabela> FOR UPDATE TO authenticated USING ((SELECT erp.is_erp_admin()));
CREATE POLICY erp_admin_delete ON erp.<tabela> FOR DELETE TO authenticated USING ((SELECT erp.is_erp_admin()));
```

## C3 · Furo de segurança em NFe/Remessas 🔴

4 tabelas têm políticas `USING (true)` para o papel `authenticated`, **sobrepondo** a regra de que o
usuário precisa existir em `erp_usuarios`:

- `erp_nfe_entrada` — "Usuários autenticados podem ler/inserir/atualizar NFe entrada"
- `erp_nfe_entrada_itens` — idem
- `erp_remessas` — "Usuários autenticados podem ler/inserir/atualizar remessas"
- `erp_remessa_itens` — idem

Qualquer conta criada no Auth desse Supabase (que hospeda **também o CRM Overdrive**) lê e escreve
notas fiscais de entrada e remessas do ERP. Essas 12 políticas devem ser removidas — as políticas
`erp_user_*` equivalentes já existem nessas mesmas tabelas.

```sql
DROP POLICY "Usuários autenticados podem ler NFe entrada" ON erp.erp_nfe_entrada;
DROP POLICY "Usuários autenticados podem inserir NFe entrada" ON erp.erp_nfe_entrada;
DROP POLICY "Usuários autenticados podem atualizar NFe entrada" ON erp.erp_nfe_entrada;
-- ...idem para erp_nfe_entrada_itens, erp_remessas, erp_remessa_itens
```

## C4 · Grants excessivos para `anon` 🟠

O papel `anon` (a chave pública do front, exposta no browser) tem **SELECT em todas as tabelas do
schema `erp`** e ainda **INSERT/UPDATE/DELETE em `erp_nfe_entrada`**. Hoje o RLS segura, mas é uma
única política mal escrita de distância do vazamento.

```sql
REVOKE ALL ON ALL TABLES IN SCHEMA erp FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA erp REVOKE ALL ON TABLES FROM anon;
-- authenticated mantém os grants; o RLS continua sendo a regra fina
```

## C5 · 86 chaves estrangeiras sem índice 🟠

Toda FK sem índice no lado filho torna `DELETE`/`UPDATE` do pai um seq scan e derruba a performance
de join. As mais críticas (tabelas que vão crescer):

| Tabela | Colunas sem índice |
|---|---|
| `erp_venda_itens` | `venda_id`, `produto_id`, `kit_id`, `servico_id` |
| `erp_vendas` | `usuario_id`, `vendedor_id`, `cancelado_por` |
| `erp_caixa_movimentacoes` | `caixa_id`, `pessoa_id` |
| `erp_contas` | `loja_id`, `venda_id` |
| `erp_lotes` | `produto_id`, `loja_id` |
| `erp_compras` / `erp_compra_itens` | `fornecedor_id`, `loja_id`, `usuario_id` / `compra_id`, `produto_id` |
| `erp_notas_fiscais` | `loja_id`, `venda_id` |
| `erp_pedidos` | `cliente_id`, `loja_id`, `venda_id`, `transportadora_id` |
| `erp_cheques` | `pessoa_id`, `venda_id`, `conta_id` |
| `erp_remessas` | `venda_id`, `usuario_id`, `transportadora_id`, `nfe_remessa_id`, `nfe_retorno_id`, `recebido_por` |

Lista completa reproduzível com a query do apêndice. Recomendação: gerar os `CREATE INDEX` das ~30
tabelas transacionais agora e deixar as de cadastro (que não passam de centenas de linhas) sem índice.

## C6 · Estatísticas nunca coletadas 🟠

**64 das 66 tabelas** têm `reltuples = -1` — nunca passaram por `ANALYZE`. O planner está escolhendo
plano no escuro. Custo zero para corrigir:

```sql
ANALYZE VERBOSE; -- ou: VACUUM ANALYZE erp.<tabela> tabela a tabela
```

Isso também explica os **40 índices com `idx_scan = 0`**: não são inúteis, é que o planner nunca teve
estatística para preferi-los. Reavaliar quais índices sobram **depois** do ANALYZE e de o sistema ter
volume real — não remover nada agora.

## C7 · 10 tabelas mortas (existem no banco, ninguém usa no front) 🟡

`erp_veiculos`, `erp_veiculo_abastecimentos`, `erp_veiculo_manutencoes`, `erp_kit_itens`,
`erp_venda_taxas`, `erp_comissoes`, `erp_cartao_fidelidade_movimentacoes`,
`erp_crediario_parcela_itens`, `erp_parcelamento_contas`, `erp_parcelamento_parcelas`.

Não são para excluir — são **funcionalidades pagas e não entregues**. Cada uma corresponde a um item
das partes A2/A4 (frota, itens de kit, taxas de cartão, comissão de vendedor, pontos de fidelidade,
itens do carnê, parcelamento de dívida).

## C8 · Falta de `updated_at` em 41 tabelas 🟡

Só 19 tabelas têm trigger de `updated_at`. Sem isso não há auditoria nem sincronização incremental
possível. Padronizar com a função `erp.erp_set_updated_at()` que já existe.

## C9 · Tuning do Postgres para a VPS 🟠

Configuração atual é a default do container, dimensionada para uma máquina bem menor:

| Parâmetro | Atual | Sugerido (2 vCPU / 8 GB compartilhados) | Motivo |
|---|:--:|:--:|---|
| `shared_buffers` | 128 MB | **1 GB** | 25% da RAM que sobra para o Postgres |
| `effective_cache_size` | 128 MB | **2 GB** | planner acha que não há cache e evita índice |
| `work_mem` | 4 MB | **16 MB** | sorts/joins dos relatórios financeiros |
| `maintenance_work_mem` | 64 MB | **256 MB** | acelera criação dos índices da C5 |
| `random_page_cost` | 4 | **1.1** | disco é SSD, não platter |
| `statement_timeout` | 0 (infinito) | **30 s** (role `authenticated`) | uma query travada hoje segura conexão para sempre |
| `idle_in_transaction_session_timeout` | 0 | **60 s** | evita transação órfã do PostgREST |
| `jit` | on | **off** | JIT em queries de 2 ms só adiciona latência |

`effective_cache_size` baixo é o mais grave: é ele que faz o planner desprezar índices.

## C10 · Containers da VPS 🟡

`apps_supabase-analytics-1` (Logflare) consome **589 MB** — o maior da máquina, para um ERP com 2,5 MB
de dados. `studio` + `kong` somam mais 540 MB. Em 8 GB divididos com Overdrive e Evolution API, vale
desligar o analytics (ou limitar o container a 256 MB) e liberar RAM para o Postgres da C9.

---

# Roadmap sugerido

### Sprint 1 — Correções de baixo custo e alto impacto (1–2 dias)
1. C3: remover as 12 políticas `USING (true)` de NFe/Remessas 🔴
2. C4: revogar grants de `anon`
3. C6: `ANALYZE` em todo o schema
4. C9: aplicar tuning do Postgres + reiniciar o container do banco
5. A5: corrigir rota duplicada de `/estoque.transferencia`, `/dashboard`, e criar rota de Transportadoras
6. A3: rotear `transportadoras.tsx` e `agenda-telefonica.tsx`, remover os 4 arquivos redundantes

### Sprint 2 — CRUD do que já está na tela (3–5 dias)
7. A4 prioridade 🔴: Clientes, Fornecedores, Kits, Compras, Lojas
8. B: ligar os 15 botões órfãos
9. C1 + C2: reescrever as políticas RLS com `(SELECT ...)` e separar admin write

### Sprint 3 — Telas do Controle Comercial (5–8 dias)
10. Migrations das tabelas novas (orçamento, OS, consignação, locação, devolução)
11. A1 itens 1–5 e 13: Pedido, Orçamento, OS, Consignação, Locação, Serviços
12. C5: índices de FK das tabelas transacionais

### Sprint 4 — Fiscal e detalhes (5–8 dias)
13. Emissão real de NF-e/NFC-e (Edge Function + `erp_notas_fiscais`) 🔴
14. A2: detalhe de produto, detalhe de venda, outbox fiscal
15. Frota (`/gestao/consulta-veiculos`), Relatório de Entregas, Transferência Bancária

### Sprint 5 — Integrações e acabamento
16. A1 itens 7–12: iFood, ExApp/WhatsApp, TEF, Treinamento, Ajuda
17. C8: triggers de `updated_at`
18. Página de 404 real, exportações e impressões (PDF/CSV)

---

# Apêndice · Queries de verificação

```sql
-- FKs sem índice
SELECT c.conrelid::regclass AS tabela, a.attname AS coluna, c.conname
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
JOIN LATERAL unnest(c.conkey) k(attnum) ON true
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
WHERE c.contype = 'f' AND n.nspname = 'erp'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]
  )
ORDER BY 1, 2;

-- Políticas que ainda chamam função sem (SELECT ...)
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'erp'
  AND qual ~ '(is_erp_admin|current_erp_user_id)\(\)'
  AND qual !~ 'SELECT';

-- Tabelas sem estatística
SELECT relname, reltuples FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'erp' AND c.relkind = 'r' AND c.reltuples = -1;
```

Acesso: `ssh xlifevps 'docker exec -i apps_supabase-db-1 psql -U supabase_admin -d postgres' < arquivo.sql`
