# Sessão 03 — Estoque, compras e produto

Data: 10/09/2026 · Ambiente: **produção** (não há homologação) · Testado por: agente, conta `demo.admin@lojaxlife.com.br`

Regra do ambiente: botões de efeito imediato ou irreversível não são acionados (⏭️). Formulários são abertos e fotografados, nunca confirmados.

## Página: Cadastro e Estoque — `/produtos-estoque-lotes`

Objetivo: Cadastro de produtos, categorias, lotes e saldo por loja numa tela só, com reajuste em massa, etiquetas e importação por planilha.

Perfis com acesso: admin, gerente, estoquista

Prints: [desktop](docs/auditoria/prints/03-estoque/01-cadastro-e-estoque-inicial.jpeg) · [mobile](docs/auditoria/prints/03-estoque/01-cadastro-e-estoque-mobile.jpeg) · [modal · Cadastrar Produto](docs/auditoria/prints/03-estoque/01-cadastro-e-estoque-modal-cadastrar-produto.jpeg) · [modal · Importar Planilha](docs/auditoria/prints/03-estoque/01-cadastro-e-estoque-modal-importar-planilha.jpeg) · [modal · Classificação](docs/auditoria/prints/03-estoque/01-cadastro-e-estoque-modal-classificacao.jpeg) · [modal · Reajustes de Preços](docs/auditoria/prints/03-estoque/01-cadastro-e-estoque-modal-reajustes-de-precos.jpeg) · [modal · Validade / Lotes](docs/auditoria/prints/03-estoque/01-cadastro-e-estoque-modal-validade-lotes.jpeg) · [modal · Gerar Etiquetas](docs/auditoria/prints/03-estoque/01-cadastro-e-estoque-modal-gerar-etiquetas.jpeg) · [modal · Produtos Excluídos](docs/auditoria/prints/03-estoque/01-cadastro-e-estoque-modal-produtos-excluidos.jpeg)

