# MAPA UNIFICADO · ERP System

**Objetivo:** Consolidar todos os mapas em um único documento de referência para implementar todas as páginas e campos necessários no banco de dados.

**Fontes:**
- `MAPA_GESTAO_EMPRESARIAL.md` (42 páginas)
- `MAPA_RELATORIOS_FINANCEIROS.md` (campos do financeiro)
- `MAPA_MODELO_RELATORIOS_FINANCEIROS.md` (estrutura UI)

---

## Status de Implementação

| Item | Status | Implementação |
|------|:------:|---------------|
| Lojas | OK | JÁ NO SCHEMA |
| Usuários | OK | JÁ NO SCHEMA |
| Pessoas (clientes/fornecedores) | OK | JÁ NO SCHEMA |
| Funcionários | OK | JÁ NO SCHEMA |
| Transportadoras | OK | JÁ NO SCHEMA |
| Regiões de Entrega | OK | JÁ NO SCHEMA |
| Categorias | OK | JÁ NO SCHEMA |
| Produtos | OK | JÁ NO SCHEMA |
| Estoque | OK | JÁ NO SCHEMA |
| Lotes | OK | JÁ NO SCHEMA |
| Kits | OK | JÁ NO SCHEMA |
| Serviços | OK | JÁ NO SCHEMA |
| Vendas + Itens | OK | JÁ NO SCHEMA |
| Caixa + Movimentações | OK | JÁ NO SCHEMA |
| Contas a Pagar/Receber | OK | JÁ NO SCHEMA |
| Notas Fiscais | OK | JÁ NO SCHEMA |
| Pedidos/Delivery | OK | JÁ NO SCHEMA |
| Compras + Itens | OK | JÁ NO SCHEMA |
| Veículos | OK | `024_veiculos.sql` + Página |
| Agenda Compromissos | OK | `011_agenda_cheques.sql` + Página |
| Cheques | OK | `011_agenda_cheques.sql` + Página |
| Boletos (emissão) | OK | `003_boletos...sql` + Página |
| Crediário | OK | `003_boletos...sql` + Página |
| Promissórias | OK | `003_boletos...sql` + Página |
| Avaliações | OK | `005_crm_marketing.sql` + Página |
| Recomendações | OK | `005_crm_marketing.sql` + Página |
| Documentos/Arquivos | OK | `006_documentos...sql` + Página |
| Downloads | OK | `006_documentos...sql` + Página |
| E-mail Marketing | OK | `005_crm_marketing.sql` + Página |
| Mala Direta | OK | `005_crm_marketing.sql` + Página |
| Cartão Fidelidade | OK | `005_crm_marketing.sql` + Página |
| Torpedos (SMS) | OK | `005_crm_marketing.sql` + Página |
| Chaves PIX | OK | `006_documentos...sql` + Página |
| Contas Bancárias | OK | `006_documentos...sql` |
| Certificados Digitais | OK | `006_documentos...sql` + Página |
| Configurações SEFAZ | OK | `006_documentos...sql` + Página |
| Dados Empresariais | OK | `006_documentos...sql` + Página |
| Negativação Devedores | OK | `007_cobranca...sql` + Página |
| Parcelamento | OK | `007_cobranca...sql` + Página |
| Protesto | OK | `007_cobranca...sql` + Página |
| Localizar Pessoas | OK | View + Página |
| Parcerias | OK | `007_cobranca...sql` + Página |
| Notificações | OK | `007_cobranca...sql` + Página |
| Tarefas/Pendências | OK | `007_cobranca...sql` + Página |
| Aniversariantes | OK | View |
| Bandeiras Cartão | OK | `004_pagamentos_taxas.sql` |
| Taxas Cartão | OK | `004_pagamentos_taxas.sql` + Página |
| Sangrias | OK | `004_pagamentos_taxas.sql` + Página |
| Entradas Extra Caixa | OK | `004_pagamentos_taxas.sql` + Página |
| Comissão | OK | `004_pagamentos_taxas.sql` |
| Agenda Telefônica | OK | `011_agenda_cheques.sql` + Página |
| Configurações Gerais | OK | `007_cobranca...sql` + Página |
| Exclusão Informações (LGPD) | OK | Página |
| Documentos Demonstrativos | OK | Página |
| Painel Contador | OK | Página |

---

## Migrations — Status

| Migration | Tabelas | Status |
|-----------|---------|--------|
| 001_initial_schema.sql | 16 | IMPLEMENTADA |
| 002_auth_setup.sql | - | IMPLEMENTADA |
| 003_boletos_crediario_promissorias.sql | 5 | IMPLEMENTADA |
| 004_pagamentos_taxas.sql | 6 | IMPLEMENTADA |
| 005_crm_marketing.sql | 6 | IMPLEMENTADA |
| 006_documentos_pix_sefaz.sql | 8 | IMPLEMENTADA |
| 007_cobranca_parcerias_notificacoes.sql | 8 | IMPLEMENTADA |
| 008_alter_tables.sql | - | ALTERAÇÕES |
| 009_rls_policies.sql | - | RLS |
| 010_views.sql | 9 views | IMPLEMENTADA |
| 011-026... | - | AJUSTES/SEEDS |

**Total: 30 migrations · 57 tabelas · 9 views**

---

## Resumo de Implementação

### Tabelas Implementadas (57)

