# Plano de implementação — ERP X-Life

Levantado em 22/09/2026, cruzando os tutoriais do Excellent Sistemas
(`Downloads/CABEÇÃO`, convertidos para `.md`) com o código e o banco atuais.

O que **já existe** e não aparece aqui: cadastro de fornecedores completo, lista
de compras (inclusive por estoque zerado e a partir de pré-venda), NFC-e e NF-e
de venda, cancelamento de nota, carta de correção, inutilização, manifestação
DF-e, importação de XML com auto-matching, e notificações.

---

## Estado em 23/09/2026

Quatro das sete frentes fechadas, e tudo em produção desde 23/09. O grosso do
trabalho, porém, veio de fora do plano: defeito encontrado em uso e pedido que
surgiu no meio do caminho.

### Frentes do plano

| # | frente | situação |
|---|---|---|
| 1 | Pagamento múltiplo no PDV | **feita** |
| 2 | Devolução para fornecedor | **feita** |
| 3 | NF avulsa (saída e entrada) | **parada** — depende do CSC de produção |
| 4 | Ajustes finos do PDV | **feita** |
| 5 | Funcionários e comissão | **feita** |
| 6 | Impostos na entrada por XML | não começou — depende do contador |
| 7 | Miudezas | não começou |

**Frente 1** — `erp_venda_pagamentos` guarda quantas formas a venda tiver, e a
RPC recusa soma menor que o total. A conta da gaveta passou a separar por
forma, então venda mista deixou de inventar dinheiro que não entrou.

**Frente 2** — devolução ao fornecedor com CFOP 5202 na mesma UF e 6202 fora,
impostos rateados proporcionalmente da nota de entrada. Não testada contra a
SEFAZ de produção, porque o CSC não está cadastrado.

**Frente 4** — desconto por item (F2), alterar item (F7), consultar preço (F9),
aplicar entrada/adiantamento (Ctrl+A), fechamento indireto, e as duas
configurações de fechamento: exigir valores por forma e ocultar valores exceto
para o master.

**Frente 5** — ficha de admissão (filiação, naturalidade, estado civil,
instrução, filhos), dados bancários e comissão sobre serviço numa seção
confidencial; metas por funcionário com acompanhamento na tela de Comissões; e
comissão apurada virando conta a pagar, com trava contra lançar duas vezes.

### Entregue fora do plano

| entregue | origem |
|---|---|
| Comprovante térmico de fechamento, no formato do Excellent | pedido |
| Detalhes do turno de caixa | não abriam de lugar nenhum |
| Relatórios financeiros: 7 pop-ups viram telas com filtro | pedido |
| Menu do financeiro: 4 itens viram 1 | pedido |
| PDV em tela própria, teclado e atalhos | pedido |
| Caixas como cadastro por loja, senha na abertura | pedido |
| Ciclo de pedidos: criar pelo balcão, itens e endereços | pedido |
| Dashboard e Visão Geral unificados | pedido |
| Vários caixas abertos no admin, com alternância | pedido |
| Lista de caixas que cada conta pode abrir | pedido |
| 12 telas abriam por apelido de rota sem permissão | **segurança** |
| Qualquer usuário podia se promover a admin | **segurança** |
| CSC de produção vazaria no dia da virada | **segurança** |
| Fechamento gravava "vendas R$ 0,00" e inventava diferença | **defeito grave** |
| Sangria por forma; gaveta contava cartão como dinheiro | **defeito grave** |
| PDV gravava venda na loja errada com caixa aberto em outra | **defeito grave** |
| Cupom sumia sem aviso ao lançar produto | **defeito grave** |

Os sete últimos não estavam previstos aqui e eram mais urgentes que qualquer
frente da lista.

### Mudanças de comportamento

O que passou a funcionar de outro jeito, para quem opera não ser pego de
surpresa.

