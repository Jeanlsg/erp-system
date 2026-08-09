-- =====================================================
-- ERP System · Bandeiras, Taxas, Comissões (prefixo erp_)
-- Migration: 004_pagamentos_taxas.sql
-- =====================================================

-- ===== Bandeiras de Cartão =====
CREATE TABLE erp_bandeiras_cartao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(50) NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  taxa_debito DECIMAL(5,2) DEFAULT 0,
  taxa_credito_vista DECIMAL(5,2) DEFAULT 0,
  taxa_credito_parcelado DECIMAL(5,2) DEFAULT 0,
  prazo_recebimento_dias INTEGER DEFAULT 30,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== Taxas de Cartão por Venda =====
CREATE TABLE erp_venda_taxas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venda_id UUID NOT NULL REFERENCES erp_vendas(id) ON DELETE CASCADE,
  bandeira_id UUID NOT NULL REFERENCES erp_bandeiras_cartao(id),
  valor_bruto DECIMAL(12,2) NOT NULL,
  taxa_percentual DECIMAL(5,2) NOT NULL,
  valor_taxa DECIMAL(12,2) NOT NULL,
  valor_liquido DECIMAL(12,2) NOT NULL,
  numero_parcela INTEGER DEFAULT 1,
  total_parcelas INTEGER DEFAULT 1,
  data_previsao_recebimento DATE,
  data_recebimento DATE,
  status VARCHAR(20) DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_venda_taxas_venda ON erp_venda_taxas(venda_id);

-- ===== Sangrias =====
CREATE TABLE erp_sangrias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caixa_id UUID NOT NULL REFERENCES erp_caixa(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES erp_usuarios(id),
  data_hora TIMESTAMPTZ DEFAULT NOW(),
  motivo VARCHAR(255) NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  observacoes TEXT
);

CREATE INDEX idx_erp_sangrias_caixa ON erp_sangrias(caixa_id);

-- ===== Entradas Extras =====
CREATE TABLE erp_entradas_extras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caixa_id UUID NOT NULL REFERENCES erp_caixa(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES erp_usuarios(id),
  data_hora TIMESTAMPTZ DEFAULT NOW(),
  motivo VARCHAR(255) NOT NULL,
  forma_pagamento erp_forma_pagamento NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  observacoes TEXT
);

CREATE INDEX idx_erp_entradas_extras_caixa ON erp_entradas_extras(caixa_id);

-- ===== Comissão de Funcionários =====
CREATE TABLE erp_comissoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id),
  funcionario_id UUID NOT NULL REFERENCES erp_funcionarios(id),
  venda_id UUID REFERENCES erp_vendas(id),
  servico_id UUID REFERENCES erp_servicos(id),
  data_referencia DATE NOT NULL,
  valor_venda DECIMAL(12,2) NOT NULL,
  percentual_comissao DECIMAL(5,2) NOT NULL,
  valor_comissao DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pendente',
  data_pagamento DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_comissoes_funcionario ON erp_comissoes(funcionario_id);
CREATE INDEX idx_erp_comissoes_venda ON erp_comissoes(venda_id);

-- ===== Seed: Bandeiras comuns =====
INSERT INTO erp_bandeiras_cartao (nome, tipo, taxa_debito, taxa_credito_vista, taxa_credito_parcelado, prazo_recebimento_dias) VALUES
  ('Visa', 'credito', 0, 1.99, 2.99, 30),
  ('Visa', 'debito', 1.49, 0, 0, 1),
  ('Mastercard', 'credito', 0, 1.99, 2.99, 30),
  ('Mastercard', 'debito', 1.49, 0, 0, 1),
  ('Elo', 'credito', 0, 2.29, 3.49, 30),
  ('Elo', 'debito', 1.99, 0, 0, 1),
  ('Hipercard', 'credito', 0, 2.79, 3.99, 30),
  ('American Express', 'credito', 0, 2.49, 3.49, 30),
  ('Hiper', 'credito', 0, 2.79, 3.99, 30);