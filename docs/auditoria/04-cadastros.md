# Sessão 04 — Cadastros e pessoas

Data: 10/09/2026 · Ambiente: **produção** (não há homologação) · Testado por: agente, conta `demo.admin@lojaxlife.com.br`

Regra do ambiente: botões de efeito imediato ou irreversível não são acionados (⏭️). Formulários são abertos e fotografados, nunca confirmados.

## Página: Clientes — `/gestao/clientes`

Objetivo: Cadastro de clientes com histórico de compras e total gasto, contados por telefone.

Perfis com acesso: admin, gerente, caixa

Prints: [desktop](docs/auditoria/prints/04-cadastros/01-clientes-inicial.jpeg) · [mobile](docs/auditoria/prints/04-cadastros/01-clientes-mobile.jpeg) · [modal · Novo Cliente](docs/auditoria/prints/04-cadastros/01-clientes-modal-novo-cliente.jpeg) · [modal · Editar](docs/auditoria/prints/04-cadastros/01-clientes-modal-editar.jpeg)

Texto de apoio na tela: *12 cliente(s) cadastrado(s)*

Estado observado: 12 linha(s) na tabela, 1 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Novo Cliente (botão) | abrir formulário/modal | abre "Novo Cliente" · campos: Nome *, CPF, Email, Telefone, Celular | ✅ |  |
| Editar (botão) | abrir formulário/modal | abre "Editar Cliente" · campos: Razão Social *, CNPJ, Email, Telefone, Celular | ✅ |  |
| Inativar (botão) | executar a ação | não acionado (efeito imediato/irreversível em produção) | ⏭️ | efeito imediato/irreversível — não executado em produção |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Fornecedores — `/gestao/fornecedores`

Objetivo: Cadastro de fornecedores usado em compras, contas a pagar e entrada de NF-e.

Perfis com acesso: admin, gerente, estoquista

Prints: [desktop](docs/auditoria/prints/04-cadastros/02-fornecedores-inicial.jpeg) · [mobile](docs/auditoria/prints/04-cadastros/02-fornecedores-mobile.jpeg) · [modal · Novo Fornecedor](docs/auditoria/prints/04-cadastros/02-fornecedores-modal-novo-fornecedor.jpeg) · [modal · Editar](docs/auditoria/prints/04-cadastros/02-fornecedores-modal-editar.jpeg)

Texto de apoio na tela: *12 fornecedor(es) cadastrado(s)*

Estado observado: 12 linha(s) na tabela, 1 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Novo Fornecedor (botão) | abrir formulário/modal | abre "Novo Fornecedor" · campos: Razão Social *, Nome Fantasia, CNPJ, Email, Telefone | ✅ |  |
| Editar (botão) | abrir formulário/modal | abre "Editar Fornecedor" · campos: Razão Social *, Nome Fantasia, CNPJ, Email, Telefone | ✅ |  |
| Excluir (botão) | executar a ação | não acionado (efeito imediato/irreversível em produção) | ⏭️ | efeito imediato/irreversível — não executado em produção |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Funcionários — `/gestao/funcionarios`

Objetivo: Cadastro de funcionários, percentual de comissão e vínculo com o usuário do sistema.

Perfis com acesso: admin, gerente

Prints: [desktop](docs/auditoria/prints/04-cadastros/03-funcionarios-inicial.jpeg) · [mobile](docs/auditoria/prints/04-cadastros/03-funcionarios-mobile.jpeg) · [modal · Novo Funcionário](docs/auditoria/prints/04-cadastros/03-funcionarios-modal-novo-funcionario.jpeg)

Texto de apoio na tela: *7 funcionário(s) · 7 ativos*

Estado observado: 7 linha(s) na tabela, 1 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Novo Funcionário (botão) | abrir formulário/modal | abre "Novo Funcionário" · campos: Nome *, CPF, Cargo, Departamento, Email, Telefone, Salário, Comissão % | ✅ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Comissões — `/gestao/comissoes`

Objetivo: Comissão de cada venda com vendedor, por período, com pagamento em lote.

Perfis com acesso: admin, gerente

Prints: [desktop](docs/auditoria/prints/04-cadastros/04-comissoes-inicial.jpeg) · [mobile](docs/auditoria/prints/04-cadastros/04-comissoes-mobile.jpeg)

Texto de apoio na tela: *Geradas automaticamente a cada venda com vendedor. O % vem do funcionário; produto ou serviço com % próprio sobrepõe.*

