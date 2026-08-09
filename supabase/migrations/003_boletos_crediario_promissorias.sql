-- =====================================================
-- ERP System · Boletos, Crediário, Promissórias (prefixo erp_)
-- Migration: 003_boletos_crediario_promissorias.sql
-- =====================================================

-- ===== Boletos Emitidos =====
CREATE TABLE erp_boletos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id),
  conta_id UUID REFERENCES erp_contas(id),
  pessoa_id UUID NOT NULL REFERENCES erp_pessoas(id),
  nosso_numero VARCHAR(20),
  codigo_barras VARCHAR(50),
  linha_digitavel VARCHAR(60),
  valor DECIMAL(12,2) NOT NULL,
  valor_pago DECIMAL(12,2) DEFAULT 0,
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status VARCHAR(30) DEFAULT 'emitido',
  banco VARCHAR(50),
  instrucoes TEXT,
  pdf_url TEXT,
  pix_qrcode TEXT,
  multa_percentual DECIMAL(5,2) DEFAULT 2.00,
  juros_mensal DECIMAL(5,2) DEFAULT 1.00,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_boletos_loja ON erp_boletos(loja_id);
CREATE INDEX idx_erp_boletos_pessoa ON erp_boletos(pessoa_id);
CREATE INDEX idx_erp_boletos_vencimento ON erp_boletos(data_vencimento);
CREATE INDEX idx_erp_boletos_status ON erp_boletos(status);

-- ===== Crediário (Cabeçalho) =====
CREATE TABLE erp_crediario_parcelas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id),
  pessoa_id UUID NOT NULL REFERENCES erp_pessoas(id),
  venda_id UUID REFERENCES erp_vendas(id),
  numero_contrato VARCHAR(50),
  valor_total DECIMAL(12,2) NOT NULL,
  juros_mensal DECIMAL(5,2) DEFAULT 0,
  tipo_juros VARCHAR(20) DEFAULT 'simples',
  numero_parcelas INTEGER NOT NULL,
  data_primeira_parcela DATE NOT NULL,
  dia_vencimento INTEGER DEFAULT 10,
  status VARCHAR(20) DEFAULT 'ativo',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_crediario_loja ON erp_crediario_parcelas(loja_id);
CREATE INDEX idx_erp_crediario_pessoa ON erp_crediario_parcelas(pessoa_id);
CREATE INDEX idx_erp_crediario_status ON erp_crediario_parcelas(status);

-- ===== Crediário (Parcelas) =====
CREATE TABLE erp_crediario_parcela_itens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crediario_id UUID NOT NULL REFERENCES erp_crediario_parcelas(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  valor_pago DECIMAL(12,2) DEFAULT 0,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status VARCHAR(20) DEFAULT 'pendente',
  recibo_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_crediario_item_crediario ON erp_crediario_parcela_itens(crediario_id);
CREATE INDEX idx_erp_crediario_item_vencimento ON erp_crediario_parcela_itens(data_vencimento);

-- ===== Promissórias =====
CREATE TABLE erp_promissorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id),
  pessoa_id UUID NOT NULL REFERENCES erp_pessoas(id),
  tipo VARCHAR(20) NOT NULL,
  numero VARCHAR(50),
  valor DECIMAL(12,2) NOT NULL,
  valor_extenso TEXT,
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status VARCHAR(20) DEFAULT 'pendente',
  venda_id UUID REFERENCES erp_vendas(id),
  conta_id UUID REFERENCES erp_contas(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_promissorias_loja ON erp_promissorias(loja_id);
CREATE INDEX idx_erp_promissorias_pessoa ON erp_promissorias(pessoa_id);
CREATE INDEX idx_erp_promissorias_vencimento ON erp_promissorias(data_vencimento);

-- ===== Triggers =====
CREATE TRIGGER update_erp_boletos_updated_at BEFORE UPDATE ON erp_boletos FOR EACH ROW EXECUTE FUNCTION erp_update_updated_at_column();
CREATE TRIGGER update_erp_crediario_parcelas_updated_at BEFORE UPDATE ON erp_crediario_parcelas FOR EACH ROW EXECUTE FUNCTION erp_update_updated_at_column();
CREATE TRIGGER update_erp_promissorias_updated_at BEFORE UPDATE ON erp_promissorias FOR EACH ROW EXECUTE FUNCTION erp_update_updated_at_column();