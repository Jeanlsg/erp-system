# Sessão 05 — Financeiro e relatórios

Data: 10/09/2026 · Ambiente: **produção** (não há homologação) · Testado por: agente, conta `demo.admin@lojaxlife.com.br`

Regra do ambiente: botões de efeito imediato ou irreversível não são acionados (⏭️). Formulários são abertos e fotografados, nunca confirmados.

## Página: Relatórios Financeiros — `/financeiro`

Objetivo: Fluxo de caixa, contas a pagar e receber, vendas, formas de pagamento, taxas e ações de NF — em abas.

Perfis com acesso: admin, gerente

Prints: [desktop](docs/auditoria/prints/05-financeiro/01-relatorios-financeiros-inicial.jpeg) · [mobile](docs/auditoria/prints/05-financeiro/01-relatorios-financeiros-mobile.jpeg) · [modal · Incluir Contas P/R](docs/auditoria/prints/05-financeiro/01-relatorios-financeiros-modal-incluir-contas-p-r.jpeg) · [modal · Sangrias de Caixa](docs/auditoria/prints/05-financeiro/01-relatorios-financeiros-modal-sangrias-de-caixa.jpeg) · [modal · Entradas Extra Caixa](docs/auditoria/prints/05-financeiro/01-relatorios-financeiros-modal-entradas-extra-caixa.jpeg) · [modal · Extrato de Serviços](docs/auditoria/prints/05-financeiro/01-relatorios-financeiros-modal-extrato-de-servicos.jpeg) · [modal · Fechamento Caixa](docs/auditoria/prints/05-financeiro/01-relatorios-financeiros-modal-fechamento-caixa.jpeg) · [modal · Conta Bancária](docs/auditoria/prints/05-financeiro/01-relatorios-financeiros-modal-conta-bancaria.jpeg) · [modal · Vendas Excluídas](docs/auditoria/prints/05-financeiro/01-relatorios-financeiros-modal-vendas-excluidas.jpeg) · [modal · Contas Excluídas](docs/auditoria/prints/05-financeiro/01-relatorios-financeiros-modal-contas-excluidas.jpeg) · [modal · Entradas Canceladas](docs/auditoria/prints/05-financeiro/01-relatorios-financeiros-modal-entradas-canceladas.jpeg)

Texto de apoio na tela: *Fluxo de caixa e movimentações*