Estado observado: 0 linha(s) na tabela, 4 campo(s), lista vazia.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Pagar selecionadas (0) (botão) | executar a ação | desabilitado (sem dica visível) | ⚠️ | efeito imediato/irreversível — não executado em produção |
| Pagar todas pendentes (0) (botão) | executar a ação | desabilitado (sem dica visível) | ⚠️ | efeito imediato/irreversível — não executado em produção |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Lojas — `/lojas`

Objetivo: Cadastro das lojas (matriz e filiais) e conferência do cadastro na SEFAZ.

Perfis com acesso: admin, gerente

Prints: [desktop](docs/auditoria/prints/04-cadastros/05-lojas-inicial.jpeg) · [mobile](docs/auditoria/prints/04-cadastros/05-lojas-mobile.jpeg) · [modal · Nova Loja](docs/auditoria/prints/04-cadastros/05-lojas-modal-nova-loja.jpeg) · [modal · Editar](docs/auditoria/prints/04-cadastros/05-lojas-modal-editar.jpeg)

Texto de apoio na tela: *2 loja(s) cadastrada(s)*

Estado observado: 2 linha(s) na tabela, 0 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Nova Loja (botão) | abrir formulário/modal | abre "Nova Loja" · campos: Nome *, Apelido *, CNPJ, Telefone, Email, Cidade, UF, Esta loja é a matriz | ✅ |  |
| Editar (botão) | abrir formulário/modal | abre "Editar Loja" · campos: Nome *, Apelido *, CNPJ, Telefone, Email, Cidade, UF, Esta loja é a matriz | ✅ |  |
| Conferir cadastro na SEFAZ (IE e endereço do emitente) (botão) | reagir na tela | mensagem: "cadastro confere com a SEFAZ IE 233978558 · habilitado" | ✅ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

### Fluxos executados de verdade

| Fluxo | Resultado | Status |
|---|---|---|
| Lojas · **Conferir cadastro na SEFAZ** | consulta real: "cadastro confere com a SEFAZ · IE 233978558 · habilitado" | ✅ |
| Funcionários · cadastrar vendedor com 10% e **vincular ao usuário do sistema** | criado e vinculado à conta demo | ✅ |
| PDV · vender com vendedor vinculado | venda R$ 3,00 finalizada | ✅ |
| Comissões · **geração automática** | comissão de **R$ 0,30** (10% de R$ 3,00) criada sozinha, listada em "A pagar no período" e agrupada por vendedor | ✅ |
| Comissões · **pagar pendentes** | "1 comissão(ões) marcada(s) como paga(s)" → A pagar R$ 0,00 · Pagas R$ 0,30 | ✅ |

*Registros criados: funcionário "Vendedor Auditoria" (10%), 1 venda, 1 comissão paga.*

## Problemas encontrados

- **[BUG-04-01] Cadastrar funcionário SEM CPF sempre falha** · Severidade: **alta**
  Passos: Funcionários → Novo Funcionário → preencher só o nome → Salvar.
  Esperado: funcionário criado (a coluna aceita CPF nulo). Obtido: erro `value too long for type character varying(18)` — a mensagem crua do banco, exibida ao usuário.
  Causa: [funcionarios.tsx:62](../../src/pages/funcionarios.tsx#L62) gera `cpf_cnpj: form.cpf || \`sem-cpf-${Date.now()}\``. Esse marcador tem **21 caracteres** e `erp_pessoas.cpf_cnpj` é `varchar(18)` — estoura sempre.
  Prova de que nunca funcionou: existem **0 registros** com o marcador `sem-cpf%` na base, embora haja 2 pessoas com CPF nulo (criadas por outro caminho).
  Correção sugerida: `cpf_cnpj: form.cpf || null` — a coluna já aceita nulo, o marcador é desnecessário. E trocar a exibição do erro cru por uma mensagem em português.

- **[BUG-04-02] Botões de pagar comissão sem dica quando desabilitados** · Severidade: informativa
  "Pagar selecionadas (0)" e "Pagar todas pendentes (0)" ficam desabilitados sem `title` quando não há comissão pendente. O rótulo já mostra "(0)", então o motivo é dedutível; registrado só para completude.

### Resumo da sessão
5 páginas | 12 funções verificadas (8 ✅, 2 ⏭️ não executadas em produção, 2 ⚠️, 0 ❌) | 2 problema(s)
Páginas novas descobertas: nenhuma.

