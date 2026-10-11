# Ajustes pedidos pela loja — 10/10/2026

Origem: grupo de WhatsApp "ERP | X life", mensagens e 6 vídeos enviados em 10/10/2026 entre 18:17 e
19:04, comparando o ERP com o sistema anterior (Excellent). As falas dos vídeos foram transcritas e os
quadros conferidos. Ao lado de cada item: o que existe hoje no ERP (com o arquivo) e o que falta.

## Resumo

| # | Ajuste | Tipo | Tamanho |
|---|---|---|---|
| 1 | Desconto e pagamentos de uma venda aparecem na venda seguinte | Defeito | P |
| 2 | "2 vendas recusadas pelo servidor" sem como ver o motivo, reenviar ou descartar | Defeito | P |
| 3 | Mais cor e destaque na frente de caixa; desconto na tela principal | Melhoria | M |
| 4 | Mais cor no sistema (menu lateral apagado, telas muito brancas) | Melhoria | M |
| 5 | Ficha/histórico do produto: alterar custo, preço e estoque e ver toda a movimentação, com período e impressão | Funcionalidade | M |
| 6 | Relatório mensal das notas para a contadora: imprimir e baixar os XML compactados | Funcionalidade | M |
| 7 | Fiscal organizado como no Excellent (Notas de venda, de entrada, de devolução…) | Melhoria | P |
| 8 | Cadastro de tributos completo (regime, origem, CST/CSOSN, base e alíquota do ICMS) | Funcionalidade | G |
| 9 | Nota de devolução a fornecedor completa, com CFOP escolhido, tributos por item e espelho antes de enviar | Funcionalidade | G |

P = até meio dia · M = um dia · G = mais de um dia

---

## 1. Desconto e pagamentos passam para a venda seguinte — DEFEITO

**Visto no vídeo:** um desconto de um teste anterior "permaneceu" e não dava para apagar; numa venda de
R$ 15 (coqueteleira) apareceram os pagamentos da venda anterior (creatina): "os pagamentos passaram do
total em R$ 64,00 — remova e lance de novo". A loja achou "muito confuso".

**Causa (código):** só a venda finalizada e o F11 zeram o estado da venda (`limparCarrinho`,
`src/pages/pdv.tsx`). Remover os itens até o cupom ficar vazio, ou trocar itens depois de lançar
pagamento, deixa desconto, acréscimo, pagamentos e entrega da venda anterior.

**Ajuste:** cupom vazio zera tudo da venda; mudar os itens depois de lançar pagamento descarta os
pagamentos (o total mudou) e avisa. Teste automático do comportamento.

## 2. Vendas recusadas pelo servidor — DEFEITO

**Visto no vídeo:** faixa "2 venda(s) recusada(s) pelo servidor — verifique em Vendas" no topo do PDV.

**Causa:** são vendas feitas sem internet que o servidor recusou ao subir (estoque, permissão, regra).
Elas ficam guardadas só naquele computador; a tela de Vendas não as mostra. O aviso manda para um lugar
onde elas não estão, e não há como ver o motivo, reenviar ou descartar (as funções existem em
`src/lib/offline/fila-vendas.ts`, sem tela).

**Ajuste:** painel no próprio PDV com cada venda recusada (data, itens, total, motivo da recusa) e os
botões "Tentar de novo" e "Descartar" (com confirmação).

## 3. Frente de caixa com cor e destaque; desconto na tela principal

**Pedido:** "tela tá muito branca, a pessoa se bate ali pra achar"; destacar Fechar caixa, Alterar,
Desconto, Acréscimo em vermelho e preto, como no Excellent; "aqui não tem o desconto na tela principal".

**Hoje:** botões do PDV misturam estilos (contorno, vermelho, verde fixo e botões sem cor na barra de
atalhos); desconto geral e acréscimo só existem dentro da tela de pagamento (F10); há uma segunda lista
"Carrinho" que repete o cupom (`pdv.tsx`).

**Ajuste:** barra de ações com botões grandes e coloridos (padrão vermelho/preto, com o atalho
escrito), totais em destaque, desconto geral e acréscimo editáveis na tela principal, remoção da lista
repetida.

## 4. Cor no sistema

**Pedido:** menu lateral "num preto meio apagado, doía a vista"; telas e tópicos (Financeiro, Relatórios,
fluxo, vendas) "muito brancos"; "deixar vermelho, padrão, nessa pegada do Excellent".

**Hoje:** a paleta já é vermelha (`src/index.css`), mas o menu usa um degradê vinho fixo no código
(`SIDEBAR_BG`, `src/components/app-sidebar.tsx`) que ignora o tema, e as telas são quase só brancas.