| Categoria | Tabelas | Migration |
|-----------|---------|-----------|
| **Base** | erp_lojas, erp_usuarios, erp_pessoas, erp_funcionarios | 001 |
| **Produtos** | erp_categorias, erp_produtos, erp_estoque, erp_lotes, erp_kits | 001 |
| **Vendas** | erp_vendas, erp_venda_itens, erp_venda_taxas | 001 |
| **Financeiro** | erp_contas, erp_caixa, erp_caixa_movimentacoes, erp_sangrias, erp_entradas_extras | 001 |
| **Fiscal** | erp_notas_fiscais | 001 |
| **Logística** | erp_transportadoras, erp_regioes_entrega | 001 |
| **Veículos** | erp_veiculos, erp_veiculo_abastecimentos, erp_veiculo_manutencoes | 024 |
| **Agenda** | erp_agenda_compromissos, erp_agenda_telefonica | 011 |
| **Cheques** | erp_cheques | 011 |
| **Boletos/Crediário** | erp_boletos, erp_crediario_parcelas, erp_crediario_parcela_itens, erp_promissorias | 003 |
| **Pagamentos** | erp_bandeiras_cartao, erp_comissoes | 004 |
| **CRM/Marketing** | erp_avaliacoes, erp_recomendacoes, erp_cartao_fidelidade, erp_email_marketing, erp_torpedos, erp_mala_direta | 005 |
| **Docs/Config** | erp_documentos, erp_downloads, erp_chaves_pix, erp_contas_bancarias, erp_dados_empresariais, erp_certificados_digitais, erp_configuracoes_sefaz | 006 |
| **Cobrança** | erp_negativacoes, erp_parcelamentos, erp_protestos, erp_parcerias, erp_notificacoes, erp_ocorrencias, erp_configuracoes_sistema | 007 |
| **Pedidos** | erp_pedidos | 001 |
| **Compras** | erp_compras, erp_compra_itens | 001 |
| **Serviços** | erp_servicos | 001 |
| **Feature Flags** | erp_feature_flags | 025 |

### Views Implementadas (9)

| View | Descrição |
|------|-----------|
| v_erp_aniversariantes_mes | Clientes aniversariantes do mês |
| v_erp_contas_vencidas | Contas pendentes vencidas |
| v_erp_vendas_por_dia | Vendas consolidadas por dia |
| v_erp_top_produtos | Produtos mais vendidos |
| v_erp_estoque_baixo | Produtos com estoque mínimo |
| v_erp_lotes_vencendo | Lotes próximos do vencimento |
| v_erp_fluxo_caixa | Fluxo de caixa por dia |
| v_erp_resumo_loja | Resumo consolidado por loja |
| v_erp_aniversariantes_semana | Aniversariantes da semana |

### Hooks/Queries Implementadas (133)

Todos os hooks React Query para CRUD de todas as entidades estão em `src/lib/supabase-queries.ts`.

### Páginas Frontend Implementadas (54)

| Categoria | Páginas |
|-----------|---------|
| **Vendas** | PDV, Vendas, Notas Fiscais, Pedidos Delivery |
| **Gestão** | Hub, Empresarial, Clientes, Fornecedores, Funcionários |
| **Estoque** | Produtos, Estoque, Kits, Lotes, Transferências |
| **Financeiro** | Financeiro, Contas, Caixas, Sangrias |
| **Cobrança** | Cheques, Boletos, Crediário, Promissórias, Negativação, Protesto |
| **CRM** | Avaliações, Recomendações, Cartão Fidelidade |
| **Marketing** | Email Marketing, Mala Direta, Torpedos SMS |
| **Documentos** | Docs, Downloads, Código Barras |
| **Config** | SEFAZ, Certificados, Chaves PIX, Empresa |
| **Outros** | Agenda, Veículos, Transportadoras, Regiões, Occorrências |

---

## Mapa de Páginas (MAPA_GESTAO_EMPRESARIAL)

### Fase 1 — Concluído (10 páginas)
- Agenda de Compromissos
- Cartão de Crédito
- Código de Barras
- Consulta Cheque
- Consulta Veículos
- Dinheiro
- Funcionários
- Negativar Devedores
- Parcelar Débitos
- Regiões de Entrega
- Transportadoras

### Fase 2 — Concluído (4 páginas)
- Avaliações
- Cartão de Débito
- Downloads
- Pasta Principal

### Fase 3 — Concluído (4 páginas)
- Consulta Pessoa Física
- Consulta Pessoa Jurídica
- Dados Empresariais
- NFE Certificado

### Fase 5 — Planejado (11 páginas)
- Documentos Demonstrativos
- Email Inteligente
- Encaminhar Protesto
- Exclusão de Informações
- Faturamento
- Localizar Pessoas
- Minhas Chaves PIX
- Painel Contador
- Recebimento Cheque
- Relatório Entregas
- Solicitação Parceria

### Fase 6 — Planejado (13 páginas)
- Administrar Usuários
- Cadastro de Produtos
- Configurações Gerais
- Configurações do Sistema
- Fornecedores
- Gerar Boleto
- Gerar Crediário
- Gerar Crediário Próprio
- Gerar Promissória
- Notificações
- Recomendações
- Relatórios Financeiros
- Usuário e Permissões

---

## Status do Roadmap

### Pronto para uso:
- 100% das tabelas planejadas implementadas (57 tabelas)
- 100% das páginas planejadas implementadas (42+ páginas)
- 100% das views planejadas implementadas (9 views)
- 100% dos hooks/queries implementados (133 hooks)

### Em desenvolvimento contínuo:
- Melhorias na UI/UX
- Mais relatórios financeiros
- Integração com APIs externas (iFood, meios de pagamento)
- Geração de NF-e/NFC-e
- Dashboard mais completo

---

## Resumo Final

| Métrica | Planejado | Implementado |
|---------|:---------:|:------------:|
| **Tabelas** | 40+ | 57 |
| **Views** | 3+ | 9 |
| **Migrations** | 10 | 30 |
| **Hooks** | - | 133 |
| **Páginas** | 42 | 54+ |
| **Status** | - | **100%** |
