# Plano Funcional · Deixar o ERP 100% operável

**Base:** auditoria completa em [PLANO_PAGINAS_E_OTIMIZACOES.md](PLANO_PAGINAS_E_OTIMIZACOES.md) (11/08/2026).
**Meta deste plano:** eliminar todo placeholder acessível pelo menu, ligar todo botão morto,
dar CRUD às telas vitrine e sanear o banco na xlifevps — nesta ordem, com implementação em seguida.

**Definição de "funcional" adotada:**
- Nenhum item de menu abre tela "em construção".
- Toda listagem tem criar / editar-ou-status / excluir quando a operação faz sentido.
- Nenhum `<Button>` renderizado sem handler.
- Nenhum link interno aponta para rota inexistente.
- Banco sem política insegura, com initplan nas RLS, FKs indexadas e estatísticas coletadas.

**Fora de escopo (dependência externa real, fica documentado e a UI deixa claro o estado):**
- Transmissão de NF-e/NFC-e à SEFAZ (exige certificado ativo + homologação; a UI de faturamento
  registra a nota localmente com status `pendente_transmissao`).
- Contratos iFood / TEF-SITEF / provedor de SMS (as telas viram páginas de configuração persistida,
  com status claro de "não conectado", em vez de placeholder).

---

## Fase 1 · Rotas e limpeza (código)

| # | Ação | Arquivos |
|:-:|---|---|
| 1.1 | Remover a rota duplicada `estoque.transferencia` que renderiza placeholder (a 1ª declaração vence) e apagar `estoque.transferencia.tsx`; menu "Transferências" passa a abrir `RemessasPage` | `App.tsx`, `app-sidebar.tsx` |
| 1.2 | `feature-guard.tsx`: navegar para `/` em vez de `/dashboard` (rota inexistente) | `feature-guard.tsx` |
| 1.3 | Rotear `TransportadorasPage` em `/gestao/transportadoras` (conserta link quebrado do hub Gestão) + item de menu | `App.tsx`, `app-sidebar.tsx` |
| 1.4 | Rotear `AgendaTelefonicaPage` em `/gestao/agenda-telefonica` + item de menu | `App.tsx`, `app-sidebar.tsx` |
| 1.5 | Excluir páginas duplicadas mortas: `lotes.tsx`, `products.tsx`, `estoque.tsx`, `produtos-estoque.tsx` | `src/pages/` |
| 1.6 | Página 404 real no `path="*"` (em vez de redirect silencioso) | `not-found.tsx`, `App.tsx` |
| 1.7 | Rotas legado `/fiscal` → redirect `/notas-fiscais`; `/configuracoes` → redirect `/config/sistema` | `fiscal.tsx`, `configuracoes.tsx` |
| 1.8 | Menu: separar "Contas a Pagar/Receber" (`/financeiro?aba=contas`) de "Relatórios Financeiros" | `app-sidebar.tsx` |

## Fase 2 · Banco xlifevps (migration `036_seguranca_performance.sql`)

| # | Ação |
|:-:|---|
| 2.1 | **Segurança:** dropar as 12 políticas `USING (true)` de `erp_nfe_entrada(_itens)` e `erp_remessas`/`erp_remessa_itens` |
| 2.2 | **Segurança:** `REVOKE ALL ... FROM anon` no schema `erp` + default privileges |
| 2.3 | **Performance:** reescrever TODAS as políticas envolvendo `is_erp_admin()` / `current_erp_user_id()` / `auth.uid()` com `(SELECT ...)` (initplan — 1 chamada por query em vez de 1 por linha), via `DO $$` que varre `pg_policies` |
| 2.4 | **Performance:** substituir `erp_admin_write FOR ALL` por 3 políticas só de escrita (INSERT/UPDATE/DELETE), eliminando dupla avaliação em SELECT |
| 2.5 | **Performance:** ~45 índices de FK nas tabelas transacionais (vendas, itens, caixa, contas, compras, lotes, pedidos, cheques, remessas, NFe) |
| 2.6 | Triggers de `updated_at` onde a coluna existe sem trigger |
| 2.7 | `ANALYZE` no schema todo (64 tabelas sem estatística) |
| 2.8 | `ALTER ROLE authenticated SET statement_timeout='30s'` e `idle_in_transaction_session_timeout='60s'` |
| 2.9 | Tuning do servidor: `shared_buffers=1GB`, `effective_cache_size=2GB`, `work_mem=16MB`, `maintenance_work_mem=256MB`, `random_page_cost=1.1`, `jit=off` + restart do container do banco (~5 s de indisponibilidade, atinge também o CRM) |

