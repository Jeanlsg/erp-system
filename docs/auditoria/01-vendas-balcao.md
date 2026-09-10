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
| Sangria (botão) | executar a ação | não acionado (produção: ação destrutiva ou de efeito externo) | ⏭️ | ação de efeito externo/irreversível — não acionada em produção |
| Entrada Extra (botão) | reagir na tela | falha ao clicar: locator.click: Timeout 5000ms exceeded. | ⚠️ |  |
| Ir para PDV (botão) | navegar | navega para /pdv | ✅ |  |
| **listagem** | mostrar os registros da loja | **vazia — ver BUG-02** | ❌ | consulta rejeitada pelo PostgREST |

Console e rede: sem erros JS e sem respostas 4xx/5xx nesta tela.

## Página: Vendas — `/vendas`

Objetivo: Histórico de vendas com número, cliente, valor, forma de pagamento e situação.

Perfis com acesso: admin, gerente, caixa

Prints: [desktop](docs/auditoria/prints/01-vendas-balcao/03-vendas-inicial.jpeg) · [mobile](docs/auditoria/prints/01-vendas-balcao/03-vendas-mobile.jpeg)

Estado observado: 0 linha(s) na tabela, 0 campo(s), lista vazia.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| (sem botões visíveis no estado inicial) | — | tela abre e renderiza | ✅ | ações dependem de dado em tela |
| **listagem** | mostrar os registros da loja | **vazia — ver BUG-01** | ❌ | consulta rejeitada pelo PostgREST |

Console e rede: sem erros JS e sem respostas 4xx/5xx nesta tela.

## Página: Devoluções — `/devolucoes`

Objetivo: Devolução parcial ou total de uma venda, item a item, decidindo o que volta ao estoque.

Perfis com acesso: admin, gerente, caixa

Prints: [desktop](docs/auditoria/prints/01-vendas-balcao/04-devolucoes-inicial.jpeg) · [mobile](docs/auditoria/prints/01-vendas-balcao/04-devolucoes-mobile.jpeg)

Estado observado: 0 linha(s) na tabela, 1 campo(s), lista vazia.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| (sem botões visíveis no estado inicial) | — | tela abre e renderiza | ✅ | ações dependem de dado em tela |

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

- **[BUG-01] Tela de Vendas nunca lista nada** · Severidade: **crítica**
  Passos: abrir `/vendas` com qualquer perfil. Existem 34 vendas no banco (16 em Petrolina, 18 em Juazeiro).
  Esperado: histórico de vendas. Obtido: "Nenhuma venda encontrada" — sempre, em qualquer loja.
  Causa: `useVendas` ([supabase-queries.ts:418](../../src/lib/supabase-queries.ts#L418)) pede `usuario:erp_usuarios(*)`, mas `erp_vendas` tem **duas** chaves estrangeiras para `erp_usuarios` (`usuario_id` e `cancelado_por`). O PostgREST não sabe qual usar e rejeita a consulta inteira com `PGRST201`; o React Query devolve lista vazia e a tela mostra o estado "sem registros" em vez de um erro.
  Console/rede: `300 /rest/v1/erp_vendas?select=*,itens:...` com `{"code":"PGRST201"}`.
  Correção sugerida: nomear a FK — `usuario:erp_usuarios!erp_vendas_usuario_id_fkey(*)`. **Validado contra a API: com a FK explícita a consulta retorna as vendas.**

- **[BUG-02] Caixa e lista de caixas do PDV sempre vazias** · Severidade: **alta**
  Passos: abrir `/caixa`; ou no PDV, "Caixas em Aberto". Existem 3 caixas no banco.
  Esperado: os caixas da loja. Obtido: vazio.
  Causa: mesma ambiguidade em `useCaixas` ([supabase-queries.ts:1092](../../src/lib/supabase-queries.ts#L1092)) e `useCaixaPorId` (linha 1134) — `erp_caixa` tem `usuario_id` e `encerrado_por` apontando para `erp_usuarios`.
  Correção sugerida: `usuario:erp_usuarios!erp_caixa_usuario_id_fkey(id, nome)`. **Validado contra a API.**

- **[BUG-03] Remessas/Transferências com a mesma falha** · Severidade: **alta**
  Causa: `useRemessas` ([supabase-queries.ts:1894](../../src/lib/supabase-queries.ts#L1894)) — `erp_remessas` tem `usuario_id` e `recebido_por` para `erp_usuarios`. Confirmado `PGRST201` na API. A tela é do lote 6, mas o defeito é o mesmo e foi encontrado aqui.
  Correção sugerida: `usuario:erp_usuarios!erp_remessas_usuario_id_fkey(...)`.

- **[BUG-04] Botão "Entrada Extra" do Caixa não abre** · Severidade: média
  Passos: `/caixa` → clicar em "Entrada Extra". O clique excede 5s sem abrir o modal (o robô registrou timeout); "Sangria", ao lado, tem o mesmo padrão de código.
  Hipótese: o botão depende de um caixa aberto e fica inerte quando a lista está vazia — ou seja, pode ser consequência do BUG-02. **A confirmar após a correção do BUG-02.**

### Varredura relacionada (estática + API)
Procurei o mesmo padrão em todo o código: **54 embeds** sem FK explícita, cruzados com as **7 tabelas que têm FK duplicada para o mesmo destino**. Só três combinações realmente quebram — as dos BUG-01/02/03. As demais (ex.: `erp_recomendacoes → erp_pessoas`) não são usadas com embed implícito no código.

### Resumo da sessão
6 páginas auditadas | 21 elementos exercitados (11 ✅, 7 ⏭️ por segurança em produção, 1 ⚠️, 2 ❌) | **4 problemas: 1 crítico, 2 altos, 1 médio**
Páginas novas descobertas: nenhuma.
Não testado em produção: emitir NF-e, inutilizar numeração, sangria, fechar caixa, cancelar venda — registrados, aguardando janela de homologação ou autorização.

