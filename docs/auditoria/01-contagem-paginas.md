# Auditoria — 01. Contagem de páginas

Data: 10/09/2026 · Ambiente: **produção** (erp.lojaxlife.com.br — não existe homologação) · Conta: `demo.admin@lojaxlife.com.br` (admin temporária, criada em 10/09/2026 10:37)

## 1. Número total de páginas

**Total: 89 páginas** | Ativas: 46 | Ocultas/órfãs: 2 | Inativas/quebradas: 0 | Só no código: 5 | Atrás de flag/permissão: 36

Regra aplicada: 1 página = 1 tela com rota própria; rotas-apelido para a mesma tela contam uma vez; `?aba=`, modais e abas são estados; login/setup/404 entram em "Acesso e sistema".

## 2. Contagem por fonte

| Fonte | Encontrado | Observação |
|---|---|---|
| Código (`src/App.tsx`) | 108 rotas ativas + 8 comentadas → **89 telas únicas** | 20 rotas são apelidos da mesma tela (ex.: `/produtos`, `/estoque`, `/lotes` → Cadastro e Estoque); `FaturamentoPage` só embrulha Notas Fiscais |
| Navegação (conta demo, 108 URLs abertas) | 108 abriram; menu lateral lista 45 entradas (42 páginas únicas) | 0 URL(s) apareceram só por link interno; rodada final não trouxe rota nova |
| Fontes auxiliares (tabela `erp_feature_flags`) | 84 flags (42 ativas), 84 com rota correspondente | flag desligada esconde do menu e bloqueia não-admin; admin vê com faixa "Página desativada" |
| Por perfil (`ROLE_PERMISSIONS` + `perm` do menu) | admin 33 permissões · gerente 26 · estoquista 11 · caixa 7 | 31 itens de menu exigem permissão; os demais abrem para todos |

Diferenças: o código tem mais rotas que telas porque mantém apelidos do sistema antigo; o menu mostra menos que o código porque 42 flags estão desligadas (decisão de simplificação para loja de suplementos) e 6 rotas estão comentadas (sem provedor contratado).

## 3. Inventário completo

