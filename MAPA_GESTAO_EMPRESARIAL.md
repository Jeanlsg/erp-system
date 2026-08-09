# 📋 Mapeamento de Páginas · Gestão Empresarial

**Origem:** `supplement-store-erp-x-life/src/routes/gestao/`
**Total de páginas:** 41 (excluindo transferência bancária e serviços oferecidos)

---

## 🎯 Hub Principal (3 páginas raiz)

| Rota | Título | Descrição | Categoria |
|------|--------|-----------|-----------|
| `/gestao/empresarial` | Gestão Empresarial | Hub central com links para cadastros, documentos, agendas e regiões | Hub |
| `/gestao/configuracoes-sefaz` | Configurações SEFAZ | Integração SEFAZ para NF-e (UFs, regime tributário, certificado) | Fiscal |
| `/gestao/relatorios-financeiros` | Relatórios Financeiros | Painel consolidado de fluxo de caixa, vendas e recebimentos | Financeiro |

---

## ✅ Fase 1 · Concluído (10 páginas)

| Rota | Título | Descrição | Categoria |
|------|--------|-----------|-----------|
| `/gestao/agenda-compromissos` | Agenda de Compromissos | Tarefas, reuniões, lembretes e eventos com prioridades | Produtividade |
| `/gestao/cartao-credito` | Cartão de Crédito | Recebimentos via cartão de crédito (bandeiras, parcelas, taxas) | Financeiro |
| `/gestao/codigo-barras` | Código de Barras | Geração de códigos EAN13, EAN8 e QR Code para produtos | Estoque |
| `/gestao/consulta-cheque` | Consulta Cheque | Controle de cheques emitidos e recebidos | Financeiro |
| `/gestao/consulta-veiculos` | Consulta Veículos | Gestão da frota (placa, km, manutenção, IPVA) | Frota |
| `/gestao/dinheiro` | Dinheiro | Movimentações em espécie (entradas, saídas, sangrias) | Caixa |
| `/gestao/funcionarios` | Funcionários | Cadastro de funcionários (cargo, salário, status) | RH |
| `/gestao/negativar-devedores` | Negativar Devedores | Gestão de clientes inadimplentes | Cobrança |
| `/gestao/parcelar-debitos` | Parcelar Débitos | Negociação e parcelamento de dívidas | Cobrança |
| `/gestao/regioes-entrega` | Regiões de Entrega | Zonas de entrega por CEP com taxas e prazos | Logística |
| `/gestao/transportadoras` | Transportadoras | Cadastro de transportadoras (prazo, valor, regiões atendidas) | Logística |

---

## ✅ Fase 2 · Concluído (4 páginas)

| Rota | Título | Descrição | Categoria |
|------|--------|-----------|-----------|
| `/gestao/avaliacoes` | Avaliações | Gestão de avaliações de clientes com notas e respostas | CRM |
| `/gestao/cartao-debito` | Cartão de Débito | Recebimentos via cartão de débito (NSU, taxas) | Financeiro |
| `/gestao/downloads` | Downloads | Arquivos para download (relatórios, planilhas) | Documentos |
| `/gestao/pasta-principal` | Pasta Principal | Gerenciamento de pastas e arquivos | Documentos |

---

## ✅ Fase 3 · Concluído (5 páginas)

| Rota | Título | Descrição | Categoria |
|------|--------|-----------|-----------|
| `/gestao/consulta-pessoa-fisica` | Consulta Pessoa Física | Cadastro de PF (CPF, dados pessoais, endereço) | Cadastros |
| `/gestao/consulta-pessoa-juridica` | Consulta Pessoa Jurídica | Cadastro de PJ (CNPJ, regime tributário, porte) | Cadastros |
| `/gestao/dados-empresariais` | Dados Empresariais | Dados cadastrais da empresa (placeholder) | Configurações |
| `/gestao/nfe-certificado` | Certificado Digital | Gestão de certificados A1/A3 para NF-e | Fiscal |

---

## 🔮 Fase 5 · Planejado (11 páginas)