**Ajuste:** menu lateral preto com destaque vermelho vivo no item ativo e nos grupos; cabeçalhos de
página e de cartões com faixa de cor; abas e botões principais em vermelho; mesmo padrão em todas as
telas.

## 5. Ficha / histórico do produto

**Pedido:** pesquisar o produto, clicar nele e, na mesma tela, alterar custo, preço de venda e estoque
(reposição, transferência) e ver toda a movimentação — o que saiu por venda, quando entrou —, escolhendo
o período e podendo imprimir.

**Hoje:** as peças existem separadas — editar custo/preço (diálogo de edição), ajustar estoque (com
motivo, vai para o Kardex), Kardex geral (`estoque-movimentacoes.tsx`, sem filtro de data, até 300
linhas) e a auditoria grava cada mudança de preço/custo (`erp_auditoria`), mas nenhuma tela mostra.

**Ajuste:** "Ficha do produto" aberta ao clicar no produto: dados, custo, preço e estoque editáveis,
movimentação do produto com período (de/até), histórico de preço e custo, e imprimir.

## 6. Relatório mensal das notas para a contadora

**Pedido:** escolher o mês e ver todas as notas que subiram para a Receita; imprimir o relatório e
mandar os XML compactados para a contadora.

**Hoje:** Notas Fiscais não tem filtro de mês, mostra no máximo 200 notas e baixa um XML por vez; o
"Painel do Contador" mostra valores fixos ("Notas fiscais emitidas: —").

**Ajuste:** relatório por mês (e por loja): notas de venda, entrada, devolução, canceladas e
inutilizadas, totais; botão Imprimir e botão "Baixar XML (ZIP)" com todos os XML do mês; ligar o
Painel do Contador a esses dados.

## 7. Fiscal organizado como no Excellent

**Pedido:** "tenta deixar os nomes iguais": Notas de venda, Notas de entrada, Notas de devolução a
fornecedor, etc.

**Hoje:** o fiscal está espalhado por três grupos do menu (Vendas e Pedidos, Gestão Empresarial,
Fiscal) e a tela de notas é uma lista única.

**Ajuste:** grupo "Fiscal" único no menu com Notas de venda, Notas de entrada, Notas de devolução a
fornecedor, Inutilização, Manifesto (notas recebidas), Escrituração (SPED), Relatório da contadora,
Certificado e Configurações SEFAZ; abas equivalentes dentro da tela de notas.

## 8. Cadastro de tributos completo

**Pedido (vídeo da devolução):** tela de tributos com regime fiscal, origem do produto, situação
tributária, base de cálculo do ICMS, alíquota do ICMS e ICMS da operação.

**Hoje:** o produto tem NCM, CEST, CFOP (4 opções) e CSOSN (4 opções); origem, alíquota e CST existem
no banco mas não na tela; a nota envia sempre origem 0 e, no Simples, só o CSOSN, sem base nem valor de
ICMS (`services/nfe-service`).

**Ajuste:** bloco "Tributos" no cadastro do produto (regime/CRT, origem 0–8, CSOSN completo ou CST,
base e alíquota do ICMS, PIS/COFINS) e na nota por item; a emissão passa a usar esses valores e o
nfe-service a gravar base, alíquota e valor do ICMS quando a operação tiver destaque (ex.: devolução).

## 9. Nota de devolução a fornecedor

**Pedido:** como no Excellent — dados da nota (transportadora, volumes, peso), número do DANFE da nota
de entrada, buscar o produto no estoque, quantidade e valor a devolver, escolher o **CFOP da operação**
("às vezes muda"), editar a tributação do item e ver o **espelho** antes de subir para a Receita.

**Hoje:** a tela registra a devolução e baixa o estoque, mas **não emite nota**; o CFOP está fixo em
5202 (até para fornecedor de outro estado); o número/chave do DANFE só vem se a nota de entrada estiver
cadastrada; peso não aparece; transportadora, volumes e peso não vão para o XML; não há espelho; a
devolução salva não pode ser aberta, editada ou cancelada. O emissor trata devolução como nota de
entrada (`tpNF=0`), o que serve à devolução de cliente mas não à de fornecedor (saída).

**Ajuste:** devolução editável (rascunho) com chave do DANFE digitável, CFOP por item (5202/6202,
5411/6411 e outros), quantidade e valor, peso e volumes; tributos por item (item 8); **Espelho** (a nota
montada e validada sem enviar, com o DANFE de pré-visualização); **Emitir NF-e** de saída com finalidade
devolução, referência à nota de entrada e transporte no XML; status "faturada" com a nota ligada.
Testes em homologação antes de qualquer nota real.

---

## Plano de execução