| # | Página | Rota | Sessão/Módulo | Tipo | Perfis com acesso | Status | Encontrada via |
|---|---|---|---|---|---|---|---|
| 1 | Dashboard | `/` | Início | lista | todos | ativa | menu |
| 2 | Dashboard | `/` | Início | relatório | todos | ativa | menu |
| 3 | Visão Geral | `/visao-geral` | Início | relatório | admin, gerente, estoquista | ativa | menu |
| 4 | Caixa | `/caixa` | Vendas e Pedidos | formulário | admin, gerente, caixa | ativa | menu |
| 5 | Devoluções | `/devolucoes` | Vendas e Pedidos | formulário | admin, gerente, caixa | ativa | menu |
| 6 | Notas Fiscais | `/notas-fiscais` | Vendas e Pedidos | lista | admin, gerente | ativa | menu |
| 7 | PDV | `/pdv` | Vendas e Pedidos | formulário | admin, gerente, caixa | ativa | menu |
| 8 | Pedidos Delivery | `/pedidos-delivery` | Vendas e Pedidos | lista | admin, gerente, caixa | ativa | menu |
| 9 | Vendas | `/vendas` | Vendas e Pedidos | lista | admin, gerente, caixa | ativa | menu |
| 10 | Boletos | `/gerador-boletos` | Vendas e Pedidos | formulário | todos | só no código | código (rota comentada) |
| 11 | ExApp Pedidos | `/exapp-pedidos` | Vendas e Pedidos | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 12 | Mala Direta | `/mala-direta` | Vendas e Pedidos | formulário | todos | só no código | código (rota comentada) |
| 13 | Pedidos iFood | `/ifood` | Vendas e Pedidos | lista | admin, gerente, caixa | só no código | código (rota comentada) |
| 14 | TEF / SITEF | `/tef-sitef` | Vendas e Pedidos | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 15 | Torpedos SMS | `/torpedos` | Vendas e Pedidos | formulário | todos | só no código | código (rota comentada) |
| 16 | Locação | `/controle-comercial/locacao` | Vendas e Pedidos › Controle Comercial | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 17 | Ordem de Serviço | `/controle-comercial/os` | Vendas e Pedidos › Controle Comercial | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 18 | Orçamento | `/controle-comercial/orcamento` | Vendas e Pedidos › Controle Comercial | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 19 | Pedido / Pré-venda | `/controle-comercial/pedido` | Vendas e Pedidos › Controle Comercial | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 20 | Venda Consignada | `/controle-comercial/consignacao` | Vendas e Pedidos › Controle Comercial | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 21 | Cartão Fidelidade | `/cartao-fidelidade` | Vendas e Pedidos › Venda Mais | lista | todos | ativa | menu |
| 22 | Crediário Próprio | `/crediario-proprio` (apelidos: `/gestao/gerar-crediario-proprio`) | Vendas e Pedidos › Venda Mais | formulário | todos | ativa | menu |
| 23 | E-mail Marketing | `/email-marketing` | Vendas e Pedidos › Venda Mais | formulário | todos | ativa | menu |
| 24 | Promissórias | `/promissoria` (apelidos: `/gestao/gerar-promissoria`) | Vendas e Pedidos › Venda Mais | formulário | todos | ativa | menu |
| 25 | Usuários e Permissões | `/gestao/usuarios` (apelidos: `/gestao/administrar-usuarios`, `/gestao/usuario-permissoes`) | Gestão | config | admin | ativa | menu |
| 26 | Visão Geral | `/gestao` | Gestão | lista | todos | ativa | menu |
| 27 | Cadastro de Produtos | `/gestao/cadastro-produtos` | Gestão | lista | todos | oculta/órfã | código (URL direta) |
| 28 | Pedidos | `/pedidos` | Gestão | lista | todos | oculta/órfã | código (URL direta) |
| 29 | Cheques | `/gestao/consulta-cheque` | Gestão › Análise de Crédito | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 30 | Pessoa Física | `/gestao/consulta-pessoa-fisica` | Gestão › Análise de Crédito | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 31 | Pessoa Jurídica | `/gestao/consulta-pessoa-juridica` | Gestão › Análise de Crédito | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 32 | Exclusão LGPD | `/gestao/exclusao-informacoes` | Gestão › Atendimento | formulário | todos | ativa | menu |
| 33 | Notificações | `/gestao/notificacoes` | Gestão › Atendimento | informativa | todos | ativa | menu |
| 34 | Avaliações | `/gestao/avaliacoes` | Gestão › Atendimento | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 35 | Ocorrências | `/gestao/ocorrencias` | Gestão › Atendimento | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 36 | Análise Gerencial | `/relatorios/analise` | Gestão › Financeiro | relatório | admin, gerente, estoquista | ativa | menu |
| 37 | Relatórios | `/relatorios` | Gestão › Financeiro | relatório | todos | ativa | menu |
| 38 | Relatórios Financeiros | `/financeiro` (apelidos: `/financeiro/relatorios`, `/gestao/relatorios-financeiros`) | Gestão › Financeiro | relatório | admin, gerente | ativa | menu |
| 39 | Certificado Digital | `/gestao/nfe-certificado` | Gestão › Fiscal | config | admin, gerente | ativa | menu |
| 40 | Configurações SEFAZ | `/gestao/configuracoes-sefaz` | Gestão › Fiscal | config | admin, gerente | ativa | menu |
| 41 | Escrituração (SPED) | `/fiscal/escrituracao` | Gestão › Fiscal | lista | admin, gerente | ativa | menu |
| 42 | Notas Recebidas (SEFAZ) | `/fiscal/notas-recebidas` | Gestão › Fiscal | lista | admin, gerente, estoquista | ativa | menu |
| 43 | Remessas entre Filiais | `/remessas` (apelidos: `/gestao/remessas`, `/gestao/transferencia-estoque`, `/estoque.transferencia`) | Gestão › Fiscal | formulário | admin, gerente | ativa | menu |
| 44 | Documentos Demonstrativos | `/gestao/documentos-demonstrativos` | Gestão › Fiscal | relatório | admin (preview) | atrás de flag/permissão | flags (banco) |
| 45 | Encaminhar Protesto | `/gestao/encaminhar-protesto` | Gestão › Gestão Cobrança | formulário | admin (preview) | atrás de flag/permissão | flags (banco) |
| 46 | Localizar Pessoas | `/gestao/localizar-pessoas` | Gestão › Gestão Cobrança | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 47 | Negativar Devedores | `/gestao/negativar-devedores` | Gestão › Gestão Cobrança | formulário | admin (preview) | atrás de flag/permissão | flags (banco) |
| 48 | Parcelar Débitos | `/gestao/parcelar-debitos` | Gestão › Gestão Cobrança | formulário | admin (preview) | atrás de flag/permissão | flags (banco) |
| 49 | Recomendações | `/gestao/recomendacoes` | Gestão › Gestão Cobrança | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 50 | Solicitação de Parceria | `/gestao/solicitacao-parceria` | Gestão › Gestão Cobrança | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 51 | Cadastro e Estoque | `/produtos-estoque-lotes` (apelidos: `/lotes`, `/gestao/lotes`, `/produtos`, `/estoque`, `/gestao/estoque`) | Gestão › Gestão Empresarial | lista | admin, gerente, caixa, estoquista | ativa | menu |
| 52 | Clientes | `/gestao/clientes` | Gestão › Gestão Empresarial | lista | admin, gerente | ativa | menu |
| 53 | Comissões | `/gestao/comissoes` | Gestão › Gestão Empresarial | relatório | admin | ativa | menu |
| 54 | Compras | `/compras` | Gestão › Gestão Empresarial | lista | admin, gerente, estoquista | ativa | menu |
| 55 | Fornecedores | `/gestao/fornecedores` (apelidos: `/fornecedores`) | Gestão › Gestão Empresarial | lista | admin, gerente, estoquista | ativa | menu |
| 56 | Funcionários | `/gestao/funcionarios` (apelidos: `/funcionarios`) | Gestão › Gestão Empresarial | lista | admin | ativa | menu |
| 57 | Importar NFe | `/compras/importar-nfe` (apelidos: `/gestao/compras/importar-nfe`) | Gestão › Gestão Empresarial | formulário | admin, gerente, estoquista | ativa | menu |
| 58 | Inventário / Balanço | `/estoque/inventario` | Gestão › Gestão Empresarial | formulário | admin, gerente, estoquista | ativa | menu |
| 59 | Kits & Combos | `/kits` | Gestão › Gestão Empresarial | lista | admin, gerente, caixa, estoquista | ativa | menu |
| 60 | Lojas | `/lojas` | Gestão › Gestão Empresarial | config | admin, gerente, estoquista | ativa | menu |
| 61 | Movimentações (Kardex) | `/estoque/movimentacoes` | Gestão › Gestão Empresarial | lista | admin, gerente, caixa, estoquista | ativa | menu |
| 62 | Agenda Compromissos | `/gestao/agenda-compromissos` | Gestão › Gestão Empresarial | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 63 | Agenda Telefônica | `/gestao/agenda-telefonica` | Gestão › Gestão Empresarial | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 64 | Arquivos e Pastas | `/gestao/arquivos-pastas` (apelidos: `/gestao/pasta-principal`) | Gestão › Gestão Empresarial | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 65 | Documentos | `/gestao/documentos` | Gestão › Gestão Empresarial | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 66 | Email Inteligente | `/gestao/email-inteligente` | Gestão › Gestão Empresarial | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 67 | Regiões de Entrega | `/gestao/regioes-entrega` | Gestão › Gestão Empresarial | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 68 | Serviços | `/gestao/servicos` | Gestão › Gestão Empresarial | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 69 | Transportadoras | `/gestao/transportadoras` | Gestão › Gestão Empresarial | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 70 | Cartão de Crédito | `/gestao/cartao-credito` | Gestão › Gestão Recebimentos | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 71 | Cartão de Débito | `/gestao/cartao-debito` | Gestão › Gestão Recebimentos | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 72 | Crediário (com juros) | `/gestao/gerar-crediario` | Gestão › Gestão Recebimentos | formulário | admin (preview) | atrás de flag/permissão | flags (banco) |
| 73 | Dinheiro | `/gestao/dinheiro` | Gestão › Gestão Recebimentos | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 74 | Recebimento Cheque | `/gestao/recebimento-cheque` | Gestão › Gestão Recebimentos | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 75 | Configurações Empresariais | `/config/empresarial` | Configurações | config | admin | ativa | menu |
| 76 | Configurações do Sistema | `/config/sistema` | Configurações | config | admin, gerente | ativa | menu |
| 77 | Equipamentos | `/equipamentos` | Configurações | informativa | todos | ativa | menu |
| 78 | Minhas Chaves PIX | `/config/minhas-chaves` (apelidos: `/gestao/minhas-chaves`) | Configurações | config | todos | ativa | menu |
| 79 | Configurações Gerais | `/gestao/configuracoes-gerais` | Configurações | config | admin (preview) | atrás de flag/permissão | flags (banco) |
| 80 | Dados Empresariais | `/gestao/dados-empresariais` | Configurações | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 81 | Downloads | `/gestao/downloads` | Configurações | informativa | todos | só no código | código (rota comentada) |
| 82 | Gerar Código de Barras | `/gestao/codigo-barras` | Configurações | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 83 | Painel do Contador | `/gestao/painel-contador` | Configurações | lista | admin (preview) | atrás de flag/permissão | flags (banco) |
| 84 | Ajuda | `/ajuda` | Configurações › Treinamento Sistema | informativa | todos | ativa | menu |
| 85 | Treinamento | `/treinamento/tutoriais` | Configurações › Treinamento Sistema | informativa | todos | ativa | menu |
| 86 | Configuração inicial | `/setup` | Acesso e sistema | sistema | admin | ativa | código |
| 87 | Login | `/login` | Acesso e sistema | sistema | todos (deslogado) | ativa | código |
| 88 | Página não encontrada (404) | `/*` | Acesso e sistema | sistema | todos | ativa | código |
| 89 | Redefinir senha | `/auth/redefinir-senha` | Acesso e sistema | sistema | todos (deslogado) | ativa | código |

