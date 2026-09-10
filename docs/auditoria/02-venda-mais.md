# Sessão 02 — Venda Mais (recompra e prazo)

Data: 10/09/2026 · Ambiente: **produção** (não há homologação) · Testado por: agente, conta `demo.admin@lojaxlife.com.br`

Regra do ambiente: botões de efeito imediato ou irreversível não são acionados (⏭️). Formulários são abertos e fotografados, nunca confirmados.

## Página: E-mail Marketing — `/email-marketing`

Objetivo: Criar campanhas de e-mail e disparar para os cadastros ativos, pelo Resend.

Perfis com acesso: admin, gerente

Prints: [desktop](docs/auditoria/prints/02-venda-mais/01-e-mail-marketing-inicial.jpeg) · [mobile](docs/auditoria/prints/02-venda-mais/01-e-mail-marketing-mobile.jpeg) · [modal · Nova Campanha](docs/auditoria/prints/02-venda-mais/01-e-mail-marketing-modal-nova-campanha.jpeg)

Texto de apoio na tela: *0 campanha(s) · 10 cadastro(s) com e-mail válido*

Estado observado: 0 linha(s) na tabela, 0 campo(s), lista vazia.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Nova Campanha (botão) | abrir formulário/modal | abre "Nova Campanha de E-mail" · campos: Nome da campanha (interno), Assunto do e-mail, Corpo do e-mail | ✅ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Cartão Fidelidade — `/cartao-fidelidade`

Objetivo: Cartão de pontos: acúmulo automático na venda e resgate como desconto.

Perfis com acesso: admin, gerente, caixa

Prints: [desktop](docs/auditoria/prints/02-venda-mais/02-cartao-fidelidade-inicial.jpeg) · [mobile](docs/auditoria/prints/02-venda-mais/02-cartao-fidelidade-mobile.jpeg) · [modal · Emitir cartão](docs/auditoria/prints/02-venda-mais/02-cartao-fidelidade-modal-emitir-cartao.jpeg)

Texto de apoio na tela: *1 ponto por real gasto · cada ponto vale R$ 0,05 no resgate. Ajustável em Configurações do sistema.*

Estado observado: 0 linha(s) na tabela, 0 campo(s), lista vazia.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Emitir cartão (botão) | abrir formulário/modal | abre "Emitir cartão fidelidade" · campos: Cliente | ✅ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Crediário Próprio — `/crediario-proprio`

Objetivo: Venda a prazo da própria loja: parcelas com juros, limite por cliente e baixa integrada ao financeiro.

Perfis com acesso: admin, gerente

Prints: [desktop](docs/auditoria/prints/02-venda-mais/03-crediario-proprio-inicial.jpeg) · [mobile](docs/auditoria/prints/02-venda-mais/03-crediario-proprio-mobile.jpeg) · [modal · Novo contrato](docs/auditoria/prints/02-venda-mais/03-crediario-proprio-modal-novo-contrato.jpeg)

Texto de apoio na tela: *Cada parcela é também uma conta a receber — baixar aqui baixa no financeiro.*

Estado observado: 0 linha(s) na tabela, 0 campo(s), lista vazia.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Novo contrato (botão) | abrir formulário/modal | abre "Novo contrato de crediário" · campos: Venda, Parcelas, Juros ao mês (%), Tipo de juros, Entrada (opcional) | ✅ |  |
| Contratos (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Clientes e limites (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Promissórias — `/promissoria`

Objetivo: Emitir e imprimir nota promissória com valor por extenso, e dar baixa quando paga.

Perfis com acesso: admin, gerente

Prints: [desktop](docs/auditoria/prints/02-venda-mais/04-promissorias-inicial.jpeg) · [mobile](docs/auditoria/prints/02-venda-mais/04-promissorias-mobile.jpeg) · [modal · Emitir Promissória](docs/auditoria/prints/02-venda-mais/04-promissorias-modal-emitir-promissoria.jpeg)

Texto de apoio na tela: *0 promissória(s)*

Estado observado: 0 linha(s) na tabela, 0 campo(s), lista vazia.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Emitir Promissória (botão) | abrir formulário/modal | abre "Emitir Nota Promissória" · campos: Cliente (devedor), Valor (R$), Vencimento, Observações (opcional) | ✅ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Problemas encontrados

Nenhum problema funcional nesta sessão: todos os elementos responderam como esperado.

### Resumo da sessão
4 páginas | 6 funções verificadas (6 ✅, 0 ⏭️ não executadas em produção, 0 ⚠️, 0 ❌) | 0 problema(s)
Páginas novas descobertas: nenhuma.

