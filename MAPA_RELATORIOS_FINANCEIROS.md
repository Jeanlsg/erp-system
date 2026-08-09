# 📊 Mapeamento de Campos · Relatórios Financeiros

**Origem:** `relatorios financeiros.html` (excellentsistemas.com.br)
**Sistema:** Ex Sistemas · X-LIFE Suplementos Alimentares (Empresa 66826)
**Funcionalidade:** Relatórios Financeiros · Fluxo de Caixa

---

## 🎯 Filtros Principais (Topo)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| Período | Data Inicial | Data de início da consulta (dd/mm/aaaa) |
| Período | Data Final | Data final da consulta (dd/mm/aaaa) |
| Ação | Botão "Consultar" | Aplica o filtro de período |

---

## 📑 Abas (Tabs) Principais

| # | Aba | Conteúdo |
|---|-----|----------|
| 1 | **Fluxo de Caixa** | Visão consolidada com KPIs, vendas, formas de pagamento, contas |
| 2 | **Vendas Realizadas** | Lista de vendas com detalhes |
| 3 | **Gráficos** | Visualização gráfica de vendas (novo) |
| 4 | **Formas de Recebimento** | Breakdown por forma de pagamento |
| 5 | **Taxas de Cartões** | Taxas cobradas por bandeira |
| 6 | **Contas Pagas** | Contas a pagar já liquidadas |
| 7 | **Contas à Pagar** | Contas a pagar pendentes |
| 8 | **Contas Recebidas** | Contas a receber já liquidadas |
| 9 | **Contas à Receber** | Contas a receber pendentes |
| 10 | **Notas Fiscais** | Resumo de NF-e, NFC-e, CF-e |

---

## 💰 KPIs · Fluxo de Caixa (Cards Principais)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| Vendas | Número (count) | Quantidade de vendas encontradas no período |
| Vendas Finalizadas | Moeda (R$) | Vendas pagas e a receber (todas formas de pagamento, incluindo parceladas) |
| Vendas Não Finalizadas | Moeda (R$) | Pré-venda, Orçamento, Ordem de Serviço, Locação |
| Vendas Canceladas | Moeda (R$) | Total de vendas canceladas no período |
| Itens | Número (count) | Quantidade total de itens vendidos |
| Descontos | Moeda (R$) | Total de descontos concedidos |
| Custo total | Moeda (R$) | Custo total na data da venda |
| Lucros | Moeda + % | Lucro sobre vendas (valor + percentual) |

---

## 📋 Tabelas Detalhadas

### Formas de Recebimento

| Coluna | Descrição |
|--------|-----------|
| Tipo de Recebimento | Dinheiro, PIX, Cartão Crédito, Cartão Débito, etc. |
| Valores Recebidos | Total recebido por forma de pagamento |

### Taxas de Cartões

| Coluna | Descrição |
|--------|-----------|
| Tipo de Recebimento | Bandeira/tipo do cartão |
| Valores a Pagar | Taxa a pagar sobre cada recebimento |

### Entradas Extra Caixa

| Coluna | Descrição |
|--------|-----------|
| Data/Hora | Data e hora da entrada |
| Motivo | Motivo da entrada extra |
| Forma De Recebimento | Forma de pagamento utilizada |
| Valor | Valor da entrada |

### Sangria

| Coluna | Descrição |
|--------|-----------|
| Data/Hora | Data e hora da sangria |
| Motivo | Motivo da sangria |
| Valor | Valor retirado do caixa |

### Contas Pagas

| Coluna | Descrição |
|--------|-----------|
| Sub Total | Soma total das contas pagas no período |

### Contas à Pagar

| Coluna | Descrição |
|--------|-----------|
| Sub Total | Soma total das contas a pagar (pendentes) |

### Contas Recebidas

| Coluna | Descrição |
|--------|-----------|
| Sub Total | Soma total das contas recebidas no período |

### Contas à Receber

| Coluna | Descrição |
|--------|-----------|
| Sub Total | Soma total das contas a receber (pendentes) |

---

## 📄 Notas Fiscais

| Campo | Descrição |
|-------|-----------|
| Notas no Período | Quantidade total de notas emitidas no período |
| Nota Ok | Notas autorizadas com sucesso |
| Nota Cancelada | Notas canceladas |
| Nota Denegada | Notas denegadas pela SEFAZ |
| NFc | Quantidade de NFC-e (Nota Fiscal de Consumidor) |
| NFe | Quantidade de NF-e (Nota Fiscal Eletrônica) |
| CFe | Quantidade de CF-e (Cupom Fiscal Eletrônico) |

