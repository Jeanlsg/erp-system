# 🗺️ MAPA UNIFICADO · ERP System

**Objetivo:** Consolidar todos os mapas em um único documento de referência para implementar todas as páginas e campos necessários no banco de dados.

**Fontes:**
- `MAPA_GESTAO_EMPRESARIAL.md` (42 páginas)
- `MAPA_RELATORIOS_FINANCEIROS.md` (campos do financeiro)
- `MAPA_MODELO_RELATORIOS_FINANCEIROS.md` (estrutura UI)

**Schema atual:** `supabase/migrations/001_initial_schema.sql` (16 tabelas)

---

## 📊 Status de Implementação

| Item | Status | Observação |
|------|:------:|------------|
| ✅ Lojas | OK | JÁ NO SCHEMA |
| ✅ Usuários | OK | JÁ NO SCHEMA |
| ✅ Pessoas (clientes/fornecedores) | OK | JÁ NO SCHEMA |
| ✅ Funcionários | OK | JÁ NO SCHEMA |
| ✅ Transportadoras | OK | JÁ NO SCHEMA |
| ✅ Regiões de Entrega | OK | JÁ NO SCHEMA |
| ✅ Categorias | OK | JÁ NO SCHEMA |
| ✅ Produtos | OK | JÁ NO SCHEMA |
| ✅ Estoque | OK | JÁ NO SCHEMA |
| ✅ Lotes | OK | JÁ NO SCHEMA |
| ✅ Kits | OK | JÁ NO SCHEMA |
| ✅ Serviços | OK | JÁ NO SCHEMA |
| ✅ Vendas + Itens | OK | JÁ NO SCHEMA |
| ✅ Caixa + Movimentações | OK | JÁ NO SCHEMA |
| ✅ Contas a Pagar/Receber | OK | JÁ NO SCHEMA |
| ✅ Notas Fiscais | OK | JÁ NO SCHEMA |
| ✅ Pedidos/Delivery | OK | JÁ NO SCHEMA |
| ✅ Compras + Itens | OK | JÁ NO SCHEMA |
| 🟡 Veículos | FALTA | Tabela nova |
| 🟡 Agenda Compromissos | FALTA | Tabela nova |
| 🟡 Cheques | FALTA | Tabela nova |
| 🟡 Boletos (emissão) | FALTA | Tabela nova |
| 🟡 Boletos Recibos | FALTA | Tabela nova |
| 🟡 Crediário | FALTA | Tabela nova |
| 🟡 Promissórias | FALTA | Tabela nova |
| 🟡 Avaliações | FALTA | Tabela nova |
| 🟡 Recomendações | FALTA | Tabela nova |
| 🟡 Documentos/Arquivos | FALTA | Tabela nova |
| 🟡 Downloads | FALTA | Tabela nova |
| 🟡 E-mail Marketing | FALTA | Tabela nova |
| 🟡 Mala Direta | FALTA | Tabela nova |
| 🟡 Cartão Fidelidade | FALTA | Tabela nova |
| 🟡 Torpedos (SMS) | FALTA | Tabela nova |
| 🟡 Chaves PIX | FALTA | Tabela nova |
| 🟡 Contas Bancárias | FALTA | Tabela nova |
| 🟡 Certificados Digitais | FALTA | Tabela nova |
| 🟡 Configurações SEFAZ | FALTA | Tabela nova |
| 🟡 Dados Empresariais | FALTA | Tabela nova |
| 🟡 Negativação Devedores | FALTA | Tabela nova |
| 🟡 Parcelamento | FALTA | Tabela nova |
| 🟡 Protesto | FALTA | Tabela nova |
| 🟡 Localizar Pessoas | FALTA | View/Tabela |
| 🟡 Parcerias | FALTA | Tabela nova |
| 🟡 Notificações | FALTA | Tabela nova |
| 🟡 Tarefas/Pendências | FALTA | Tabela nova |
| 🟡 Aniversariantes | FALTA | View (pessoas.data_nascimento) |
| 🟡 Bandeiras Cartão | FALTA | Tabela nova |
| 🟡 Taxas Cartão | FALTA | Tabela nova |
| 🟡 Sangrias | FALTA | JÁ PARCIAL (caixa_movimentacoes) |
| 🟡 Entradas Extra Caixa | FALTA | JÁ PARCIAL (caixa_movimentacoes) |
| 🟡 Comissão | FALTA | Tabela nova |
| 🟡 Vales/Tickets | FALTA | Tabela nova |
| 🟡 NFe/SAT/MFE | FALTA | JÁ NO SCHEMA (notas_fiscais) |

