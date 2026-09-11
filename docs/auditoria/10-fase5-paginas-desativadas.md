# Fase 5 — Páginas desativadas por flag

Data: 10/09/2026 · Ambiente: **produção** · Conta: `demo.admin@lojaxlife.com.br`

As 38 páginas desligadas foram separadas por **motivo**, e só as que podem realmente funcionar foram auditadas. Para auditar, o conjunto de telas foi ligado temporariamente e depois **restaurado ao padrão "Loja de suplementos"** — confirmado: 42 ativas de 80, como antes.

## Grupo 1 — Dependem de contratação externa (não auditáveis)

Não é possível testar: falta o serviço, não o código. Em vez de mostrarem a tela vazia como se funcionassem, agora exibem um **aviso explicando o que falta, como ativar e o que resolve a mesma necessidade hoje**.

| Página | O que falta | Alternativa oferecida |
|---|---|---|
| Boletos | Convênio bancário de cobrança registrada — é o banco que gera a linha digitável e avisa o pagamento | Promissórias, Crediário Próprio |
| Torpedos SMS | Gateway de SMS, cobrado por mensagem | E-mail Marketing; WhatsApp da loja já conectado |
| Mala Direta | Só a parte **impressa** (gráfica/Correios); o envio por e-mail já funciona | E-mail Marketing (Resend, ~3.000 e-mails/mês no plano gratuito) |
| TEF / SITEF | CliSiTef no caixa e contrato com a Software Express | — (já explicado no próprio formulário) |
| Pedidos iFood, ExApp, iFood Marketplace | Integração não contratada | — (removidos a pedido do cliente) |

## Grupo 2 e 3 — Removidos

- **Duplicatas de tela**: Dinheiro, Cartão de Crédito e Cartão de Débito apenas filtravam vendas por forma de pagamento — o mesmo que **Relatórios Financeiros › Formas** já mostra. Recebimento Cheque era apelido de Consulta de Cheques. As quatro saíram do menu (código preservado, rotas comentadas).
- **Órfãs**: `/pedidos` e `/gestao/cadastro-produtos` seguem marcadas para remoção.

## Grupo 4 — Funcionalidades reais, auditadas


### Controle Comercial

| Página | Rota | O que respondeu | Status |
|---|---|---|---|
| Pedido / Pré-venda | `/controle-comercial/pedido` | **Nova Pré-venda** → abre "Nova Pré-venda" · campos: Cliente *, Observações / itens desejados | ✅ |
| Orçamento | `/controle-comercial/orcamento` | **Novo Orçamento** → abre "Novo Orçamento" · campos: Cliente, Validade, Itens * | ✅ |
| Ordem de Serviço | `/controle-comercial/os` | **Nova OS** → abre "Nova Ordem de Serviço" · campos: Cliente, Descrição do serviço *, Equipamento, Previsão, D | ✅ |
| Venda Consignada | `/controle-comercial/consignacao` | **Nova Consignação** → abre "Nova Consignação" · campos: Cliente *, Data prevista do acerto, Produtos consigna | ✅ |
| Locação | `/controle-comercial/locacao` | **Nova Locação** → abre "Nova Locação" · campos: Cliente *, Item locado *, Início *, Devolução prevista, Valor | ✅ |

### Cobrança e análise de crédito

| Página | Rota | O que respondeu | Status |
|---|---|---|---|
| Crediário (com juros) | `/gestao/gerar-crediario` | **Novo contrato** → abre "Novo contrato de crediário" · campos: Venda, Parcelas, Juros ao mês (%), Tipo de jur; **Contratos** → muda o conteúdo na própria tela; **Clientes e limites** → muda o conteúdo na própria tela | ✅ |
| Cheques | `/gestao/consulta-cheque` | **Novo Cheque** → abre "Novo Cheque" · campos: Tipo, Nº do Cheque *, Banco *, Agência, Conta, Valor *, Emissão | ✅ |
| Parcelar Débitos | `/gestao/parcelar-debitos` | **Novo Parcelamento** → abre "Novo Parcelamento" · campos: Cliente *, Dívida Original, Entrada, Valor Total c/ | ✅ |
| Negativar Devedores | `/gestao/negativar-devedores` | **Nova Negativação** → abre "Negativar Cliente" · campos: Cliente *, Valor Total, Data, Motivo | ✅ |
| Encaminhar Protesto | `/gestao/encaminhar-protesto` | **Novo Protesto** → abre "Novo Protesto" · campos: Cliente *, Tipo Título, Valor *, Cartório, Nº Protocolo, Cu | ✅ |
| Solicitação de Parceria | `/gestao/solicitacao-parceria` | **Enviar Solicitação** → desabilitado (sem dica visível) | ⚠️ |
| Consulta Pessoa Física | `/gestao/consulta-pessoa-fisica` | **Novo PF** → abre "Nova Pessoa Física" · campos: Nome *, CPF, Email, Telefone, Data Nasc., Estado Civil, Sexo | ✅ |
| Consulta Pessoa Jurídica | `/gestao/consulta-pessoa-juridica` | **Novo PJ** → abre "Nova Pessoa Jurídica" · campos: Razão Social *, Nome Fantasia, CNPJ, Email, Telefone, Celu | ✅ |