| Etapa | Itens | Entrega |
|---|---|---|
| 1 | 1 e 2 | Defeitos do PDV corrigidos (estado da venda e vendas recusadas) |
| 2 | 3 | Frente de caixa com cor, ações destacadas e desconto na tela principal |
| 3 | 4 e 7 | Cores no sistema e menu Fiscal organizado como no Excellent |
| 4 | 5 | Ficha / histórico do produto |
| 5 | 6 | Relatório mensal das notas + ZIP dos XML + Painel do Contador |
| 6 | 8 | Cadastro de tributos e emissão usando os tributos do produto |
| 7 | 9 | Devolução a fornecedor com NF-e, CFOP por item, espelho e transporte |

Cada etapa: implementar, testar (automático + conferência no banco; fiscal só em homologação),
publicar e mandar o relatório da etapa.

---

## Resultado (10/10/2026, noite)

Todas as 7 etapas publicadas (front, migrations 100–102, edges e nfe-service) e testadas no Chrome
com o acesso de administrador, sempre com dados fictícios apagados ao final.

| Etapa | Commit | Teste ao vivo |
|---|---|---|
| 1 | 0b8d06a | desconto e pagamentos zeram ao esvaziar/alterar o cupom |
| 2 | 79d0003 | frente de caixa (print) |
| 3 | 41c3b90 | menu Fiscal e cores (print) |
| 4 | 873120f, e4456d7 | ficha do produto; reposição/ajuste não executados para não mexer no estoque real |
| 5 | 580a86c | relatório do mês (print); ZIP sem nota autorizada para conferir |
| 6 | e6e9014 | campos novos no produto; XML validado no emissor sem SEFAZ |
| 7 | 0537d0e, b0d6304, 742df28 | fornecedor pelo CEP → devolução 6202 com ICMS 12% → espelho e DANFE |

Achados no teste da etapa 7, já corrigidos:

- **Sem GRANT para service_role** em `erp_devolucoes_fornecedor`/itens e `erp_orcamentos`/itens: a
  edge respondia "devolução não encontrada" (migration 102). Outras tabelas sem GRANT para
  service_role que nenhuma edge lê hoje: `erp_venda_pagamentos`, `erp_fechamentos_caixa`,
  `erp_pedido_itens`, `erp_pessoa_enderecos`, `erp_pontos_venda`, `erp_papel_permissoes`, entre
  outras — uma edge nova que as use vai falhar do mesmo jeito.
- **dhEmi em UTC**: o PHP do nfe-service ignora a variável TZ; nota emitida depois das 21h saía com
  a data do dia seguinte. Agora `date_default_timezone_set`.

Pendências:

- Emitir em homologação uma devolução a fornecedor de verdade (só o espelho foi feito).
- Conferir o ZIP da contadora quando houver notas autorizadas no mês.
- XML de cancelamento e de inutilização não são guardados.
- Cancelar a venda não desfaz o "ganho" do lead no CRM.
- Juazeiro sem CSC e sem certificado vinculado; contador da NFC-e a acertar na virada para produção.
- `creditar_estoque_atomico` (reposição na ficha) não confere permissão no banco.
- NT 2025.002: data de produção da referência por item ainda incerta (05/10, 03/11 ou 16/11/2026).

---

## Segunda rodada (10/10/2026, 22h–22h45) — o que faltava + header

Publicado e testado ao vivo (commits ade392b a 7a87bdb e seguintes; migrations 103 e 104):

- **Tributos (item 8):** CST do ICMS (regime normal: 00, 40, 41, 50, 60, 90) e CST + alíquota de
  PIS/COFINS no produto; regime da loja (CRT) na Configuração SEFAZ, antes fixo na edge. Produto sem
  CST sai como antes (49 sem destaque). Dry-run `tests/dryrun-cst-pis.php` (regime normal, PIS/COFINS,
  recusas) + regressões.
- **Painel do Contador (item 6):** ligado às notas do mês (mesma consulta do relatório), vendas sem
  nota e financeiro do mês; os botões "SPED" falsos viraram atalhos para a Escrituração.
- **XML de cancelamento, CC-e e inutilização** guardados (bucket fiscal) e incluídos no ZIP.
- **Notas de Venda com abas** (NFC-e, NF-e, Devoluções, Canceladas, Inutilizações) e Inutilização no menu.
- **Header** preto como o menu, com página, caixa, data/hora e usuário. Os alertas **nunca contaram**:
  o componente não passava a loja ao hook; contas vencidas buscavam só "pendente"; views sem GRANT.
- **Datas no fuso local** em 14 arquivos do front (depois das 21h "hoje" virava amanhã).
- **Diálogos com rolagem** (o cadastro de produto passou da altura da tela).