Estado observado: 25 linha(s) na tabela, 1 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Cadastrar Produto (botão) | abrir formulário/modal | abre "Cadastrar Produto" · campos: SKU *, Cód. Barras, Nome do Produto *, Valor Custo, Valor Venda, Estoque Mín., Duração típica (dias), Marca | ✅ |  |
| Importar Planilha (botão) | abrir formulário/modal | abre "Importar Produtos (planilha)" | ✅ |  |
| Classificação (botão) | abrir formulário/modal | abre "Gerenciar Classificações" · campos: Nome, Descrição | ✅ |  |
| Movimentação Estoque (botão) | navegar | navega para /estoque/movimentacoes | ✅ |  |
| Reajustes de Preços (botão) | abrir formulário/modal | abre "Reajuste de preços" · campos: Percentual (%) | ✅ |  |
| Validade / Lotes (botão) | abrir formulário/modal | abre "Validade / Lotes" · campos: Produto | ✅ |  |
| Catálogo (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Gerar Etiquetas (botão) | abrir formulário/modal | abre "Formato das etiquetas" | ✅ |  |
| Kit/Combo (botão) | navegar | navega para /kits | ✅ |  |
| Inventário Estoque (botão) | navegar | navega para /estoque/inventario | ✅ |  |
| Relatórios (botão) | navegar | navega para /relatorios | ✅ |  |
| Produtos Excluídos (botão) | abrir formulário/modal | abre "Produtos excluídos" | ✅ |  |
| Todas as lojas (botão) | reagir na tela | não localizado para clique | ⏭️ |  |
| Todas (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| 25 (botão) | reagir na tela | falha ao clicar: locator.click: Timeout 6000ms exceeded. | ⚠️ |  |
| Editar produto (botão) | reagir na tela | não localizado para clique | ⏭️ |  |
| Validade e lotes (botão) | reagir na tela | não localizado para clique | ⏭️ |  |
| Anterior (botão) | bloquear enquanto a condição não é atendida | desabilitado (sem dica visível) | ⚠️ | bloqueado sem explicar o motivo |
| Próxima (botão) | reagir na tela | falha ao clicar: locator.click: Timeout 6000ms exceeded. | ⚠️ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Movimentações (Kardex) — `/estoque/movimentacoes`

Objetivo: Kardex: toda entrada e saída com saldo anterior, posterior e custo médio do momento.

Perfis com acesso: admin, gerente, estoquista

Prints: [desktop](docs/auditoria/prints/03-estoque/02-movimentacoes-kardex-inicial.jpeg) · [mobile](docs/auditoria/prints/03-estoque/02-movimentacoes-kardex-mobile.jpeg)

Texto de apoio na tela: *Livro de movimentação (kardex). Cada entrada, saída e ajuste fica registrado com saldo e custo do momento — o histórico não é editável; correções entram como novo ajuste.*

Estado observado: 44 linha(s) na tabela, 1 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Todas (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Todos (botão) | reagir na tela | falha ao clicar: locator.click: Timeout 6000ms exceeded. | ⚠️ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Inventário / Balanço — `/estoque/inventario`

Objetivo: Contagem física contra o saldo do sistema, gerando ajuste rastreável por divergência.

Perfis com acesso: admin, gerente, estoquista

Prints: [desktop](docs/auditoria/prints/03-estoque/03-inventario-balanco-inicial.jpeg) · [mobile](docs/auditoria/prints/03-estoque/03-inventario-balanco-mobile.jpeg) · [modal · Abrir inventário](docs/auditoria/prints/03-estoque/03-inventario-balanco-modal-abrir-inventario.jpeg)

Texto de apoio na tela: *Conte o estoque físico e aplique as divergências. Cada ajuste vira um movimento rastreável no kardex, em vez de sobrescrever o saldo em silêncio.*

Estado observado: 1 linha(s) na tabela, 0 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Abrir inventário (botão) | abrir formulário/modal | abre "Abrir inventário" · campos: Loja, Observações | ✅ |  |
| Todas as lojas (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Contagem (botão) | reagir na tela | falha ao clicar: locator.click: Timeout 6000ms exceeded. | ⚠️ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Transferências — `/estoque.transferencia`

Objetivo: Transferência de mercadoria entre lojas, com nota de remessa.

Perfis com acesso: admin, gerente, estoquista

Prints: [desktop](docs/auditoria/prints/03-estoque/04-transferencias-inicial.jpeg) · [mobile](docs/auditoria/prints/03-estoque/04-transferencias-mobile.jpeg) · [modal · Nova Remessa](docs/auditoria/prints/03-estoque/04-transferencias-modal-nova-remessa.jpeg)

Texto de apoio na tela: *Transferência de produtos entre lojas com emissão de NFe*

Estado observado: 0 linha(s) na tabela, 2 campo(s), lista vazia.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Nova Remessa (botão) | abrir formulário/modal | abre "Nova Remessa entre Filiais" · campos: Loja Origem *, Loja Destino *, Tipo *, Previsão Chegada, CFOP Automático, Valor Frete, Valor Seguro, Adicionar Produtos | ✅ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Compras — `/compras`

Objetivo: Pedidos de compra ao fornecedor; a entrada atualiza estoque, custo médio e contas a pagar.

Perfis com acesso: admin, gerente, estoquista

Prints: [desktop](docs/auditoria/prints/03-estoque/05-compras-inicial.jpeg) · [mobile](docs/auditoria/prints/03-estoque/05-compras-mobile.jpeg) · [modal · Nova Compra](docs/auditoria/prints/03-estoque/05-compras-modal-nova-compra.jpeg)

Texto de apoio na tela: *0 pedido(s) de compra*

Estado observado: 0 linha(s) na tabela, 0 campo(s), lista vazia.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Nova Compra (botão) | abrir formulário/modal | abre "Nova Compra" · campos: Fornecedor *, Itens da compra *, Observações | ✅ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Importar NFe — `/compras/importar-nfe`

Objetivo: Entrada de mercadoria pelo XML da nota do fornecedor ou pelo número da nota recebida da SEFAZ.

Perfis com acesso: admin, gerente, estoquista

Prints: [desktop](docs/auditoria/prints/03-estoque/06-importar-nfe-inicial.jpeg) · [mobile](docs/auditoria/prints/03-estoque/06-importar-nfe-mobile.jpeg)

Texto de apoio na tela: *Faça o upload do XML da NFe para cadastrar produtos automaticamente*

Estado observado: 0 linha(s) na tabela, 2 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| (sem elementos acionáveis no estado inicial) | — | a tela abre e renderiza | ✅ | ações dependem de dado em tela |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Kits & Combos — `/kits`

Objetivo: Produtos compostos: o kit agrupa itens e baixa o estoque dos componentes ao vender.

Perfis com acesso: admin, gerente, estoquista

Prints: [desktop](docs/auditoria/prints/03-estoque/07-kits-combos-inicial.jpeg) · [mobile](docs/auditoria/prints/03-estoque/07-kits-combos-mobile.jpeg) · [modal · Novo Kit](docs/auditoria/prints/03-estoque/07-kits-combos-modal-novo-kit.jpeg)

Texto de apoio na tela: *0 kit(s) cadastrado(s)*

Estado observado: 0 linha(s) na tabela, 0 campo(s), lista vazia.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Novo Kit (botão) | abrir formulário/modal | abre "Novo Kit" · campos: Nome *, Descrição, Preço do Kit (R$) *, Produtos do kit | ✅ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

### Verificações dirigidas (fora do alcance do robô)

Estes itens o robô não conseguiu acionar por serem `<Select>` do Radix ou botões só com ícone. Foram testados à mão:

| Função | Resultado | Status |
|---|---|---|
| Paginação de Cadastro e Estoque | página 1 mostra "Mostrando 1 a 25 de 40"; **Próxima** leva a "26 a 40 de 40" e fica desabilitada no fim; **Anterior** desabilitada na primeira | ✅ |
| Filtro de loja | 3 opções: Todas as lojas, Juazeiro, Petrolina | ✅ |
| Botão **Editar produto** (ícone na linha) | abre o formulário com os dados do produto: SKU, Cód. Barras, Nome, Custo, Venda, Estoque mín., Duração típica, Marca, Unidade, Classificação | ✅ |
| Botão **Validade e lotes** (ícone na linha) | abre "Validade e lotes" com Quantidade, Código do lote, Loja, Validade (data ou prazo), Fabricação | ✅ |
| Botões de Inventário | "Abrir inventário", filtro de loja e "Contagem" presentes; abrir inventário não executado (cria registro e fotografa o saldo) | ⏭️ |

## Problemas encontrados

- **[BUG-03-01]** Severidade: a classificar · `/produtos-estoque-lotes` — 25: falha ao clicar: locator.click: Timeout 6000ms exceeded.

- **[BUG-03-02]** Severidade: a classificar · `/produtos-estoque-lotes` — Anterior: desabilitado (sem dica visível)

- **[BUG-03-03]** Severidade: a classificar · `/produtos-estoque-lotes` — Próxima: falha ao clicar: locator.click: Timeout 6000ms exceeded.

- **[BUG-03-04]** Severidade: a classificar · `/estoque/movimentacoes` — Todos: falha ao clicar: locator.click: Timeout 6000ms exceeded.

- **[BUG-03-05]** Severidade: a classificar · `/estoque/inventario` — Contagem: falha ao clicar: locator.click: Timeout 6000ms exceeded.

### Resumo da sessão
7 páginas | 27 funções verificadas (19 ✅, 3 ⏭️ não executadas em produção, 5 ⚠️, 0 ❌) | 5 problema(s)
Páginas novas descobertas: nenhuma.

