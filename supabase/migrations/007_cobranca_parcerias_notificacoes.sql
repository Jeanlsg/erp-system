-- =====================================================
-- ERP System · Cobrança, Parcerias, Notificações (prefixo erp_)
-- Migration: 007_cobranca_parcerias_notificacoes.sql
-- =====================================================

-- ===== Negativação de Devedores =====
CREATE TABLE erp_negativacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id),
  pessoa_id UUID NOT NULL REFERENCES erp_pessoas(id),
  contas JSONB,
  valor_total DECIMAL(12,2) NOT NULL,
  data_negativacao DATE NOT NULL,
  data_prevista_exclusao DATE,
  motivo TEXT,
  status VARCHAR(20) DEFAULT 'ativo',
  desnegativacao_data DATE,
  desnegativacao_motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_negativacoes_pessoa ON erp_negativacoes(pessoa_id);
CREATE INDEX idx_erp_negativacoes_status ON erp_negativacoes(status);

-- ===== Parcelamentos =====
CREATE TABLE erp_parcelamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id),
  pessoa_id UUID NOT NULL REFERENCES erp_pessoas(id),
  divida_original DECIMAL(12,2) NOT NULL,
  valor_entrada DECIMAL(12,2) DEFAULT 0,
  valor_total DECIMAL(12,2) NOT NULL,
  juros_mensal DECIMAL(5,2) DEFAULT 0,
  numero_parcelas INTEGER NOT NULL,
  data_contrato DATE NOT NULL,
  data_primeira_parcela DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'ativo',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_parcelamentos_pessoa ON erp_parcelamentos(pessoa_id);

-- ===== Contas vinculadas ao parcelamento =====
CREATE TABLE erp_parcelamento_contas (
  parcelamento_id UUID REFERENCES erp_parcelamentos(id) ON DELETE CASCADE,
  conta_id UUID REFERENCES erp_contas(id),
  valor_original DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (parcelamento_id, conta_id)
);

-- ===== Parcelas do parcelamento =====
CREATE TABLE erp_parcelamento_parcelas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcelamento_id UUID NOT NULL REFERENCES erp_parcelamentos(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  valor_pago DECIMAL(12,2) DEFAULT 0,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status VARCHAR(20) DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_parcelamento_parcelas ON erp_parcelamento_parcelas(parcelamento_id);

-- ===== Protesto de Títulos =====
CREATE TABLE erp_protestos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id),
  pessoa_id UUID NOT NULL REFERENCES erp_pessoas(id),
  tipo_titulo VARCHAR(20),
  titulo_id UUID,
  valor DECIMAL(12,2) NOT NULL,
  data_protesto DATE NOT NULL,
  cartorio VARCHAR(255),
  numero_protocolo VARCHAR(50),
  custo_protesto DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'protestado',
  data_sustacao DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_protestos_pessoa ON erp_protestos(pessoa_id);

-- ===== Solicitações de Parceria =====
CREATE TABLE erp_parcerias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID REFERENCES erp_lojas(id),
  pessoa_id UUID REFERENCES erp_pessoas(id),
  tipo_parceria VARCHAR(50) NOT NULL,
  nome_empresa VARCHAR(255) NOT NULL,
  cnpj VARCHAR(18),
  contato_nome VARCHAR(255),
  contato_email VARCHAR(255),
  contato_telefone VARCHAR(20),
  mensagem TEXT,
  status VARCHAR(20) DEFAULT 'pendente',
  data_aprovacao DATE,
  motivo_rejeicao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== Notificações do Sistema =====
CREATE TABLE erp_notificacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES erp_usuarios(id),
  loja_id UUID REFERENCES erp_lojas(id),
  tipo VARCHAR(50) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN DEFAULT false,
  data_leitura TIMESTAMPTZ,
  linkacao VARCHAR(255),
  icone VARCHAR(50),
  cor VARCHAR(20),
  venda_id UUID REFERENCES erp_vendas(id),
  pessoa_id UUID REFERENCES erp_pessoas(id),
  produto_id UUID REFERENCES erp_produtos(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_notificacoes_usuario ON erp_notificacoes(usuario_id);
CREATE INDEX idx_erp_notificacoes_lida ON erp_notificacoes(lida);

-- ===== Ocorrências / Pendências =====
CREATE TABLE erp_ocorrencias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID REFERENCES erp_lojas(id),
  usuario_id UUID REFERENCES erp_usuarios(id),
  tipo VARCHAR(50) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'aberto',
  prioridade VARCHAR(20) DEFAULT 'media',
  data_resolucao TIMESTAMPTZ,
  usuario_responsavel_id UUID REFERENCES erp_usuarios(id),
  observacoes_admin TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_ocorrencias_usuario ON erp_ocorrencias(usuario_id);
CREATE INDEX idx_erp_ocorrencias_status ON erp_ocorrencias(status);