| antes | agora |
|---|---|
| Seletor de loja no topo da frente de caixa, sempre ativo | Só com o caixa fechado. Aberto, a loja vem do caixa, com cadeado |
| Um caixa aberto por usuário | Admin mantém vários e alterna pelo crachá verde |
| Abrir caixa fechava o anterior em silêncio | Só para quem não pode ter vários. Ver pendência abaixo |
| Qualquer conta abria qualquer caixa | Lista por conta em Usuários e Permissões; vazia = todos |
| Dois operadores podiam abrir o mesmo caixa físico | Recusado pelo banco |
| Botão Cancelar do cupom limpava direto | Pergunta, como o F11 já perguntava |
| Quantidade sem limite, contada em unidades inteiras | Teto de 1000 por lançamento; fração preservada |
| Fechamento mostrava o esperado a todos | Configurável: pode ocultar de quem não é master |
| Fechamento pedia só o total da gaveta | Configurável: pode exigir valor por forma |

### Migrations aplicadas em produção

Da 078 à 092. Todas aditivas, nenhuma destrutiva. As que mudam regra de
dinheiro foram verificadas em transação revertida, com dados fictícios:
pagamento múltiplo (085, 086), devolução ao fornecedor (087), fechamento
indireto (089), entrada de pedido (091) e caixas por usuário (092).

### Registrado, não corrigido

**1. Operador de caixa não consegue usar o ciclo de pedidos.** As policies de
`erp_pedidos` exigem `is_erp_admin()` (admin ou gerente) para INSERT e UPDATE.
Verificado em produção com o usuário de papel `caixa`: o INSERT é recusado pelo
RLS e o UPDATE alcança 0 linhas — arrastar um cartão no quadro falha em
silêncio. Quem recebe o pedido no balcão é exatamente quem não pode criá-lo.

A correção é uma policy nova para usuário do ERP na própria loja, no molde da
que `erp_pedido_itens` já usa. Muda quem pode escrever em pedido, então espera
aprovação.

Receber a entrada do pedido (Ctrl+A) funciona para o caixa mesmo assim: passa
por função `SECURITY DEFINER`, que valida quem pode dentro dela.

**2. Fechamento automático mata o turno esquecido sem conferência.** Ao abrir
um caixa, o gatilho fecha o anterior do mesmo usuário gravando "Fechado
automaticamente ao abrir novo caixa" — sem ninguém contar a gaveta. O turno de
ontem morre sem conferência e a diferença some.

O certo é recusar a abertura e mandar fechar o anterior, que já existe desde o
fechamento indireto (089). Muda a rotina da manhã do balcão, então espera
aprovação.

**3. O sinal do pedido não é abatido sozinho na venda final.** O operador
precisa lançar a linha "Entrada/adiantamento já pago" no F10. O sistema não
liga a venda ao pedido porque o carrinho do PDV ainda não tem esse vínculo.

**4. O cupom não sobrevive a um recarregamento da aba.** O carrinho vive só na
memória da tela. Guardá-lo no navegador é possível e pequeno, mas é decisão à
parte.

### O que falta para fechar os ajustes

Em ordem de quem está esperando o quê.

| falta | depende de |
|---|---|
| Decidir as 2 pendências acima que mexem em rotina | você |
| CSC de produção cadastrado | você / contador |
| Frente 3: NF avulsa de saída e de entrada | CSC |
| Frente 6: impostos do XML no custo | contador |
| Frente 7: duplicar venda, declaração MEI, prazo de notificação, mais de um código de barras por produto | nada |

### Deploy

Feito em 23/09, commit `f1bd405`, container `apps_erp.1.45mo7o0e16srebmo0doxeiiz6`
saudável. Migrations 078 a 093 aplicadas.

Um aviso para a próxima vez: disparar o webhook duas vezes seguidas **derruba o
EasyPanel**. O segundo pedido aborta o build em andamento e o tratamento do
aborto mata o processo (saída 1). Ele volta sozinho em poucos minutos, mas
nenhum dos dois deploys acontece. Um disparo, depois espera.

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

> **Feita.** `erp_venda_pagamentos` e RPC que recusa soma menor que o total.


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

> **Feita.** CFOP 5202/6202 e impostos rateados da nota de entrada. Não
> testada contra a SEFAZ de produção: o CSC não está cadastrado.


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

> **Parada.** Depende do CSC de produção.


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

> **Feita.** Todos os itens abaixo estão no ar. Ficaram de fora, registrados
> no estado acima: o abatimento automático do sinal na venda final e as duas
> pendências que mexem em rotina do balcão.


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

> **Feita.** Migrations 093. A meta e o lançamento em contas vivem na tela de
> Comissões, que é onde o assunto já estava.

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