| Rota | Título | Descrição | Categoria |
|------|--------|-----------|-----------|
| `/gestao/documentos-demonstrativos` | Documentos Demonstrativos | DRE, Balancete, Balanço, Plano de Contas | Contábil |
| `/gestao/email-inteligente` | Email Inteligente | Automação (boas-vindas, aniversário, inatividade) | Marketing |
| `/gestao/encaminhar-protesto` | Encaminhar Protesto | Títulos para protesto em cartório | Cobrança |
| `/gestao/exclusao-informacoes` | Exclusão de Informações | Solicitações de exclusão (LGPD) | Compliance |
| `/gestao/faturamento` | Faturamento | Emissão de NF com CFOP e natureza de operação | Fiscal |
| `/gestao/localizar-pessoas` | Localizar Pessoas | Busca unificada de PF/PJ | Cadastros |
| `/gestao/minhas-chaves` | Minhas Chaves PIX | Cadastro de chaves PIX da empresa | Financeiro |
| `/gestao/painel-contador` | Painel do Contador | Portal do contador (SPED, conciliação) | Contábil |
| `/gestao/recebimento-cheque` | Recebimento por Cheque | Registro de cheques recebidos | Financeiro |
| `/gestao/relatorio-entregas` | Relatório de Entregas Futuras | Entregas programadas com status | Logística |
| `/gestao/solicitacao-parceria` | Solicitação de Parceria | Parcerias (fornecedor, revenda, franquias) | Comercial |

---

## 🔮 Fase 6 · Planejado (13 páginas)

| Rota | Título | Descrição | Categoria |
|------|--------|-----------|-----------|
| `/gestao/administrar-usuarios` | Administrar Usuários | CRUD de usuários (admin, gerente, operador) | Usuários |
| `/gestao/cadastro-produtos` | Cadastro de Produtos | Produtos com preço, custo, margem, estoque | Estoque |
| `/gestao/configuracoes-gerais` | Configurações Gerais | Configurações gerais (placeholder) | Configurações |
| `/gestao/configuracoes-sistema` | Configurações do Sistema | Configurações técnicas (placeholder) | Configurações |
| `/gestao/fornecedores` | Fornecedores | Cadastro de fornecedores PF/PJ | Cadastros |
| `/gestao/gerar-boleto` | Gerar Boleto | Boletos bancários com linha digitável | Financeiro |
| `/gestao/gerar-crediario` | Gerar Crediário | Carnês de crediário com parcelas | Financeiro |
| `/gestao/gerar-crediario-proprio` | Gerar Crediário Próprio | Carnês de crediário sem juros | Financeiro |
| `/gestao/gerar-promissoria` | Gerar Promissória | Notas promissórias com valor por extenso | Financeiro |
| `/gestao/notificacoes` | Notificações | Central de notificações (vendas, estoque) | Sistema |
| `/gestao/recomendacoes` | Avaliações e Recomendações | Notas e respostas de produtos | CRM |
| `/gestao/relatorios-financeiros` | Relatórios Financeiros | Vendas, fluxo de caixa, lucro | Financeiro |
| `/gestao/usuario-permissoes` | Usuário e Permissões | Permissões granulares por módulo | Usuários |

---

## 📊 Resumo por Categoria

| Categoria | Concluídas | Planejadas | Total |
|-----------|:----------:|:----------:|:-----:|
| Financeiro | 4 | 6 | 10 |
| Cadastros | 2 | 2 | 4 |
| Fiscal | 2 | 1 | 3 |
| Cobrança | 2 | 1 | 3 |
| Estoque/Produtos | 1 | 1 | 2 |
| Configurações | 1 | 3 | 4 |
| Documentos | 2 | 0 | 2 |
| RH | 1 | 0 | 1 |
| Frota | 1 | 0 | 1 |
| Caixa | 1 | 0 | 1 |
| Logística | 2 | 1 | 3 |
| CRM | 1 | 1 | 2 |
| Marketing | 0 | 1 | 1 |
| Contábil | 0 | 2 | 2 |
| Compliance | 0 | 1 | 1 |
| Comercial | 0 | 1 | 1 |
| Usuários | 0 | 2 | 2 |
| Sistema | 0 | 1 | 1 |
| Produtividade | 1 | 0 | 1 |
| **TOTAL** | **19** | **23** | **42** |

---

## 📌 Status Geral

- ✅ **Concluídas:** 19 páginas
- 🔮 **Planejadas:** 23 páginas (2 são placeholders)
- ❌ **Excluídas:** transferencia-bancaria, servicos, agenda-telefonica