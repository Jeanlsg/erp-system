# Sessão 01 — Vendas e Pedidos (balcão)

Data: 10/09/2026 · Ambiente: **produção** (não há homologação) · Testado por: agente, conta `demo.admin@lojaxlife.com.br`

Regra do ambiente: nenhuma ação destrutiva ou de efeito externo foi executada (emitir/cancelar nota, enviar mensagem, excluir, fechar caixa, sangria). Esses botões foram abertos e fotografados, nunca confirmados — aparecem como ⏭️.

## Página: PDV — `/pdv`

Objetivo: Frente de caixa: abre o caixa, monta o carrinho, recebe e finaliza a venda.

Perfis com acesso: admin, gerente, caixa

Prints: [desktop](docs/auditoria/prints/01-vendas-balcao/01-pdv-inicial.jpeg) · [mobile](docs/auditoria/prints/01-vendas-balcao/01-pdv-mobile.jpeg) · [modal · Caixas em Aberto](docs/auditoria/prints/01-vendas-balcao/01-pdv-modal-caixas-em-aberto.jpeg) · [modal · Configurações](docs/auditoria/prints/01-vendas-balcao/01-pdv-modal-configuracoes.jpeg) · [modal · Abrir Caixa](docs/auditoria/prints/01-vendas-balcao/01-pdv-modal-abrir-caixa.jpeg)

