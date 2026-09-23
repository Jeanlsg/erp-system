# Plano de implementação — ERP X-Life

Levantado em 22/09/2026, cruzando os tutoriais do Excellent Sistemas
(`Downloads/CABEÇÃO`, convertidos para `.md`) com o código e o banco atuais.

O que **já existe** e não aparece aqui: cadastro de fornecedores completo, lista
de compras (inclusive por estoque zerado e a partir de pré-venda), NFC-e e NF-e
de venda, cancelamento de nota, carta de correção, inutilização, manifestação
DF-e, importação de XML com auto-matching, e notificações.

---

## Ordem recomendada

A ordem abaixo segue **risco fiscal primeiro, atrito diário depois**. Cada
etapa é entregável sozinha — dá para parar em qualquer ponto sem deixar o
sistema pela metade.

| # | Frente | Por que nesta posição |
|---|---|---|
| 1 | Pagamento múltiplo no PDV | Mais citado, e hoje a venda mista é registrada errado |
| 2 | Devolução para fornecedor | Obrigação fiscal; mercadoria devolvida hoje não gera nota |
| 3 | NF avulsa (saída e entrada) | Venda fora do PDV não tem como virar nota |
| 4 | Ajustes finos do PDV | Atrito diário do balcão |
| 5 | Funcionários e comissão | Fecha o ciclo de folha |
| 6 | Impostos na entrada por XML | Custo correto; depende de decisão tributária |
| 7 | Miudezas | Baixo esforço, alto conforto |

---

## 1. Pagamento múltiplo no PDV (F10)

**Hoje:** a venda tem uma `forma_pagamento` só. Cliente que paga metade no
cartão e metade em dinheiro é registrado como se fosse tudo de uma forma — e o
fechamento de caixa herda esse erro.

**Fazer**
- Migration: `erp_venda_pagamentos` (venda_id, forma, valor, bandeira, parcelas,
  autorizacao). A coluna antiga continua, preenchida com a forma de maior valor,
  para não reescrever o histórico nem quebrar relatório existente.
- PDV: painel "Pagamentos informados" (F10) — adiciona linha por forma, mostra
  **quanto falta**, e **bloqueia finalizar enquanto a soma < total**.
- Troco só sobre a parcela em dinheiro.
- Fechamento de caixa e relatórios passam a somar da tabela nova.

**Cuidado:** `vw_caixa_resumo` calcula a gaveta por `erp_vendas.forma_pagamento`.
Ao migrar, essa conta tem de passar a olhar os pagamentos, senão a gaveta volta
a mentir (foi o defeito corrigido na migration 079).

---

## 2. Devolução para fornecedor

**Hoje:** `erp_devolucoes` é devolução **de cliente** (venda). Não existe
devolução ao fornecedor, nem a nota que a acompanha.

**Fazer**
- Migration: `erp_devolucoes_fornecedor` + itens, ligadas à nota de compra de
  origem (`erp_nfe_entrada` ou `erp_compras`).
- Tela: escolher fornecedor → buscar a nota de entrada dele → trazer os itens →
  escolher quais e quanto devolver (total ou parcial).
- Campos fiscais: natureza da operação, finalidade "devolução", CFOP 5202/6202,
  ICMS/ICMS-ST por item, volumes, frete, transportadora, placa, DANFE referenciado.
- Estoque sai pelo Kardex com origem `devolucao_fornecedor`.
- Emissão da NF-e pela edge function que já emite (`erp-emitir-nfe`), com o
  cabeçalho de devolução.

**Decisão sua:** a alíquota de ICMS por estado (o Excellent tem uma tela de
configuração). Sem isso, a devolução interestadual sai com o imposto errado.

---

## 3. NF avulsa — saída e entrada

**Hoje:** `useEmitirNFeVenda` exige `venda_id`. Só emite nota de venda que passou
pelo PDV.

**Fazer**
- Emissão desacoplada da venda: escolher destinatário, produtos, quantidade,
  valor, CFOP e dados fiscais por item.
- **Saída avulsa:** doação, remessa, brinde, venda por fora do PDV.
- **Entrada digitada:** nota de compra sem XML (fornecedor que manda só o papel),
  alimentando estoque e custo como a importação de XML faz.
- Compartilhar o formulário com a devolução ao fornecedor (item 2) — é o mesmo
  cabeçalho de nota com outra finalidade.

---

## 4. Ajustes finos do PDV

Todos pequenos, todos no balcão todo dia:

- **Desconto por item (F2)** — hoje só no total da venda.
- **Alterar item (F7)** — mudar quantidade/preço de uma linha já lançada.
- **Consultar preço (F9)** — consulta sem sair da venda.
- **Aplicar entrada / adiantamento (Ctrl+A)** — receber sinal de pedido aprovado.
- **Fechamento indireto** — fechar um caixa que ficou aberto de outro dia ou de
  outro operador. Hoje não há como, e o caixa esquecido trava o operador seguinte.
- **Config "informar valores por forma"** — tornar obrigatório declarar quanto
  entrou em cada forma no fechamento (hoje mostramos, não exigimos).
- **Config "ocultar valores exceto master"** — operador fecha às cegas, sem ver o
  esperado. É controle contra ajuste do valor informado.

---

## 5. Funcionários e comissão

**Hoje:** `erp_funcionarios` tem cargo, salário, CPF, RG, PIS, CTPS.

**Fazer**
- Migration: nome do pai/mãe, naturalidade, nacionalidade, estado civil,
  instrução, filhos; dados bancários; `comissao_percentual_servico`.
- Aba "Informações confidenciais" (banco + comissão), visível só a admin/gerente —
  a leitura de `erp_funcionarios` já exige esse papel desde a migration 078.
- **Meta por funcionário** (`erp_metas`: funcionário, período, valor, tipo) com
  acompanhamento no relatório de comissões.
- Botão **"Lançar em Contas a Pagar"** a partir da comissão apurada.

---

## 6. Impostos na entrada por XML

**Hoje:** a importação traz preço e margem e ignora IPI, PIS, COFINS, ICMS e
ICMS-ST. O custo do produto fica menor que o real quando há substituição
tributária — e o custo errado contamina margem, lucro e sugestão de compra.

**Fazer**
- Ler os tributos do XML por item e compor o custo.
- Tela de conferência mostrando o que veio e deixando corrigir.
- Classificação visual por linha (produto novo / já cadastrado / já processado).

**Depende de você:** confirmar com o contador como a X-Life trata ICMS-ST no
custo. Implementar antes dessa resposta é chutar número fiscal.

---

## 7. Miudezas

- **Duplicar venda** na tela de vendas realizadas.
- **Declaração de conteúdo (MEI)** na impressão.
- **Antecedência configurável** das notificações (dias/horas por tipo); hoje é
  fixa no código.
- **Vários códigos de barras por produto** (`erp_produto_codigos`) — o mesmo item
  com embalagens diferentes.
- **Editar itens de um pedido já criado** no Ciclo de pedidos.
- **Endereços do cliente fora do pedido** — aba no cadastro para ver e editar.

---

## Riscos e dependências

1. **Alíquota de ICMS por estado** (itens 2 e 6) é decisão fiscal, não técnica.
   Precisa do contador antes de codar.
2. **`vw_caixa_resumo`** é tocada pelo item 1. Toda mudança nela precisa ser
   ensaiada em transação desfeita — a conta da gaveta já esteve errada uma vez.
3. **CSC de produção** continua pendente: sem ele, nada de nota vale de verdade,
   e os itens 2 e 3 só podem ser testados em homologação.