### Cadastros de apoio e agenda

| Página | Rota | O que respondeu | Status |
|---|---|---|---|
| Agenda de Compromissos | `/gestao/agenda-compromissos` | **Adicionar** → desabilitado (sem dica visível) | ⚠️ |
| Agenda Telefônica | `/gestao/agenda-telefonica` | **Novo Contato** → abre "Novo Contato" · campos: Nome *, Empresa, Cargo, Categoria, Email, Telefone, Celular,  | ✅ |
| Documentos | `/gestao/documentos` | **Novo Documento** → abre "Novo Documento" · campos: Nome *, Descrição, Tipo, Extensão, Data, Tags (separadas  | ✅ |
| Arquivos e Pastas | `/gestao/arquivos-pastas` | **Novo Documento** → abre "Novo Documento" · campos: Nome *, Descrição, Tipo, Extensão, Data, Tags (separadas  | ✅ |
| Transportadoras | `/gestao/transportadoras` | **Nova Transportadora** → abre "Nova Transportadora" · campos: Nome *, CNPJ, Prazo (dias), Valor Fixo, R$/Kg | ❌ |
| Regiões de Entrega | `/gestao/regioes-entrega` | **Nova Região** → abre "Nova Região de Entrega" · campos: Nome *, CEP Início, CEP Fim, Bairros (separados por  | ❌ |
| Serviços | `/gestao/servicos` | **Novo Serviço** → abre "Novo Serviço" · campos: Nome *, Descrição, Valor (R$) *, Comissão (%) | ✅ |
| Localizar Pessoas | `/gestao/localizar-pessoas` | abre e renderiza; sem ações no estado inicial | ✅ |

### Atendimento, contador e etiquetas

| Página | Rota | O que respondeu | Status |
|---|---|---|---|
| Avaliações | `/gestao/avaliacoes` | abre e renderiza; sem ações no estado inicial | ✅ |
| Ocorrências | `/gestao/ocorrencias` | **Nova** → abre "Nova Ocorrência" · campos: Título *, Tipo, Prioridade, Descrição * | ✅ |
| Recomendações | `/gestao/recomendacoes` | abre e renderiza; sem ações no estado inicial | ✅ |
| Painel do Contador | `/gestao/painel-contador` | **Gerar** → muda o conteúdo na própria tela; **Importar OFX** → muda o conteúdo na própria tela | ✅ |
| Documentos Demonstrativos | `/gestao/documentos-demonstrativos` | **DRE** → muda o conteúdo na própria tela; **Balancete** → muda o conteúdo na própria tela; **Plano de Contas** → muda o conteúdo na própria tela | ✅ |
| Gerar Código de Barras | `/gestao/codigo-barras` | **Agua Mineral 500ml BEB002** → muda o conteúdo na própria tela; **Arroz Tipo 1 5kg MER001** → muda o conteúdo na própria tela; **Banana Prata (kg) HOR001** → muda o conteúdo na própria tela | ✅ |

## Problema encontrado

- **[BUG-F5-01] Transportadoras e Regiões de Entrega nunca listam nada** · Severidade: **média** (as telas estão desligadas hoje)
  Passos: ativar a flag e abrir `/gestao/transportadoras` ou `/gestao/regioes-entrega`.
  Esperado: a lista de cadastros. Obtido: lista vazia, com `400` na rede — `column erp_transportadoras.loja_id does not exist`.
  Causa: `useTransportadoras` e `useRegioesEntrega` aplicam `.eq('loja_id', lojaId)`, mas **nenhuma das duas tabelas tem essa coluna** — são cadastros globais (a mesma transportadora atende as duas lojas). É o mesmo padrão do BUG-01: a consulta é rejeitada inteira e a tela mostra "sem registros" em vez de erro.
  Agravante: `erp_transportadoras` também não tem coluna `nome` (o cadastro fica em `pessoa_id`), então o `.order('nome')` falharia mesmo sem o filtro de loja.
  Por que passou despercebido: as duas tabelas estão **vazias** (0 registros) e as telas, desligadas — ninguém chegou a usar.
  Correção sugerida: remover o filtro por loja nos dois hooks e ordenar `erp_transportadoras` por um campo existente (ou trazer o nome via `pessoa_id`).

### Observações menores
- **Solicitação de Parceria**: "Enviar Solicitação" nasce desabilitado. Verificado: é validação — ao preencher empresa e contato, **habilita**. Correto, apenas sem dica explicando.
- **Agenda de Compromissos**: "Adicionar" desabilitado sem dica, mesmo padrão.


### Resumo da Fase 5
27 páginas do grupo 4 auditadas | 48 funções verificadas (46 ✅, 2 ⚠️) | **1 problema (médio)**
Menu restaurado ao padrão "Loja de suplementos": 42 páginas ativas de 80.

