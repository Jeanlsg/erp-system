# Sessão 07 — Atendimento, início e usuários

Data: 10/09/2026 · Ambiente: **produção** (não há homologação) · Testado por: agente, conta `demo.admin@lojaxlife.com.br`

Regra do ambiente: botões de efeito imediato ou irreversível não são acionados (⏭️). Formulários são abertos e fotografados, nunca confirmados.

## Página: Notificações — `/gestao/notificacoes`

Objetivo: Avisos do sistema para o operador (estoque, contas, tarefas).

Perfis com acesso: todos

Prints: [desktop](prints/07-atendimento-inicio/01-notificacoes-inicial.jpeg) · [mobile](prints/07-atendimento-inicio/01-notificacoes-mobile.jpeg)

Texto de apoio na tela: *0 não lida(s) de 0 total*

Estado observado: 0 linha(s) na tabela, 0 campo(s), lista vazia.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| (sem elementos acionáveis no estado inicial) | — | a tela abre e renderiza | ✅ | página informativa ou dependente de dado |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Exclusão LGPD — `/gestao/exclusao-informacoes`

Objetivo: Solicitações de exclusão de dados pessoais (LGPD, Lei 13.709/2018).

Perfis com acesso: admin, gerente

Prints: [desktop](prints/07-atendimento-inicio/02-exclusao-lgpd-inicial.jpeg) · [mobile](prints/07-atendimento-inicio/02-exclusao-lgpd-mobile.jpeg)

Texto de apoio na tela: *Solicitações de exclusão de dados pessoais conforme Lei 13.709/2018*

Estado observado: 14 linha(s) na tabela, 1 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Solicitar Exclusão (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Dashboard — `/`

Objetivo: Resumo do dia: vendas, ticket médio, estoque baixo, contas vencidas e alertas.

Perfis com acesso: todos

Prints: [desktop](prints/07-atendimento-inicio/03-dashboard-inicial.jpeg) · [mobile](prints/07-atendimento-inicio/03-dashboard-mobile.jpeg)

Texto de apoio na tela: *Visão geral da operação · hoje, 10/09/2026*

Estado observado: 0 linha(s) na tabela, 0 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| (sem elementos acionáveis no estado inicial) | — | a tela abre e renderiza | ✅ | página informativa ou dependente de dado |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Visão Geral — `/visao-geral`

Objetivo: Consolidado multi-loja com filtros por período e por unidade.

Perfis com acesso: admin, gerente

Prints: [desktop](prints/07-atendimento-inicio/04-visao-geral-inicial.jpeg) · [mobile](prints/07-atendimento-inicio/04-visao-geral-mobile.jpeg)

Texto de apoio na tela: *Consolidado multi-loja com filtros por período e por unidade.*

Estado observado: 2 linha(s) na tabela, 0 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Últimos 30 dias (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Todas (botão) | reagir na tela | falha ao clicar: locator.click: Timeout 6000ms exceeded. | ⚠️ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Visão Geral (Gestão) — `/gestao`

Objetivo: Hub central de cadastros e operações da gestão.

Perfis com acesso: todos

Prints: [desktop](prints/07-atendimento-inicio/05-visao-geral-gestao-inicial.jpeg) · [mobile](prints/07-atendimento-inicio/05-visao-geral-gestao-mobile.jpeg)

Texto de apoio na tela: *Hub central de cadastros e operações*

Estado observado: 0 linha(s) na tabela, 0 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| (sem elementos acionáveis no estado inicial) | — | a tela abre e renderiza | ✅ | página informativa ou dependente de dado |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Usuários e Permissões — `/gestao/usuarios`

Objetivo: Usuários do sistema: papel, loja padrão, permissões e redefinição de senha.

Perfis com acesso: admin

Prints: [desktop](prints/07-atendimento-inicio/06-usuarios-e-permissoes-inicial.jpeg) · [mobile](prints/07-atendimento-inicio/06-usuarios-e-permissoes-mobile.jpeg) · [modal · Novo Usuário](prints/07-atendimento-inicio/06-usuarios-e-permissoes-modal-novo-usuario.jpeg)

Texto de apoio na tela: *2 usuário(s) cadastrado(s)*

Estado observado: 2 linha(s) na tabela, 1 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Atualizar (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Novo Usuário (botão) | abrir formulário/modal | abre "Novo Usuário" · campos: Nome *, E-mail *, Papel, Loja Padrão, Telefone, Status, Usuário ativo, Definir senha agora (senão, envia e-mail de convite) | ✅ |  |
| Todos (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Editar (botão) | reagir na tela | não localizado para clique | ⏭️ |  |
| Gerenciar permissões (botão) | reagir na tela | não localizado para clique | ⏭️ |  |
| Enviar email de redefinição de senha (botão) | reagir na tela | não localizado para clique | ⏭️ |  |
| Desativar (botão) | executar a ação | desabilitado — "Desativar" | ✅ | efeito imediato/irreversível — não executado em produção |
| Excluir usuário (botão) | executar a ação | desabilitado — "Excluir usuário" | ✅ | efeito imediato/irreversível — não executado em produção |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

### Verificações dirigidas

| Função | Resultado | Status |
|---|---|---|
| Usuários · **Editar** (ícone) | abre "Editar Usuário": Nome, E-mail, Papel, Loja Padrão, Telefone, Status | ✅ |
| Usuários · **Gerenciar permissões** (ícone) | abre "Permissões de Conta Demonstração", indicando "Usando permissões padrão do role: Administrador" e permitindo customizar | ✅ |
| Usuários · Desativar / Excluir | **desabilitados** — proteção contra remover a si mesmo ou o último admin | ✅ |
| LGPD · Solicitar Exclusão | 14 solicitações listadas; formulário responde | ✅ |

### Conferência dos números do Dashboard contra o banco (Juazeiro)

| Indicador | Tela | Banco | Confere? |
|---|---|---|---|
| Vendas hoje | R$ 12,00 · 4 tickets | R$ 12,00 · 4 finalizadas | ✅ |
| Ticket médio | R$ 3,00 | R$ 3,00 | ✅ |
| Contas vencidas | 3 · R$ 527,50 | 3 · R$ 527,50 | ✅ |
| Estoque baixo | 1 produto | 1 (critério `quantidade <= mínimo`) | ✅ |

## Problemas encontrados

- **[OBS-07-01] Rótulo do card "Estoque baixo"** · Severidade: informativa
  O card diz "produtos abaixo do mínimo", mas o critério conta também os que estão exatamente **no** mínimo (`quantidade <= mínimo`). O comportamento é o certo para reposição — atingir o mínimo é a hora de comprar —, apenas o texto descreve outra coisa. Sugestão sem urgência: "no mínimo ou abaixo".

*O timeout registrado pelo robô no filtro "Todas" da Visão Geral era ambiguidade de seletor (`<Select>` do Radix), não defeito: o filtro abre e lista as lojas.*

### Resumo da sessão
6 páginas | 11 funções verificadas (7 ✅, 3 ⏭️ não executadas em produção, 1 ⚠️, 0 ❌) | 1 problema(s)
Páginas novas descobertas: nenhuma.