Teste completo em homologação (SEFAZ-PE), com produto e fornecedor fictícios, tudo apagado depois:
cadastro do produto com PIS/COFINS → ficha (reposição +10, ajuste −1) → devolução (rascunho →
confirmar, estoque 9→7 → **NF-e 4 autorizada**) → carta de correção aceita → cancelamento aceito
(a devolução volta a "confirmada") → inutilização aceita → Painel do Contador → ZIP com nota,
eventos e inutilização.

Achados no teste e corrigidos: rejeição 1194 (chave de outro CNPJ) agora avisada antes de transmitir;
cancelar a nota reabre a devolução; detalhe da nota não atualizava depois do cancelamento.

Fica para decidir: **Painel do Contador está desativado por feature flag** desde 10/09 ("fora do uso
diário") — só o administrador vê. Reativar em Configurações › Feature flags se a loja for usar.
O regime normal (CST) só foi testado em dry-run: a loja é do Simples.

---

## Revisão final e guia para a loja (10/10/2026, 23h)

Pedidos do grupo relidos (texto e os 6 vídeos): os 9 prontos. Corrigido na revisão: percentuais do
Financeiro (lucro "4613%"), abas cortadas e botões sem cor; forma de pagamento legível em Vendas;
barra do PDV preta; bloco financeiro do Painel do Contador renomeado.

Guia para a loja (linguagem simples, o que mudou e como usar, com prints): PDF de 17 páginas enviado
ao Jean.

Pendente de decisão (segurança): a política `Authenticated can upload` em `storage.objects` permite a
qualquer usuário logado subir arquivo em qualquer bucket, inclusive `fiscal` e `certificados`.

## 11/10 — Devolução a fornecedor igual ao Excellent (vídeo de 3 min do grupo)

Tela conferida no próprio Excellent (só leitura, nada gerado lá) e refeita no mesmo desenho:
lista com período, busca, "Histórico de Notas Em Andamento", "Imprimir Relatório", Ver Nota e
Enviar E-mail; gerar com escolha do fornecedor (cadastro Completo/Incompleto), todos os campos
da nota (nº da nota de entrada, natureza, finalidade, volumes, frete, transportadora, placa,
RNTC, pesos, rateio igual ou por produto, seguro, endereço de entrega, informações adicionais),
vários DANFEs, produtos pelo estoque / Buscar NF Entrada / Importar XML, desconto em % e R$,
CFOP da tabela oficial inteira (300 de saída) e "Editar" com ICMS e IPI devolvido.

Commits 785b506, 36337cd, 588a70d, 816b9ca; migrations 108 e 109; erp-emitir-nfe e nfe-service
(impostoDevol, RNTC, tag entrega, seguro na base do ICMS) publicados.

Testado em homologação com dados de teste (apagados depois):
- espelho OK pelos dois caminhos (produto do estoque e Importar XML);
- a SEFAZ exige o **nº do item** da nota de entrada (rejeição 1048), apesar de o leiaute dizer
  opcional — virou obrigatório (vem sozinho do XML);
- a SEFAZ exige o **CNPJ inteiro** do destinatário igual ao emitente da nota de compra (1194);
- recusa da SEFAZ agora devolve o estoque (erp.reabrir_devolucao_fornecedor) e reabre o
  formulário; o histórico tem "Corrigir".
- A busca de produto mostrava saldo errado; agora é o da filial e não deixa devolver mais do que tem.

Fora de propósito: "Aplicar alíquota IBPT" (sem tabela IBPT; a lei vale para consumidor final).
Uma nota de devolução AUTORIZADA ponta a ponta só dá com uma nota de compra real do fornecedor.

## 11/10 — Áudios do grupo: ficha do produto e funcionários/limitações

Áudios (Antonio, 12h03): histórico de alteração item por item (o sistema diz 4, a prateleira tem 2:
quando entrou, o que saiu por venda, quem alterou) e mexer no produto pela ficha. A ficha
(Estoque Produtos → nome do produto) já fazia isso; testada com produto de exemplo, apareceram e
foram corrigidos (commit 32f… migration 110):
- custo médio: estoque sem custo médio gravado contava como custo zero na reposição (4 un. + 3 a
  R$ 72 = R$ 30,86); 9 de 10 estoques com saldo estavam assim — preenchidos com o custo do cadastro;
- margem: a lista calculava sobre o custo (71%) e a ficha sobre o preço (41,7%); agora sobre o preço
  em todo lugar, com a outra conta na dica;
- histórico de preço só aparecia depois de recarregar a página.

Funcionários e limitações: cadastro (sem login) testado e apagado; criação de login fica com o Jean.
Limitações conferidas no banco simulando o usuário caixa (transação desfeita): não lê salário,
auditoria, configuração SEFAZ nem contas; não altera nem apaga produto; não cria devolução; não se
promove a admin; vê só as vendas da filial.