---

## 🛒 Top 10 Produtos Mais Vendidos

| Coluna | Descrição |
|--------|-----------|
| Posição | Ranking de 1 a 10 |
| Imagem | Foto do produto (limitada a 40px) |
| Código | SKU/código do produto |
| Descrição | Nome do produto |
| Quantidade | Total vendido |
| Valor Unitário | Preço unitário |
| Total | Valor total vendido |
| Custo | Custo total |

---

## 🔧 Botões de Ação (Topo)

| Botão | Função |
|-------|--------|
| Incluir contas a pagar/receber | Abre modal de cadastro de conta |
| Sangrias de caixa | Lista sangrias realizadas |
| Entradas extra caixa | Lista entradas extras |
| Extrato de serviços utilizados | Modal com extrato de uso do sistema |
| Relatório de fechamento de caixa | Lista fechamentos de caixa |
| Conta bancária | Modal de contas bancárias |
| Relatório de ações de NF | Logs de ações em notas fiscais |
| Relatório de vendas excluídas | Vendas removidas do sistema |
| Relatório de contas excluídas | Contas removidas do sistema |
| Relatório gerencial | Relatório consolidado |
| Relatório de Entregas Delivery | Entregas de pedidos delivery |
| Relatório de entradas canceladas | Entradas de caixa canceladas |

---

## 🎯 Header · Indicadores Rápidos

| Indicador | Descrição |
|-----------|-----------|
| Ocorrências (envelope) | Avisos e ocorrências do sistema |
| Boletos em Aberto | Faturas digitais com alerta (amarelo: -10 dias, vermelho: +10 dias) |
| Aniversariantes do Mês | Clientes aniversariantes |
| Opinião | Pesquisa de satisfação |

---

## 📊 Alinhamento dos Dados Financeiros

Para garantir consistência entre todos os relatórios, os seguintes campos devem estar **alinhados** em todos os módulos:

### Campos Monetários (R$)
- ✅ Vendas Finalizadas
- ✅ Vendas Não Finalizadas
- ✅ Vendas Canceladas
- ✅ Descontos
- ✅ Custo total
- ✅ Lucros (valor + %)
- ✅ Sub Totais (Contas Pagas, À Pagar, Recebidas, À Receber)
- ✅ Valores Recebidos (Formas)
- ✅ Valores a Pagar (Taxas)
- ✅ Entradas Extra Caixa
- ✅ Sangrias
- ✅ Top Produtos (unitário + total)

### Campos Numéricos (count)
- ✅ Vendas (quantidade)
- ✅ Itens vendidos
- ✅ Top 10 posição
- ✅ Quantidade (produtos)
- ✅ Notas no Período
- ✅ Nota Ok
- ✅ Nota Cancelada
- ✅ Nota Denegada
- ✅ NFc / NFe / CFe

### Campos de Data
- ✅ Data Inicial / Final (filtro)
- ✅ Data/Hora (Entradas Extra Caixa, Sangria)
- ✅ Dt. Nas. (Aniversariantes)
- ✅ Vencimento (Contas a Pagar)

### Padrão de Formatação
- **Moeda:** `R$ 0.000,00` (pt-BR)
- **Data:** `dd/mm/aaaa`
- **Data/Hora:** `dd/mm/aaaa HH:mm`
- **Percentual:** `0,0%`

---

## 🔄 Filtros Globais Recomendados

Para alinhar todos os relatórios, considerar implementar:

| Filtro | Aplicação |
|--------|-----------|
| Período (Data Inicial/Final) | Todos os relatórios |
| Loja/Filial | Multi-loja |
| Tipo de Conta (Pagar/Receber) | Financeiro |
| Forma de Pagamento | Vendas |
| Bandeira | Cartões |
| Status (Pago/Pendente/Cancelado) | Todos |
| Categoria de Produto | Top Produtos |

---

## 📌 Resumo de Status

- **Página atual:** `financeiro_view.php`
- **Status:** Ativa com 10 abas e 12+ botões de ação
- **Última referência:** 09/08/2026 (período selecionado)
- **Empresa ativa:** X-LIFE Suplementos (66826)
- **Usuário:** 89063 · FUNCIONARIO MASTER