## Fase 3 · CRUD nas telas vitrine

Hooks novos em `supabase-queries.ts`: `useCreateKit/useUpdateKit/useDeleteKit`,
`useCreateLoja/useUpdateLoja`, `useCreateCompra`, `useCreatePedido`, `useCreateServico/useUpdateServico/useDeleteServico`.
Correções de bug: `useKits`/`useServicos` filtram por `loja_id` que **não existe** nessas tabelas (query quebra);
`compras.tsx` lê `valor_total`/`fornecedor_nome` que não existem (colunas reais: `total`, join em `fornecedor_id`).

| Tela | Entrega |
|---|---|
| Clientes (`customers.tsx`) | dialog criar/editar + inativar (`erp_pessoas`) |
| Fornecedores (`fornecedores.tsx`) | dialog criar/editar + inativar |
| Kits (`kits.tsx`) | criar/editar kit com itens (`erp_kits` + `erp_kit_itens` — tabela hoje morta), excluir |
| Lojas (`lojas.tsx`) | criar/editar loja, ativar/inativar |
| Compras (`compras.tsx`) | nova compra manual com itens (`erp_compras` + `erp_compra_itens`), status, join fornecedor |
| Pedidos (`orders.tsx`) | novo pedido (cliente, endereço, taxa) + mudança de status |
| Devoluções (`devolucoes.tsx`) | registrar devolução de venda (muda status da venda + estorna estoque) |
| Financeiro (`financeiro.tsx`) | botão "Nova Conta" → dialog com `useCreateConta`; "Imprimir" → impressão |
| Documentos (`documentos.tsx`) | botão download baixa do bucket via `storage_path` |
| Email Inteligente | "Configurar" → dialog que persiste automação em `erp_configuracoes_sistema` |

## Fase 4 · Substituir os placeholders

Migration `037_controle_comercial.sql`: `erp_orcamentos` + `erp_orcamento_itens`,
`erp_ordens_servico`, `erp_consignacoes` + `erp_consignacao_itens`, `erp_locacoes`
(RLS padrão initplan, grants `authenticated`, FKs indexadas, `updated_at`).

| Rota | Entrega |
|---|---|
| `/gestao/servicos` | página CRUD real sobre `erp_servicos` (substitui `P()` inline) |
| `/controle-comercial/pedido` | pré-venda: criar com itens, converter em venda |
| `/controle-comercial/orcamento` | orçamento com validade, itens, status (aberto/aprovado/recusado) |
| `/controle-comercial/os` | ordem de serviço: abertura, serviços/peças, status |
| `/controle-comercial/consignacao` | saída consignada + acerto |
| `/controle-comercial/locacao` | contrato de locação com período e devolução |
| `/ajuda` | central de ajuda real (FAQ por módulo) |
| `/treinamento/tutoriais` | página de tutoriais (conteúdo por módulo) |
| `/ifood` + `/marketplace-ifood` | página de configuração da integração (credenciais persistidas, status desconectado) |
| `/exapp-pedidos` | configuração de pedidos via WhatsApp (instância UAZAPI persistida) |
| `/tef-sitef` | configuração TEF (endereço do servidor SITEF, loja, terminal) |

## Fase 5 · Botões órfãos restantes (`gesta-final.tsx`)

| Botão | Entrega |
|---|---|
| Imprimir Etiqueta (código de barras) | janela de impressão com a etiqueta renderizada |
| Gerar DRE / Balancete | demonstrativo calculado de `erp_contas`/`erp_vendas` + impressão |
| Importar OFX | upload + parse do OFX + conciliação com contas em aberto |

## Fase 6 · Verificação

- `npm run build` sem erro.
- Re-varredura automática: nenhum `<Button>` sem handler, nenhum link para rota inexistente,
  nenhuma rota de menu caindo em `PlaceholderPage`.
- Queries de verificação do banco (apêndice do plano anterior) retornando vazio.

---

*Gerado em 11/08/2026 · implementação na sequência deste commit.*