## 4. Total por sessão/módulo

| Sessão/Módulo | Páginas | Ativas | Atrás de flag | Só no código | Outras |
|---|---|---|---|---|---|
| Início | 3 | 3 | 0 | 0 | 0 |
| Vendas e Pedidos | 12 | 6 | 2 | 4 | 0 |
| Vendas e Pedidos › Controle Comercial | 5 | 0 | 5 | 0 | 0 |
| Vendas e Pedidos › Venda Mais | 4 | 4 | 0 | 0 | 0 |
| Gestão | 4 | 2 | 0 | 0 | 2 |
| Gestão › Análise de Crédito | 3 | 0 | 3 | 0 | 0 |
| Gestão › Atendimento | 4 | 2 | 2 | 0 | 0 |
| Gestão › Financeiro | 3 | 3 | 0 | 0 | 0 |
| Gestão › Fiscal | 6 | 5 | 1 | 0 | 0 |
| Gestão › Gestão Cobrança | 6 | 0 | 6 | 0 | 0 |
| Gestão › Gestão Empresarial | 19 | 11 | 8 | 0 | 0 |
| Gestão › Gestão Recebimentos | 5 | 0 | 5 | 0 | 0 |
| Configurações | 9 | 4 | 4 | 1 | 0 |
| Configurações › Treinamento Sistema | 2 | 2 | 0 | 0 | 0 |
| Acesso e sistema | 4 | 4 | 0 | 0 | 0 |

