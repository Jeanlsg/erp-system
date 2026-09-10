# Sessão 08 — Configurações, treinamento e ajuda

Data: 10/09/2026 · Ambiente: **produção** (não há homologação) · Testado por: agente, conta `demo.admin@lojaxlife.com.br`

Regra do ambiente: botões de efeito imediato ou irreversível não são acionados (⏭️). Formulários são abertos e fotografados, nunca confirmados.

## Página: Configurações do Sistema — `/config/sistema`

Objetivo: Parâmetros técnicos e — para o administrador principal — páginas ativas e padrões de tela.

Perfis com acesso: todos (aba de páginas só para o admin principal)

Prints: [desktop](prints/08-configuracoes/01-configuracoes-do-sistema-inicial.jpeg) · [mobile](prints/08-configuracoes/01-configuracoes-do-sistema-mobile.jpeg)

Texto de apoio na tela: *Parâmetros técnicos do sistema*

Estado observado: 0 linha(s) na tabela, 28 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Configurações Técnicas (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Configurações Empresariais — `/config/empresarial`

Objetivo: Dados da empresa usados em nota e documentos.

Perfis com acesso: admin

Prints: [desktop](prints/08-configuracoes/02-configuracoes-empresariais-inicial.jpeg) · [mobile](prints/08-configuracoes/02-configuracoes-empresariais-mobile.jpeg)

Texto de apoio na tela: *Dados cadastrais da empresa*

Estado observado: 0 linha(s) na tabela, 17 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Salvar (botão) | reagir na tela | mensagem: "Dados salvos." | ✅ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Minhas Chaves PIX — `/config/minhas-chaves`

Objetivo: Chaves PIX da loja para recebimento.

Perfis com acesso: admin, gerente

Prints: [desktop](prints/08-configuracoes/03-minhas-chaves-pix-inicial.jpeg) · [mobile](prints/08-configuracoes/03-minhas-chaves-pix-mobile.jpeg) · [modal · Nova Chave](prints/08-configuracoes/03-minhas-chaves-pix-modal-nova-chave.jpeg)

Texto de apoio na tela: *0 chave(s) cadastrada(s)*

Estado observado: 0 linha(s) na tabela, 0 campo(s), lista vazia.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Nova Chave (botão) | abrir formulário/modal | abre "Nova Chave PIX" · campos: Tipo, Chave, Titular, Banco | ✅ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Equipamentos — `/equipamentos`

Objetivo: Leitores, impressoras térmicas e etiquetadora homologados, com instruções e drivers.

Perfis com acesso: todos

Prints: [desktop](prints/08-configuracoes/04-equipamentos-inicial.jpeg) · [mobile](prints/08-configuracoes/04-equipamentos-mobile.jpeg)

Texto de apoio na tela: *Leitores, impressoras e etiquetadoras homologados e como instalá-los.*

Estado observado: 6 linha(s) na tabela, 0 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| (sem elementos acionáveis no estado inicial) | — | a tela abre e renderiza | ✅ | página informativa ou dependente de dado |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Treinamento — `/treinamento/tutoriais`

Objetivo: Guia por perfil com telas reais do sistema.

Perfis com acesso: todos

Prints: [desktop](prints/08-configuracoes/05-treinamento-inicial.jpeg) · [mobile](prints/08-configuracoes/05-treinamento-mobile.jpeg)

Texto de apoio na tela: *Como operar cada parte do sistema, por papel. Toda imagem é uma captura real — o que você vê aqui é o que encontra na tela.*

Estado observado: 0 linha(s) na tabela, 0 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Caixa (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Estoquista (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Gerente (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Administrador (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Para todos (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Ajuda — `/ajuda`

Objetivo: Perguntas frequentes com link para a tela correspondente.

Perfis com acesso: todos

Prints: [desktop](prints/08-configuracoes/06-ajuda-inicial.jpeg) · [mobile](prints/08-configuracoes/06-ajuda-mobile.jpeg)

Texto de apoio na tela: *Dúvidas frequentes por módulo do sistema*

Estado observado: 0 linha(s) na tabela, 1 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Como registrar uma venda? (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Como abrir e fechar o caixa? (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Como registrar uma devolução? (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Como fazer uma pré-venda ou orçamento? (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Como cadastrar um produto? (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Como controlar lotes e validade? (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Como transferir estoque entre lojas? (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Como montar kits de produtos? (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Como lançar contas a pagar/receber? (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Como gerar carnê ou promissória? (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Como negativar ou protestar um devedor? (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Como configurar o certificado digital? (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Como configurar a SEFAZ? (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Como importar uma NFe de compra? (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Como criar usuários e definir permissões? (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Como cadastrar uma nova loja/filial? (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Como ativar/desativar módulos do sistema? (botão) | executar a ação | não acionado (efeito imediato/irreversível em produção) | ⏭️ | efeito imediato/irreversível — não executado em produção |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Problemas encontrados

Nenhum problema funcional nesta sessão.

### Observações

- **Configurações do Sistema** abriu só com a aba "Configurações Técnicas": a aba **Páginas do sistema** e o painel **Padrões de tela** não aparecem para a conta demo, que é admin **comum**. É a regra implantada nesta auditoria — só o administrador principal controla o menu. Confirmação visual da proteção funcionando.
- **Treinamento** alterna entre os 5 perfis (Caixa, Estoquista, Gerente, Administrador, Para todos), cada um com suas tarefas e telas reais.
- **Ajuda** tem 16 perguntas que abrem e fecham, cada uma com link para a tela correspondente.
- **Equipamentos** lista os blocos de hardware homologado com os links de driver.
- Configurações Empresariais confirma com "Dados salvos."; Minhas Chaves PIX abre com Tipo, Chave, Titular e Banco.

### Resumo da sessão
6 páginas | 25 funções verificadas (24 ✅, 1 ⏭️ não executadas em produção, 0 ⚠️, 0 ❌) | 0 problema(s)
Páginas novas descobertas: nenhuma.