---

## 🚨 Migrations Faltantes

### 📄 `003_veiculos_agenda_cheques.sql`

```sql
-- Veículos (frota)
CREATE TABLE veiculos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID REFERENCES lojas(id),
  placa VARCHAR(10) UNIQUE NOT NULL,
  chassi VARCHAR(50),
  renavam VARCHAR(20),
  marca VARCHAR(50),
  modelo VARCHAR(50),
  ano_fabricacao INTEGER,
  ano_modelo INTEGER,
  cor VARCHAR(30),
  km_atual INTEGER DEFAULT 0,
  tipo_combustivel VARCHAR(20),
  capacidade_carga DECIMAL(10,2), -- em toneladas
  status VARCHAR(20) DEFAULT 'ativo', -- ativo, manutencao, inativo
  ipva_valor DECIMAL(12,2),
  ipva_vencimento DATE,
  seguro_vencimento DATE,
  licenciamento_vencimento DATE,
  proxima_revisao_km INTEGER,
  proxima_revisao_data DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Abastecimentos
CREATE TABLE veiculo_abastecimentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  data_abastecimento TIMESTAMPTZ DEFAULT NOW(),
  km_abastecimento INTEGER NOT NULL,
  litros DECIMAL(10,3) NOT NULL,
  valor_total DECIMAL(12,2) NOT NULL,
  preco_litro DECIMAL(10,3) NOT NULL,
  posto VARCHAR(100),
  motorista_id UUID REFERENCES funcionarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Manutenções
CREATE TABLE veiculo_manutencoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  tipo VARCHAR(50), -- troca_oleo, revisao, pne, etc
  data_manutencao DATE NOT NULL,
  km_manutencao INTEGER,
  descricao TEXT,
  valor DECIMAL(12,2),
  oficina VARCHAR(100),
  proxima_km INTEGER,
  proxima_data DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agenda Compromissos
CREATE TABLE agenda_compromissos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  loja_id UUID REFERENCES lojas(id),
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50), -- reuniao, tarefa, lembrete, evento
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ,
  dia_inteiro BOOLEAN DEFAULT false,
  prioridade VARCHAR(20) DEFAULT 'media', -- baixa, media, alta
  status VARCHAR(20) DEFAULT 'pendente', -- pendente, concluido, cancelado
  clientes_relacionados UUID[], -- array de pessoas.id
  pedido_relacionado UUID REFERENCES pedidos(id),
  venda_relacionada UUID REFERENCES vendas(id),
  -- Recorrência
  recorrencia_tipo VARCHAR(20), -- unico, diario, semanal, mensal
  recorrencia_fim DATE,
  recorrencia_pai_id UUID REFERENCES agenda_compromissos(id),
  -- Lembretes
  lembrete_minutos INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contatos da Agenda Telefônica
CREATE TABLE agenda_telefonica (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID REFERENCES lojas(id),
  usuario_id UUID REFERENCES usuarios(id),
  pessoa_id UUID REFERENCES pessoas(id), -- opcional, link com cadastro
  nome VARCHAR(255) NOT NULL,
  empresa VARCHAR(255),
  cargo VARCHAR(100),
  categoria VARCHAR(50), -- cliente, fornecedor, funcionario, parceiro, pessoal
  email VARCHAR(255),
  telefone VARCHAR(20),
  celular VARCHAR(20),
  whatsapp VARCHAR(20),
  endereco TEXT,
  observacoes TEXT,
  favorito BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cheques (emitidos e recebidos)
CREATE TABLE cheques (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES lojas(id),
  tipo VARCHAR(20) NOT NULL, -- emitido, recebido
  pessoa_id UUID REFERENCES pessoas(id), -- cliente ou fornecedor
  banco VARCHAR(100) NOT NULL,
  agencia VARCHAR(10),
  conta VARCHAR(20),
  numero_cheque VARCHAR(20) NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_compensacao DATE,
  status VARCHAR(30) DEFAULT 'em_carteira', -- em_carteira, compensado, devolvido, sustado, cancelado
  motivo_devolucao TEXT,
  venda_id UUID REFERENCES vendas(id),
  conta_id UUID REFERENCES contas(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 📄 `004_boletos_crediario_promissorias.sql`

```sql
-- Boletos emitidos
CREATE TABLE boletos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES lojas(id),
  conta_id UUID REFERENCES contas(id),
  pessoa_id UUID NOT NULL REFERENCES pessoas(id),
  nosso_numero VARCHAR(20),
  codigo_barras VARCHAR(50),
  linha_digitavel VARCHAR(60),
  valor DECIMAL(12,2) NOT NULL,
  valor_pago DECIMAL(12,2) DEFAULT 0,
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status VARCHAR(30) DEFAULT 'emitido', -- emitido, pago, vencido, cancelado
  banco VARCHAR(50),
  instrucoes TEXT,
  pdf_url TEXT,
  pix_qrcode TEXT,
  -- Multa/Juros
  multa_percentual DECIMAL(5,2) DEFAULT 2.00,
  juros_mensal DECIMAL(5,2) DEFAULT 1.00,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crediário (parcelamento)