## 5. Estados registrados (não entram na contagem)

Levantados pelo código (`<Dialog>` = modal, `<TabsTrigger>` = aba) e pela navegação (abas visíveis). Estados que exigem interação (validação, lista vazia, erro) serão registrados na Fase 2.

| Página | Modais no código | Abas | Abas visíveis na navegação |
|---|---|---|---|
| Caixa (`/caixa`) | 2 | 0 | — |
| Notas Fiscais (`/notas-fiscais`) | 4 | 0 | — |
| PDV (`/pdv`) | 7 | 0 | — |
| Locação (`/controle-comercial/locacao`) | 5 | 0 | — |
| Ordem de Serviço (`/controle-comercial/os`) | 5 | 0 | — |
| Orçamento (`/controle-comercial/orcamento`) | 5 | 0 | — |
| Pedido / Pré-venda (`/controle-comercial/pedido`) | 5 | 0 | — |
| Venda Consignada (`/controle-comercial/consignacao`) | 5 | 0 | — |
| Cartão Fidelidade (`/cartao-fidelidade`) | 2 | 0 | — |
| Crediário Próprio (`/crediario-proprio`) | 1 | 2 | — |
| E-mail Marketing (`/email-marketing`) | 1 | 0 | — |
| Promissórias (`/promissoria`) | 1 | 0 | — |
| Usuários e Permissões (`/gestao/usuarios`) | 2 | 0 | — |
| Cadastro de Produtos (`/gestao/cadastro-produtos`) | 4 | 3 | — |
| Cheques (`/gestao/consulta-cheque`) | 5 | 0 | — |
| Pessoa Física (`/gestao/consulta-pessoa-fisica`) | 4 | 3 | — |
| Pessoa Jurídica (`/gestao/consulta-pessoa-juridica`) | 4 | 3 | — |
| Exclusão LGPD (`/gestao/exclusao-informacoes`) | 4 | 3 | — |
| Notificações (`/gestao/notificacoes`) | 1 | 0 | — |
| Avaliações (`/gestao/avaliacoes`) | 1 | 0 | — |
| Ocorrências (`/gestao/ocorrencias`) | 1 | 0 | — |
| Análise Gerencial (`/relatorios/analise`) | 0 | 4 | — |
| Relatórios Financeiros (`/financeiro`) | 3 | 10 | — |
| Certificado Digital (`/gestao/nfe-certificado`) | 1 | 0 | — |
| Configurações SEFAZ (`/gestao/configuracoes-sefaz`) | 1 | 0 | — |
| Notas Recebidas (SEFAZ) (`/fiscal/notas-recebidas`) | 1 | 0 | — |
| Remessas entre Filiais (`/remessas`) | 1 | 0 | — |
| Documentos Demonstrativos (`/gestao/documentos-demonstrativos`) | 4 | 3 | — |
| Encaminhar Protesto (`/gestao/encaminhar-protesto`) | 5 | 0 | — |
| Localizar Pessoas (`/gestao/localizar-pessoas`) | 4 | 3 | — |
| Negativar Devedores (`/gestao/negativar-devedores`) | 5 | 0 | — |
| Parcelar Débitos (`/gestao/parcelar-debitos`) | 5 | 0 | — |
| Recomendações (`/gestao/recomendacoes`) | 1 | 0 | — |
| Solicitação de Parceria (`/gestao/solicitacao-parceria`) | 1 | 0 | — |
| Cadastro e Estoque (`/produtos-estoque-lotes`) | 6 | 0 | — |
| Clientes (`/gestao/clientes`) | 1 | 0 | — |
| Compras (`/compras`) | 1 | 0 | — |
| Fornecedores (`/gestao/fornecedores`) | 1 | 0 | — |
| Funcionários (`/gestao/funcionarios`) | 1 | 0 | — |
| Inventário / Balanço (`/estoque/inventario`) | 2 | 0 | — |
| Kits & Combos (`/kits`) | 1 | 0 | — |
| Lojas (`/lojas`) | 1 | 0 | — |
| Agenda Telefônica (`/gestao/agenda-telefonica`) | 1 | 0 | — |
| Arquivos e Pastas (`/gestao/arquivos-pastas`) | 4 | 3 | — |
| Documentos (`/gestao/documentos`) | 1 | 0 | — |
| Email Inteligente (`/gestao/email-inteligente`) | 2 | 0 | — |
| Regiões de Entrega (`/gestao/regioes-entrega`) | 1 | 0 | — |
| Serviços (`/gestao/servicos`) | 1 | 0 | — |
| Transportadoras (`/gestao/transportadoras`) | 1 | 0 | — |
| Cartão de Crédito (`/gestao/cartao-credito`) | 4 | 3 | — |
| Cartão de Débito (`/gestao/cartao-debito`) | 4 | 3 | — |
| Crediário (com juros) (`/gestao/gerar-crediario`) | 4 | 3 | — |
| Dinheiro (`/gestao/dinheiro`) | 4 | 3 | — |
| Recebimento Cheque (`/gestao/recebimento-cheque`) | 5 | 0 | — |
| Configurações do Sistema (`/config/sistema`) | 2 | 2 | — |
| Minhas Chaves PIX (`/config/minhas-chaves`) | 1 | 0 | — |
| Configurações Gerais (`/gestao/configuracoes-gerais`) | 1 | 0 | — |
| Dados Empresariais (`/gestao/dados-empresariais`) | 4 | 3 | — |
| Gerar Código de Barras (`/gestao/codigo-barras`) | 4 | 3 | — |
| Painel do Contador (`/gestao/painel-contador`) | 4 | 3 | — |
| Contas a Pagar/Receber | — | — | é a aba `?aba=apagar` de Relatórios Financeiros (estado, não página) |