Estado observado: 6 linha(s) na tabela, 2 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Consultar (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Imprimir (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Incluir Contas P/R (botão) | abrir formulário/modal | abre "Nova Conta a Pagar" · campos: Descrição *, Valor *, Vencimento *, Categoria | ✅ |  |
| Sangrias de Caixa (botão) | abrir formulário/modal | abre "Sangrias de Caixa" | ✅ |  |
| Entradas Extra Caixa (botão) | abrir formulário/modal | abre "Entradas Extra Caixa" | ✅ |  |
| Extrato de Serviços (botão) | abrir formulário/modal | abre "Extrato de Serviços" | ✅ |  |
| Fechamento Caixa (botão) | abrir formulário/modal | abre "Fechamentos de Caixa" | ✅ |  |
| Conta Bancária (botão) | abrir formulário/modal | abre "Conta Bancária" | ✅ |  |
| Ações de NF (botão) | navegar | navega para /financeiro?aba=nf | ✅ |  |
| Vendas Excluídas (botão) | abrir formulário/modal | abre "Vendas Excluídas" | ✅ |  |
| Contas Excluídas (botão) | abrir formulário/modal | abre "Contas Excluídas" | ✅ |  |
| Relatório Gerencial (botão) | navegar | navega para /relatorios/analise | ✅ |  |
| Entregas Delivery (botão) | navegar | navega para /pedidos-delivery | ✅ |  |
| Entradas Canceladas (botão) | abrir formulário/modal | abre "Entradas Canceladas" | ✅ |  |
| Fluxo (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Vendas (botão) | navegar | navega para /financeiro?aba=vendas | ✅ |  |
| Gráficos (botão) | navegar | navega para /financeiro?aba=graficos | ✅ |  |
| Formas (botão) | navegar | navega para /financeiro?aba=formas | ✅ |  |
| Taxas (botão) | navegar | navega para /financeiro?aba=taxas | ✅ |  |
| Pagas (botão) | navegar | navega para /financeiro?aba=pagas | ✅ |  |
| À Pagar (botão) | navegar | navega para /financeiro?aba=apagar | ✅ |  |
| Recebidas (botão) | navegar | navega para /financeiro?aba=recebidas | ✅ |  |
| À Receber (botão) | navegar | navega para /financeiro?aba=areceber | ✅ |  |
| NF (botão) | navegar | navega para /financeiro?aba=nf | ✅ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Relatórios — `/relatorios`

Objetivo: Painel de indicadores do sistema: receita, vendas, ticket médio, contas vencidas, produtos e lojas.

Perfis com acesso: todos

Prints: [desktop](docs/auditoria/prints/05-financeiro/02-relatorios-inicial.jpeg) · [mobile](docs/auditoria/prints/05-financeiro/02-relatorios-mobile.jpeg)

Texto de apoio na tela: *Visão geral de KPIs do sistema*

Estado observado: 0 linha(s) na tabela, 0 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| (sem elementos acionáveis no estado inicial) | — | a tela abre e renderiza | ✅ | ações dependem de dado em tela |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Análise Gerencial — `/relatorios/analise`

Objetivo: Análise gerencial sobre venda registrada e custo médio real: Curva ABC, sugestão de compra, estoque parado e DRE.

Perfis com acesso: admin, gerente, estoquista

Prints: [desktop](docs/auditoria/prints/05-financeiro/03-analise-gerencial-inicial.jpeg) · [mobile](docs/auditoria/prints/05-financeiro/03-analise-gerencial-mobile.jpeg)

Texto de apoio na tela: *Sobre venda registrada e custo médio real — não sobre preço de tabela.*

Estado observado: 18 linha(s) na tabela, 2 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Todas as lojas (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Curva ABC (botão) | reagir na tela | falha ao clicar: locator.click: Timeout 6000ms exceeded. | ⚠️ |  |
| Sugestão de compra (botão) | reagir na tela | falha ao clicar: locator.click: Timeout 6000ms exceeded. | ⚠️ |  |
| Estoque parado (botão) | reagir na tela | falha ao clicar: locator.click: Timeout 6000ms exceeded. | ⚠️ |  |
| DRE (botão) | reagir na tela | falha ao clicar: locator.click: Timeout 6000ms exceeded. | ⚠️ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

### Verificações dirigidas

| Função | Resultado | Status |
|---|---|---|
| Análise Gerencial · **Curva ABC** | 18 linhas | ✅ |
| Análise Gerencial · **Sugestão de compra** | 2 linhas | ✅ |
| Análise Gerencial · **Estoque parado** | 8 linhas | ✅ |
| Análise Gerencial · **DRE** | 5 linhas | ✅ |
| Relatórios Financeiros · 10 abas | Fluxo, Vendas, Gráficos, Formas, Taxas, Pagas, À Pagar, Recebidas, À Receber, NF — todas trocam pela URL | ✅ |
| Relatórios Financeiros · 7 relatórios do rodapé | Sangrias, Entradas Extra, Extrato de Serviços, Fechamento de Caixa, Vendas Excluídas, Contas Excluídas, Entradas Canceladas — todos abrem com dados | ✅ |

*Os 4 timeouts que o robô registrou na Análise Gerencial eram limitação dele (botões de troca de visão); testados à mão, todos respondem — ver "Limitações do robô" adiante.*

### Conferência dos números contra o banco (loja Juazeiro, a selecionada)

| Indicador | Tela | Banco | Confere? |
|---|---|---|---|
| Receita total | R$ 2.664,70 | R$ 2.664,70 (21 vendas finalizadas) | ✅ |
| Contas vencidas | R$ 527,50 · 3 contas | R$ 527,50 · 3 | ✅ |
| Produtos / Lojas | 20 / 2 | 20 / 2 | ✅ |
| **Vendas** | **22** | 21 finalizadas + 1 devolvida | ⚠️ |
| **Ticket médio** | **R$ 121,12** | R$ 126,89 | ❌ **BUG-05-01** |

## Problemas encontrados

### [BUG-05-01] Ticket médio dividido por vendas que não entraram na receita · Severidade: **média** · CORRIGIDO

**O que estava errado.** A tela mostrava **R$ 121,12**; o banco dá **R$ 126,89**. A receita do numerador contava só as vendas **finalizadas** (R$ 2.664,70, 21 vendas), mas o denominador contava **todas** as vendas — incluindo a devolvida. Dividir receita de 21 vendas por 22 dá um ticket sempre menor que o real.

**Por que passa praticamente despercebido.** O número não é absurdo: é plausível, só errado. Ninguém conferiria R$ 121,12 contra R$ 126,89 sem ir ao banco — e é exatamente esse tipo de erro que envenena uma decisão de preço ou de meta.

**Correção.** O denominador passou a contar **apenas vendas finalizadas**, o mesmo critério do numerador (decisão do cliente: "mostra só as finalizadas").

**Verificação.** Tela e banco passaram a bater em **R$ 126,89**. O cartão "Vendas" continua mostrando 22 de propósito — ele conta vendas registradas, não faturadas.

## Limitações do robô (não são defeitos do sistema)

Os 4 timeouts que o robô registrou na Análise Gerencial eram limitação dele, não do sistema. Ficam com prefixo `ROBO-` para não se confundirem com bugs:

| # | Onde | O que o robô relatou | O que era de fato |
|---|---|---|---|
| ROBO-05-01 a 04 | `/relatorios/analise` | timeout em "Curva ABC", "Sugestão de compra", "Estoque parado" e "DRE" | são botões de **troca de visão** dentro da mesma tela, com seletor ambíguo para o Playwright. Testados à mão, **todos respondem** e trazem dados (a DRE com 5 linhas) |

### Resumo da sessão
3 páginas | 29 funções verificadas (25 ✅, 0 ⏭️ não executadas em produção, 4 ⚠️, 0 ❌) | 4 problema(s)
Páginas novas descobertas: nenhuma.