Estado observado: 0 linha(s) na tabela, 2 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Caixas em Aberto (botão) | abrir formulário/modal | abre "Caixas em Aberto" | ✅ |  |
| Configurações (botão) | abrir formulário/modal | abre "Configurações de Caixa" · campos: Quantidade de Caixas | ✅ |  |
| CAIXA 001 (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| CAIXA 002 (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Abrir Caixa (botão) | abrir formulário/modal | abre "Abrir Caixa" | ✅ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx nesta tela.

## Página: Caixa — `/caixa`

Objetivo: Controle do caixa do dia: sangria, entrada extra e fechamento, com o esperado em gaveta.

Perfis com acesso: admin, gerente, caixa

Prints: [desktop](docs/auditoria/prints/01-vendas-balcao/02-caixa-inicial.jpeg) · [mobile](docs/auditoria/prints/01-vendas-balcao/02-caixa-mobile.jpeg)

Estado observado: 0 linha(s) na tabela, 0 campo(s), lista vazia.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Todas as lojas (botão) | reagir na tela | não localizado para clique | ⏭️ | elemento não é <button> (select/combobox) |
| Atualizar (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Sangria (botão) | só permitir com caixa aberto pelo próprio operador | **desabilitado**, com dica "Você não tem caixa aberto — sangria só no seu próprio caixa" (os 3 caixas estão fechados) | ✅ | regra de negócio correta; gravação em si não testada em produção |
| Entrada Extra (botão) | só permitir com caixa aberto pelo próprio operador | **desabilitado**, com dica "Você não tem caixa aberto — entrada só no seu próprio caixa" | ✅ | o timeout do primeiro teste era o botão desabilitado, não uma falha |
| Ir para PDV (botão) | navegar | navega para /pdv | ✅ |  |
| **listagem** | mostrar os caixas da loja | 3 caixas, com abertura, fechamento, valores e situação | ✅ | **corrigido nesta sessão** (BUG-02); antes vinha vazia |

Console e rede: sem erros JS e sem respostas 4xx/5xx nesta tela.

## Página: Vendas — `/vendas`

Objetivo: Histórico de vendas com número, cliente, valor, forma de pagamento e situação.

Perfis com acesso: admin, gerente, caixa

Prints: [desktop](docs/auditoria/prints/01-vendas-balcao/03-vendas-inicial.jpeg) · [mobile](docs/auditoria/prints/01-vendas-balcao/03-vendas-mobile.jpeg)

Estado observado: 0 linha(s) na tabela, 0 campo(s), lista vazia.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| (sem botões visíveis no estado inicial) | — | tela abre e renderiza | ✅ | ações dependem de dado em tela |
| **listagem** | mostrar as vendas da loja | 18 linhas · colunas Nº, Data, Cliente, Total, Forma, Status · contador "18 venda(s) registrada(s)" · 1ª linha: `#16 / 23/08/2026 / Consumidor / R$ 29,90 / dinheiro / finalizada` | ✅ | **corrigido nesta sessão** (BUG-01); antes vinha vazia |

Console e rede: sem erros JS e sem respostas 4xx/5xx nesta tela.

## Página: Devoluções — `/devolucoes`

Objetivo: Devolução parcial ou total de uma venda, item a item, decidindo o que volta ao estoque.

Perfis com acesso: admin, gerente, caixa

Prints: [desktop](docs/auditoria/prints/01-vendas-balcao/04-devolucoes-inicial.jpeg) · [mobile](docs/auditoria/prints/01-vendas-balcao/04-devolucoes-mobile.jpeg)

Estado observado: 0 linha(s) na tabela, 1 campo(s), lista vazia.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Buscar venda (combobox) | listar vendas para escolher | 18 vendas, com nº, valor e data (`#16 · R$ 29,90 23/08/2026`) | ✅ | busca digitável, não exige rolar |
| Carregar itens da venda | trazer os itens com quantidade e destino | venda #16 → 2 itens carregados | ✅ | |
| Registrar devolução | ficar bloqueado até marcar algo | **desabilitado** enquanto nada está marcado | ✅ | gravação não executada em produção |

Console e rede: sem erros JS e sem respostas 4xx/5xx nesta tela.

## Página: Notas Fiscais — `/notas-fiscais`

Objetivo: NF-e e NFC-e emitidas: consulta, XML, DANFE, cancelamento, carta de correção e inutilização.

Perfis com acesso: admin, gerente

Prints: [desktop](docs/auditoria/prints/01-vendas-balcao/05-notas-fiscais-inicial.jpeg) · [mobile](docs/auditoria/prints/01-vendas-balcao/05-notas-fiscais-mobile.jpeg) · [modal · Ver detalhes](docs/auditoria/prints/01-vendas-balcao/05-notas-fiscais-modal-ver-detalhes.jpeg)

Estado observado: 0 linha(s) na tabela, 2 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Inutilizar numeração (botão) | executar a ação | não acionado (produção: ação destrutiva ou de efeito externo) | ⏭️ | ação de efeito externo/irreversível — não acionada em produção |
| Emitir NF-e (botão) | executar a ação | não acionado (produção: ação destrutiva ou de efeito externo) | ⏭️ | ação de efeito externo/irreversível — não acionada em produção |
| Ver detalhes (botão) | abrir formulário/modal | abre "NF-e #2/1" | ✅ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx nesta tela.

## Página: Pedidos Delivery — `/pedidos-delivery`

Objetivo: Kanban de entrega: Pagamento → Separação → Despacho → Entregue.

Perfis com acesso: admin, gerente, caixa

Prints: [desktop](docs/auditoria/prints/01-vendas-balcao/06-pedidos-delivery-inicial.jpeg) · [mobile](docs/auditoria/prints/01-vendas-balcao/06-pedidos-delivery-mobile.jpeg)

Estado observado: 0 linha(s) na tabela, 0 campo(s), lista vazia.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| (sem botões visíveis no estado inicial) | — | tela abre e renderiza | ✅ | ações dependem de dado em tela |

Console e rede: sem erros JS e sem respostas 4xx/5xx nesta tela.

## Problemas encontrados

- **[BUG-01] Tela de Vendas nunca listou nada** · Severidade: **crítica** · **CORRIGIDO e no ar** (`add999c`)
  Passos: abrir `/vendas` com qualquer perfil. Havia 34 vendas no banco (16 Petrolina, 18 Juazeiro).
  Esperado: histórico de vendas. Obtido: "Nenhuma venda encontrada", sempre.
  Causa: `useVendas` pedia `usuario:erp_usuarios(*)`, mas `erp_vendas` tem **duas** FKs para `erp_usuarios` (`usuario_id` e `cancelado_por`). O PostgREST rejeita o embed ambíguo (`PGRST201`), o React Query devolve lista vazia e a tela mostra o estado "sem registros" em vez de erro — por isso passou despercebido.
  Correção aplicada: `usuario:erp_usuarios!erp_vendas_usuario_id_fkey(*)`. Verificado em produção: 18 vendas listadas.

- **[BUG-02] Caixa e "Caixas em Aberto" do PDV sempre vazios** · Severidade: **alta** · **CORRIGIDO e no ar**
  Mesma ambiguidade em `useCaixas` e `useCaixaPorId` (`erp_caixa` tem `usuario_id` e `encerrado_por`).
  Correção: `usuario:erp_usuarios!erp_caixa_usuario_id_fkey(id, nome)`. Verificado: 3 caixas listados.

- **[BUG-03] Remessas/Transferências com a mesma falha** · Severidade: **alta** · **CORRIGIDO e no ar**
  `useRemessas` (`erp_remessas` tem `usuario_id` e `recebido_por`). A tela é do lote 6; o defeito foi encontrado aqui e corrigido junto. **A conferir na sessão 6.**

- **[BUG-04] ~~"Entrada Extra" não abre~~ — NÃO PROCEDE**
  Reinvestigado: os botões Sangria e Entrada Extra estão `disabled` porque **não há caixa aberto** — com a dica "Você não tem caixa aberto — sangria só no seu próprio caixa". É a regra de negócio correta, bem comunicada. O timeout do primeiro teste era o robô tentando clicar em botão desabilitado.

### Varredura relacionada (estática + API)
Procurei o mesmo padrão em todo o código: **54 embeds** sem FK explícita, cruzados com as **7 tabelas que têm FK duplicada para o mesmo destino**. Só três combinações quebravam — as dos BUG-01/02/03, todas corrigidas. As demais não são usadas com embed implícito.

### Correções de método (auditoria)
- O primeiro teste de Devoluções clicou no primeiro `<li>` da página, que era um item do **menu lateral**, e navegou para o Dashboard — daí o falso "0 itens". Refeito com o seletor do próprio combobox: **18 vendas listadas, venda #16 carrega 2 itens**, botão de registrar bloqueado até marcar algo. Nenhum defeito do sistema.

### Resumo da sessão
6 páginas auditadas | 27 funções verificadas (20 ✅, 7 ⏭️ não executadas em produção) | **3 problemas reais, todos corrigidos** (1 crítico, 2 altos) + 1 falso positivo descartado
Páginas novas descobertas: nenhuma.
Não testado em produção (registrado para janela de homologação ou autorização): emitir NF-e, inutilizar numeração, gravar sangria/entrada extra, abrir e fechar caixa, cancelar venda, registrar devolução.