## 6. Dúvidas de contagem

1. **Rotas que só redirecionam** — `/fiscal` → Notas Fiscais, `/configuracoes` → Configurações do Sistema, `/marketplace-ifood` → Pedidos iFood, `/gestao/empresarial` → painel de Gestão, e `/faturamento` (embrulha Notas Fiscais). Não contei nenhuma delas como página (5 rotas). Consequência: o item de menu/flag **"iFood Marketplace" é a mesma tela de "Pedidos iFood"**.
1b. **Órfãs verdadeiras**: `/pedidos` (tela "Pedidos", antiga) e `/gestao/cadastro-produtos` (cadastro de produtos antigo, anterior à tela unificada Cadastro e Estoque). Abrem por URL, sem menu nem link — candidatas a remoção na Fase 5.
2. **Setup** (`/setup`) só abre quando não há loja cadastrada; com loja, mostra "Sistema já configurado". Contei como página de sistema.
3. **404** (`/*`) é um catch-all — contei 1 página de sistema, sem rota fixa.
4. **Visão Geral** existe duas vezes com telas diferentes: `/visao-geral` (indicadores das lojas) e `/gestao` (painel de gestão). Contei 2.
5. **Downloads**, **Boletos**, **Mala Direta** e **Torpedos** têm componente e rota comentada (decisão desta implantação: sem provedor). Contei como "só no código". Downloads foi substituída por Equipamentos.
8. **Redefinir senha** (`/auth/redefinir-senha`) só é alcançada pelo link do e-mail de recuperação — contei em "Acesso e sistema".
6. **Arquivos e Pastas** tem duas rotas (`/gestao/arquivos-pastas`, `/gestao/pasta-principal`) para a mesma tela — contei 1.
7. **Páginas com flag desligada** abrem para admin com faixa de aviso (preview) e bloqueiam os demais perfis. Classifiquei como "atrás de flag", não como inativas — a tela funciona.