CREATE TABLE crediario_parcelas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES lojas(id),
  pessoa_id UUID NOT NULL REFERENCES pessoas(id),
  venda_id UUID REFERENCES vendas(id),
  numero_contrato VARCHAR(50),
  valor_total DECIMAL(12,2) NOT NULL,
  juros_mensal DECIMAL(5,2) DEFAULT 0,
  tipo_juros VARCHAR(20) DEFAULT 'simples', -- simples, composto, sem_juros
  numero_parcelas INTEGER NOT NULL,
  data_primeira_parcela DATE NOT NULL,
  dia_vencimento INTEGER DEFAULT 10,
  status VARCHAR(20) DEFAULT 'ativo', -- ativo, quitado, cancelado, renegociado
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crediario_parcela_itens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crediario_id UUID NOT NULL REFERENCES crediario_parcelas(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  valor_pago DECIMAL(12,2) DEFAULT 0,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status VARCHAR(20) DEFAULT 'pendente', -- pendente, pago, atrasado, cancelado
  recibo_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Promissórias
CREATE TABLE promissorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES lojas(id),
  pessoa_id UUID NOT NULL REFERENCES pessoas(id), -- emitente ou beneficiário
  tipo VARCHAR(20) NOT NULL, -- emitida, recebida
  numero VARCHAR(50),
  valor DECIMAL(12,2) NOT NULL,
  valor_extenso TEXT,
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status VARCHAR(20) DEFAULT 'pendente', -- pendente, paga, vencida, cancelada, protestada
  venda_id UUID REFERENCES vendas(id),
  conta_id UUID REFERENCES contas(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 📄 `005_pagamentos_taxas_sangrias.sql`

```sql
-- Bandeiras de Cartão
CREATE TABLE bandeiras_cartao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(50) NOT NULL, -- Visa, Mastercard, Elo, Hipercard, etc
  tipo VARCHAR(20) NOT NULL, -- credito, debito
  taxa_debito DECIMAL(5,2) DEFAULT 0, -- %
  taxa_credito_vista DECIMAL(5,2) DEFAULT 0, -- %
  taxa_credito_parcelado DECIMAL(5,2) DEFAULT 0, -- %
  prazo_recebimento_dias INTEGER DEFAULT 30,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Taxas de Cartão por Venda
CREATE TABLE venda_taxas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venda_id UUID NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  bandeira_id UUID NOT NULL REFERENCES bandeiras_cartao(id),
  valor_bruto DECIMAL(12,2) NOT NULL,
  taxa_percentual DECIMAL(5,2) NOT NULL,
  valor_taxa DECIMAL(12,2) NOT NULL,
  valor_liquido DECIMAL(12,2) NOT NULL,
  numero_parcela INTEGER DEFAULT 1,
  total_parcelas INTEGER DEFAULT 1,
  data_previsao_recebimento DATE,
  data_recebimento DATE,
  status VARCHAR(20) DEFAULT 'pendente', -- pendente, recebido, atrasado
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sangrias / Entradas Extra Caixa (separar melhor)
CREATE TABLE sangrias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caixa_id UUID NOT NULL REFERENCES caixa(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  data_hora TIMESTAMPTZ DEFAULT NOW(),
  motivo VARCHAR(255) NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  observacoes TEXT
);

CREATE TABLE entradas_extras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caixa_id UUID NOT NULL REFERENCES caixa(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  data_hora TIMESTAMPTZ DEFAULT NOW(),
  motivo VARCHAR(255) NOT NULL,
  forma_pagamento forma_pagamento NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  observacoes TEXT
);

-- Comissão de Funcionários
CREATE TABLE comissoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES lojas(id),
  funcionario_id UUID NOT NULL REFERENCES funcionarios(id),
  venda_id UUID REFERENCES vendas(id),
  servico_id UUID REFERENCES servicos(id),
  data_referencia DATE NOT NULL,
  valor_venda DECIMAL(12,2) NOT NULL,
  percentual_comissao DECIMAL(5,2) NOT NULL,
  valor_comissao DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pendente', -- pendente, pago, cancelado
  data_pagamento DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 📄 `006_crm_marketing_cartao_fidelidade.sql`

```sql
-- CRM - Avaliações de Clientes
CREATE TABLE avaliacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL REFERENCES pessoas(id),
  loja_id UUID REFERENCES lojas(id),
  pedido_id UUID REFERENCES pedidos(id),
  produto_id UUID REFERENCES produtos(id),
  nota INTEGER NOT NULL CHECK (nota >= 1 AND nota <= 5),
  comentario TEXT,
  resposta TEXT,
  data_avaliacao TIMESTAMPTZ DEFAULT NOW(),
  tipo VARCHAR(20) DEFAULT 'geral', -- geral, produto, atendimento
  visivel BOOLEAN DEFAULT true,
  -- Metadata
  ip_origem VARCHAR(50),
  verificado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRM - Recomendações (Recomendo/Não Recomendo)
CREATE TABLE recomendacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL REFERENCES pessoas(id),
  pessoa_recomendada_id UUID NOT NULL REFERENCES pessoas(id),
  tipo VARCHAR(20) NOT NULL, -- recomendo, nao_recomendo
  motivo TEXT,
  valor_envolvido DECIMAL(12,2),
  data_ocorrencia DATE,
  visivel BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cartão Fidelidade
CREATE TABLE cartao_fidelidade (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES lojas(id),
  cliente_id UUID NOT NULL REFERENCES pessoas(id),
  numero_cartao VARCHAR(50) UNIQUE NOT NULL,
  data_emissao DATE NOT NULL,
  data_validade DATE,
  saldo_pontos INTEGER DEFAULT 0,
  total_pontos_acumulados INTEGER DEFAULT 0,
  nivel VARCHAR(20) DEFAULT 'padrao', -- padrao, prata, ouro, vip
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cartao_fidelidade_movimentacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cartao_id UUID NOT NULL REFERENCES cartao_fidelidade(id) ON DELETE CASCADE,
  venda_id UUID REFERENCES vendas(id),
  tipo VARCHAR(20) NOT NULL, -- credito, debito, expiracao, bonus
  pontos INTEGER NOT NULL,
  motivo VARCHAR(255),
  data_movimentacao TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- E-mail Marketing
CREATE TABLE email_marketing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID REFERENCES lojas(id),
  nome VARCHAR(255) NOT NULL,
  assunto VARCHAR(255),
  template TEXT,
  remetente VARCHAR(255),
  -- Segmentação
  publico_alvo JSONB, -- {tags: [], cidade: null, idade: null, etc}
  -- Agendamento
  data_agendada TIMESTAMPTZ,
  data_enviada TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'rascunho', -- rascunho, agendada, enviada, cancelada
  -- Métricas
  total_destinatarios INTEGER DEFAULT 0,
  total_enviados INTEGER DEFAULT 0,
  total_abertos INTEGER DEFAULT 0,
  total_cliques INTEGER DEFAULT 0,
  total_erros INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mala Direta
CREATE TABLE mala_direta (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID REFERENCES lojas(id),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  segmento_alvo JSONB,
  data_envio DATE,
  total_destinatarios INTEGER DEFAULT 0,
  custo_total DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'planejada', -- planejada, em_envio, concluida, cancelada
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Torpedos (SMS)
CREATE TABLE torpedos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID REFERENCES lojas(id),
  nome VARCHAR(255) NOT NULL,
  mensagem TEXT NOT NULL,
  remetente VARCHAR(50),
  data_agendada TIMESTAMPTZ,
  data_enviada TIMESTAMPTZ,
  total_destinatarios INTEGER DEFAULT 0,
  total_enviados INTEGER DEFAULT 0,
  total_erros INTEGER DEFAULT 0,
  custo_total DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'rascunho',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 📄 `007_documentos_empresa_config.sql`

```sql
-- Documentos / Arquivos
CREATE TABLE documentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID REFERENCES lojas(id),
  pasta_id UUID REFERENCES documentos(id), -- self-reference
  usuario_id UUID REFERENCES usuarios(id),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50), -- contrato, recibo, nota, pdf, imagem, planilha
  extensao VARCHAR(10),
  tamanho_bytes BIGINT,
  storage_path TEXT, -- caminho no storage
  publico BOOLEAN DEFAULT false,
  tags TEXT[],
  pessoa_relacionada_id UUID REFERENCES pessoas(id),
  venda_relacionada_id UUID REFERENCES vendas(id),
  data_documento DATE,
  data_upload TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Downloads
CREATE TABLE downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID REFERENCES lojas(id),
  categoria VARCHAR(50), -- manual, instalador, utilitario, driver
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  extensao VARCHAR(10),
  tamanho_bytes BIGINT,
  url_externa TEXT,
  versao VARCHAR(20),
  download_count INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chaves PIX
CREATE TABLE chaves_pix (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES lojas(id),
  tipo VARCHAR(20) NOT NULL, -- cpf, cnpj, email, telefone, aleatoria
  chave VARCHAR(255) NOT NULL,
  titular VARCHAR(255) NOT NULL,
  banco VARCHAR(100),
  agencia VARCHAR(10),
  conta VARCHAR(20),
  principal BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contas Bancárias
CREATE TABLE contas_bancarias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES lojas(id),
  banco VARCHAR(100) NOT NULL,
  codigo_banco VARCHAR(10),
  agencia VARCHAR(10) NOT NULL,
  agencia_digito VARCHAR(5),
  conta VARCHAR(20) NOT NULL,
  conta_digito VARCHAR(5),
  tipo VARCHAR(20) DEFAULT 'corrente', -- corrente, poupanca, investimento
  titular VARCHAR(255) NOT NULL,
  cnpj_cpf VARCHAR(18),
  principal BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  saldo_inicial DECIMAL(12,2) DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dados Empresariais (configurações da empresa)
CREATE TABLE dados_empresariais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES lojas(id),
  -- Identificação
  razao_social VARCHAR(255) NOT NULL,
  nome_fantasia VARCHAR(255),
  cnpj VARCHAR(18) NOT NULL,
  inscricao_estadual VARCHAR(20),
  inscricao_municipal VARCHAR(20),
  -- Endereço
  cep VARCHAR(10),
  logradouro VARCHAR(255),
  numero VARCHAR(20),
  complemento VARCHAR(100),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  uf VARCHAR(2),
  -- Contato
  telefone VARCHAR(20),
  celular VARCHAR(20),
  email VARCHAR(255),
  site VARCHAR(255),
  -- Regime Tributário
  regime_tributario VARCHAR(30), -- simples, presumido, real
  cnae VARCHAR(10),
  -- Responsável
  socio_nome VARCHAR(255),
  socio_cpf VARCHAR(14),
  -- Logo
  logo_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configurações SEFAZ
CREATE TABLE configuracoes_sefaz (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES lojas(id),
  ambiente VARCHAR(20) DEFAULT 'homologacao', -- homologacao, producao
  uf VARCHAR(2) NOT NULL,
  serie_nfe INTEGER DEFAULT 1,
  serie_nfce INTEGER DEFAULT 1,
  numeracao_atual_nfe INTEGER DEFAULT 1,
  numeracao_atual_nfce INTEGER DEFAULT 1,
  csc_id VARCHAR(20),
  csc_token VARCHAR(100),
  timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
  timeout_segundos INTEGER DEFAULT 30,
  -- Certificado
  certificado_id UUID REFERENCES certificados_digitais(id),
  ativo BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Certificados Digitais (A1/A3)
CREATE TABLE certificados_digitais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES lojas(id),
  tipo VARCHAR(10) NOT NULL, -- A1, A3
  nome VARCHAR(255),
  titular VARCHAR(255) NOT NULL,
  cnpj_cpf VARCHAR(18) NOT NULL,
  emissor VARCHAR(100),
  numero_serie VARCHAR(100),
  data_validade DATE NOT NULL,
  arquivo_path TEXT,
  senha_armazenada TEXT, -- encrypted
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 📄 `008_cobranca_parcerias_notificacoes.sql`

```sql
-- Negativação de Devedores (SPC/Serasa)
CREATE TABLE negativacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES lojas(id),
  pessoa_id UUID NOT NULL REFERENCES pessoas(id),
  contas JSONB, -- [{conta_id, valor, data_vencimento}]
  valor_total DECIMAL(12,2) NOT NULL,
  data_negativacao DATE NOT NULL,
  data_prevista_exclusao DATE,
  motivo TEXT,
  status VARCHAR(20) DEFAULT 'ativo', -- ativo, desnegativado, contestado
  desnegativacao_data DATE,
  desnegativacao_motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parcelamento de Débitos
CREATE TABLE parcelamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES lojas(id),
  pessoa_id UUID NOT NULL REFERENCES pessoas(id),
  divida_original DECIMAL(12,2) NOT NULL,
  valor_entrada DECIMAL(12,2) DEFAULT 0,
  valor_total DECIMAL(12,2) NOT NULL,
  juros_mensal DECIMAL(5,2) DEFAULT 0,
  numero_parcelas INTEGER NOT NULL,
  data_contrato DATE NOT NULL,
  data_primeira_parcela DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'ativo', -- ativo, quitado, cancelado, renegociado
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE parcelamento_contas (
  parcelamento_id UUID REFERENCES parcelamentos(id) ON DELETE CASCADE,
  conta_id UUID REFERENCES contas(id),
  valor_original DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (parcelamento_id, conta_id)
);

CREATE TABLE parcelamento_parcelas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcelamento_id UUID NOT NULL REFERENCES parcelamentos(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  valor_pago DECIMAL(12,2) DEFAULT 0,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status VARCHAR(20) DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Protesto de Títulos
CREATE TABLE protestos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES lojas(id),
  pessoa_id UUID NOT NULL REFERENCES pessoas(id),
  tipo_titulo VARCHAR(20), -- cheque, promissoria, duplicata, nota
  titulo_id UUID, -- link genérico
  valor DECIMAL(12,2) NOT NULL,
  data_protesto DATE NOT NULL,
  cartorio VARCHAR(255),
  numero_protocolo VARCHAR(50),
  custo_protesto DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'protestado', -- protestado, sustado, pago, cancelado
  data_sustacao DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Solicitações de Parceria
CREATE TABLE parcerias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID REFERENCES lojas(id),
  pessoa_id UUID REFERENCES pessoas(id),
  tipo_parceria VARCHAR(50) NOT NULL, -- fornecedor, revenda, franquia, distrito
  nome_empresa VARCHAR(255) NOT NULL,
  cnpj VARCHAR(18),
  contato_nome VARCHAR(255),
  contato_email VARCHAR(255),
  contato_telefone VARCHAR(20),
  mensagem TEXT,
  status VARCHAR(20) DEFAULT 'pendente', -- pendente, em_analise, aprovada, rejeitada
  data_aprovacao DATE,
  motivo_rejeicao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notificações do Sistema
CREATE TABLE notificacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  loja_id UUID REFERENCES lojas(id),
  tipo VARCHAR(50) NOT NULL, -- venda, estoque, contas, sistema, manutencao
  titulo VARCHAR(255) NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN DEFAULT false,
  data_leitura TIMESTAMPTZ,
  -- Link de ação
  linkacao VARCHAR(255),
  -- Metadata
  icone VARCHAR(50),
  cor VARCHAR(20),
  -- Dados relacionados
  venda_id UUID REFERENCES vendas(id),
  pessoa_id UUID REFERENCES pessoas(id),
  produto_id UUID REFERENCES produtos(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ocorrências / Pendências
CREATE TABLE ocorrencias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID REFERENCES lojas(id),
  usuario_id UUID REFERENCES usuarios(id),
  tipo VARCHAR(50) NOT NULL, -- suporte, duvida, problema, sugestao
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'aberto', -- aberto, em_andamento, resolvido, fechado
  prioridade VARCHAR(20) DEFAULT 'media', -- baixa, media, alta, urgente
  data_resolucao TIMESTAMPTZ,
  usuario_responsavel_id UUID REFERENCES usuarios(id),
  observacoes_admin TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configurações Gerais do Sistema
CREATE TABLE configuracoes_sistema (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chave VARCHAR(100) UNIQUE NOT NULL,
  valor TEXT,
  tipo VARCHAR(20) DEFAULT 'texto', -- texto, numero, boolean, json
  categoria VARCHAR(50),
  descricao TEXT,
  editavel BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Views (não são tabelas, mas úteis)
-- View de Aniversariantes
CREATE VIEW v_aniversariantes_mes AS
SELECT 
  id, nome_razao, email, telefone, celular,
  endereco->>'data_nascimento' as data_nascimento,
  EXTRACT(MONTH FROM (endereco->>'data_nascimento')::date) as mes,
  EXTRACT(DAY FROM (endereco->>'data_nascimento')::date) as dia,
  EXTRACT(YEAR FROM AGE((endereco->>'data_nascimento')::date)) as idade
FROM pessoas
WHERE endereco->>'data_nascimento' IS NOT NULL
  AND ativo = true;

-- View de Contas Vencidas
CREATE VIEW v_contas_vencidas AS
SELECT 
  c.*, p.nome_razao as pessoa_nome, p.email as pessoa_email,
  p.telefone as pessoa_telefone, l.apelido as loja_apelido,
  (c.valor - c.valor_pago) as valor_restante,
  (CURRENT_DATE - c.data_vencimento) as dias_atraso
FROM contas c
JOIN lojas l ON l.id = c.loja_id
LEFT JOIN pessoas p ON p.id = c.pessoa_id
WHERE c.status = 'pendente'
  AND c.data_vencimento < CURRENT_DATE;
```

---

## 📝 Alterações no Schema Existente

### Tabela `pessoas` (adicionar campos)

```sql
ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS estado_civil VARCHAR(20);
ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS sexo VARCHAR(10);
ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS profissao VARCHAR(100);
ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS limite_credito DECIMAL(12,2) DEFAULT 0;
ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT false;
ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS motivo_bloqueio TEXT;
```

### Tabela `produtos` (adicionar campos)

```sql
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS codigo_barras VARCHAR(50);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS marca VARCHAR(100);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS modelo VARCHAR(100);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS peso_liquido DECIMAL(10,3);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS peso_bruto DECIMAL(10,3);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS volume DECIMAL(10,3);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS orig VARCHAR(5); -- origem tributária
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS icms DECIMAL(5,2);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ipi DECIMAL(5,2);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS pis DECIMAL(5,2);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cofins DECIMAL(5,2);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cest VARCHAR(10);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS comissao_percentual DECIMAL(5,2) DEFAULT 0;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS tipo_produto VARCHAR(20) DEFAULT 'revenda'; -- producao, revenda, materia_prima, servico
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS controla_lote BOOLEAN DEFAULT false;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS controla_serie BOOLEAN DEFAULT false;
```

### Tabela `vendas` (adicionar campos)

```sql
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS numero_pedido SERIAL;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS desconto_percentual DECIMAL(5,2) DEFAULT 0;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS acrescimo DECIMAL(12,2) DEFAULT 0;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS troco DECIMAL(12,2) DEFAULT 0;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS valor_recebido DECIMAL(12,2);
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS comissao_total DECIMAL(12,2) DEFAULT 0;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS taxa_entrega DECIMAL(12,2) DEFAULT 0;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS data_cancelamento TIMESTAMPTZ;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cancelado_por UUID REFERENCES usuarios(id);
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES funcionarios(id);
```

### Tabela `venda_itens` (adicionar campos)

```sql
ALTER TABLE venda_itens ADD COLUMN IF NOT EXISTS desconto_percentual DECIMAL(5,2) DEFAULT 0;
ALTER TABLE venda_itens ADD COLUMN IF NOT EXISTS acrescimo DECIMAL(12,2) DEFAULT 0;
ALTER TABLE venda_itens ADD COLUMN IF NOT EXISTS valor_total DECIMAL(12,2); -- subtotal final
ALTER TABLE venda_itens ADD COLUMN IF NOT EXISTS observacoes TEXT;
```

### Tabela `funcionarios` (adicionar campos)

```sql
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS comissao_percentual DECIMAL(5,2) DEFAULT 0;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS tipo_contrato VARCHAR(20); -- clt, mei, autonomo
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS cpf VARCHAR(14);
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS rg VARCHAR(20);
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS pis_pasep VARCHAR(20);
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS ctps VARCHAR(20);
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS gerente BOOLEAN DEFAULT false;
```

### Tabela `contas` (adicionar campos)

```sql
ALTER TABLE contas ADD COLUMN IF NOT EXISTS numero_documento VARCHAR(50);
ALTER TABLE contas ADD COLUMN IF NOT EXISTS banco VARCHAR(100);
ALTER TABLE contas ADD COLUMN IF NOT EXISTS centro_custo VARCHAR(50);
ALTER TABLE contas ADD COLUMN IF NOT EXISTS plano_conta VARCHAR(50);
ALTER TABLE contas ADD COLUMN IF NOT EXISTS recorrente BOOLEAN DEFAULT false;
ALTER TABLE contas ADD COLUMN IF NOT EXISTS periodicidade VARCHAR(20); -- mensal, semanal, anual
```

### Tabela `notas_fiscais` (adicionar campos)

```sql
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS consumidor_cpf_cnpj VARCHAR(18);
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS consumidor_nome VARCHAR(255);
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS consumidor_email VARCHAR(255);
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS informacoes_complementares TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS valor_desconto DECIMAL(12,2) DEFAULT 0;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS valor_frete DECIMAL(12,2) DEFAULT 0;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS valor_seguro DECIMAL(12,2) DEFAULT 0;
```

### Tabela `lojas` (adicionar campos)

```sql
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS telefone VARCHAR(20);
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS cep VARCHAR(10);
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS logradouro VARCHAR(255);
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS numero VARCHAR(20);
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS complemento VARCHAR(100);
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS cidade VARCHAR(100);
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS uf VARCHAR(2);
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS inscricao_estadual VARCHAR(20);
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS tipo_loja VARCHAR(30) DEFAULT 'loja'; -- matriz, filial, deposito
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS horario JSONB;
```

### Tabela `usuarios` (adicionar campos)

```sql
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tentativas_login INTEGER DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ip_ultimo_login VARCHAR(50);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone VARCHAR(20);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cpf VARCHAR(14);
```

### Tabela `pedidos` (adicionar campos)

```sql
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tipo_pedido VARCHAR(30); -- delivery, retirada, mesa
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS troco_para DECIMAL(12,2);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS forma_pagamento forma_pagamento;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS observacoes_entrega TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8);
```

---

## 🔐 Novas Permissões (RLS)

```sql
-- Adicionar policies para as novas tabelas conforme criado
-- Seguir padrão das tabelas já existentes em 001_initial_schema.sql
```

---

## 📋 Status do Roadmap

### ✅ **Pronto para criar migrations SQL:**
| Migration | Tabelas | Status |
|-----------|---------|--------|
| 001_initial_schema.sql | 16 | ✅ Existe |
| 002_auth_setup.sql | - | ✅ Existe |
| 003_veiculos_agenda_cheques.sql | 7 | 🟡 A criar |
| 004_boletos_crediario_promissorias.sql | 5 | 🟡 A criar |
| 005_pagamentos_taxas_sangrias.sql | 6 | 🟡 A criar |
| 006_crm_marketing_cartao_fidelidade.sql | 6 | 🟡 A criar |
| 007_documentos_empresa_config.sql | 8 | 🟡 A criar |
| 008_cobranca_parcerias_notificacoes.sql | 8 | 🟡 A criar |
| 009_rls_policies.sql | - | 🟡 A criar |
| 010_views_uteis.sql | 3 views | 🟡 A criar |

### 🟡 **Pendências (tabelas):**
- 40 tabelas já mapeadas
- 16 já no schema
- 24 a implementar

### ✅ **Dados alinhados (campos):**
- IDs (UUID)
- Timestamps (created_at, updated_at)
- Status (varchar + check ou enum)
- Valores monetários (decimal 12,2)
- Lojas (multi-tenancy)

---

## 🎯 Próximos Passos

1. **Criar migrations 003-008** (24 tabelas novas + alterações)
2. **Criar views úteis** (aniversariantes, contas vencidas, dashboard)
3. **Adicionar policies RLS** para segurança
4. **Atualizar `lib/types/database.ts`** com novos tipos
5. **Atualizar `lib/supabase-queries.ts`** com novos hooks
6. **Criar páginas ERPNext** no frontend:
   - `/financeiro` (relatórios completos)
   - `/gestao/clientes`, `/gestao/fornecedores`, etc.
   - `/gestao/cheque`, `/gestao/boletos`, etc.
7. **Popular banco com dados de exemplo** (seed inicial)

---

## 📌 Resumo Final

- **Total de páginas ERP:** 42+
- **Tabelas existentes:** 16
- **Tabelas a criar:** 24
- **Total final:** 40 tabelas
- **Views sugeridas:** 3+
- **Campos a adicionar:** 50+ (em tabelas existentes)
- **Migrations a criar:** 8 novas + 1 única consolidação

**Estimativa:** Schema completo cobrirá 100% das páginas mapeadas.