## 7. Ordem proposta para a auditoria (Fase 2)

Sessões mais usadas e críticas primeiro; configurações e raras por último. Lotes de 6–8 páginas por sessão de trabalho.

| Lote | Sessão | Páginas (ativas) | Motivo |
|---|---|---|---|
| 1 | Vendas e Pedidos — balcão | PDV, Caixa, Vendas, Devoluções, Notas Fiscais, Pedidos Delivery | dia a dia do caixa; fiscal depende |
| 2 | Vendas e Pedidos — Venda Mais | E-mail Marketing, Cartão Fidelidade, Crediário Próprio, Promissórias | recompra e prazo |
| 3 | Gestão › Gestão Empresarial — estoque | Cadastro e Estoque, Kardex, Inventário, Transferências, Compras, Importar NFe, Kits | reposição e validade |
| 4 | Gestão › Gestão Empresarial — pessoas | Clientes, Fornecedores, Funcionários, Comissões, Lojas | cadastros base |
| 5 | Gestão › Financeiro | Relatórios Financeiros (+ aba Contas), Relatórios, Análise Gerencial | dinheiro |
| 6 | Gestão › Fiscal | Remessas, Notas Recebidas, Escrituração (SPED), Certificado, Config. SEFAZ | obrigação legal |
| 7 | Gestão › Atendimento + Início | Notificações, Exclusão LGPD, Dashboard, Visão Geral (×2), Usuários | apoio |
| 8 | Configurações | Config. do Sistema, Empresariais, Chaves PIX, Equipamentos, Treinamento, Ajuda | raras |
| 9 | Acesso e sistema | Login, Setup, 404 | fluxos de borda |
| — | Atrás de flag / só no código | 42 + 6 páginas | **Fase 5: perguntar antes** |

## 8. Nível de confiança da contagem

**Alto.** Três fontes cruzadas (código com acesso total, navegação logada abrindo 108 URLs por endereço direto, e a tabela de flags do banco), segunda passada automática confirmando o status de cada rota, e nenhuma URL nova na rodada final. O único ponto de interpretação está nas dúvidas 1 e 3 (Faturamento e 404), que mudam o total em no máximo ±1.

---

### Regras de segurança aplicadas nesta fase
- Ambiente: só existe produção. Nesta fase nenhuma ação de escrita foi executada — apenas leitura e navegação.
- Conta temporária: `demo.admin@lojaxlife.com.br`, role admin (todas as permissões), criada em 10/09/2026 10:37, senha fora do repositório (`~/.config/erp-xlife/conta-temporaria.txt`). Será desativada no relatório final.
- Dados nos prints: a base de produção ainda só tem dados de teste da implantação (cadastros fictícios); a virada para dados reais ainda não aconteceu.


### Decisões aprovadas (10/09/2026)

| # | Dúvida | Decisão | Efeito |
|---|---|---|---|
| 1 | Rotas que só redirecionam / iFood | **iFood removido** — cliente não usa. Rotas `/ifood` e `/marketplace-ifood` e os dois itens de menu ficam **comentados**, prontos para voltar | iFood sai de "atrás de flag" para "só no código"; a seção **Vendas pela Internet** fica sem itens e some do menu |
| 1b | Órfãs `/pedidos` e `/gestao/cadastro-produtos` | **Remover na Fase 5** | telas antigas, substituídas por Ciclo de Pedidos e Cadastro e Estoque |
| 3 | Duas telas de "Visão Geral" | **Manter como está** — é o comportamento desejado | `/visao-geral` (indicadores) e `/gestao` (painel) seguem separadas |
| 4 | Quem vê página desativada | **Só o administrador principal.** Desligou, some para todos os cargos — inclusive outros admins | implementado na migration 065: coluna `admin_principal`, RLS de escrita das flags restrita a ele, preview do FeatureGuard idem |
| 4b | Alternar conjuntos de telas | **Padrões de tela**: salvar o conjunto atual com nome e alternar em um clique | tabela `erp_flag_presets` + funções salvar/aplicar; já existem "Loja de suplementos" (42 desligadas) e "Sistema completo" |


### Achados de passagem (registrados, não corrigidos nesta fase)

- `/gestao/regioes-entrega`: 400 https://apps-supabase.mvj9qv.easypanel.host/rest/v1/erp_regioes_entrega?select=*&ativo=eq.true&order=nome.asc&loja_id=eq; 400 https://apps-supabase.mvj9qv.easypanel.host/rest/v1/erp_regioes_entrega?select=*&ativo=eq.true&order=nome.asc&loja_id=eq
- `/gestao/transportadoras`: 400 https://apps-supabase.mvj9qv.easypanel.host/rest/v1/erp_transportadoras?select=*&ativo=eq.true&order=nome.asc&loja_id=eq; 400 https://apps-supabase.mvj9qv.easypanel.host/rest/v1/erp_transportadoras?select=*&ativo=eq.true&order=nome.asc&loja_id=eq
