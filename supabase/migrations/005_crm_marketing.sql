-- =====================================================
-- ERP System · CRM, Marketing, Fidelidade (prefixo erp_)
-- Migration: 005_crm_marketing.sql
-- =====================================================

-- ===== Avaliações de Clientes =====
CREATE TABLE erp_avaliacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL REFERENCES erp_pessoas(id),
  loja_id UUID REFERENCES erp_lojas(id),
  pedido_id UUID REFERENCES erp_pedidos(id),
  produto_id UUID REFERENCES erp_produtos(id),
  nota INTEGER NOT NULL CHECK (nota >= 1 AND nota <= 5),
  comentario TEXT,
  resposta TEXT,
  data_avaliacao TIMESTAMPTZ DEFAULT NOW(),
  tipo VARCHAR(20) DEFAULT 'geral',
  visivel BOOLEAN DEFAULT true,
  ip_origem VARCHAR(50),
  verificado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_avaliacoes_cliente ON erp_avaliacoes(cliente_id);
CREATE INDEX idx_erp_avaliacoes_produto ON erp_avaliacoes(produto_id);

-- ===== Recomendações =====
CREATE TABLE erp_recomendacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL REFERENCES erp_pessoas(id),
  pessoa_recomendada_id UUID NOT NULL REFERENCES erp_pessoas(id),
  tipo VARCHAR(20) NOT NULL,
  motivo TEXT,
  valor_envolvido DECIMAL(12,2),
  data_ocorrencia DATE,
  visivel BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_recomendacoes_cliente ON erp_recomendacoes(cliente_id);

-- ===== Cartão Fidelidade =====
CREATE TABLE erp_cartao_fidelidade (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id),
  cliente_id UUID NOT NULL REFERENCES erp_pessoas(id),
  numero_cartao VARCHAR(50) UNIQUE NOT NULL,
  data_emissao DATE NOT NULL,
  data_validade DATE,
  saldo_pontos INTEGER DEFAULT 0,
  total_pontos_acumulados INTEGER DEFAULT 0,
  nivel VARCHAR(20) DEFAULT 'padrao',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_cartao_fidelidade_cliente ON erp_cartao_fidelidade(cliente_id);

-- ===== Movimentações do Cartão Fidelidade =====
CREATE TABLE erp_cartao_fidelidade_movimentacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cartao_id UUID NOT NULL REFERENCES erp_cartao_fidelidade(id) ON DELETE CASCADE,
  venda_id UUID REFERENCES erp_vendas(id),
  tipo VARCHAR(20) NOT NULL,
  pontos INTEGER NOT NULL,
  motivo VARCHAR(255),
  data_movimentacao TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_cartao_mov_cartao ON erp_cartao_fidelidade_movimentacoes(cartao_id);

-- ===== E-mail Marketing =====
CREATE TABLE erp_email_marketing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID REFERENCES erp_lojas(id),
  nome VARCHAR(255) NOT NULL,
  assunto VARCHAR(255),
  template TEXT,
  remetente VARCHAR(255),
  publico_alvo JSONB,
  data_agendada TIMESTAMPTZ,
  data_enviada TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'rascunho',
  total_destinatarios INTEGER DEFAULT 0,
  total_enviados INTEGER DEFAULT 0,
  total_abertos INTEGER DEFAULT 0,
  total_cliques INTEGER DEFAULT 0,
  total_erros INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== Mala Direta =====
CREATE TABLE erp_mala_direta (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID REFERENCES erp_lojas(id),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  segmento_alvo JSONB,
  data_envio DATE,
  total_destinatarios INTEGER DEFAULT 0,
  custo_total DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'planejada',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== Torpedos (SMS) =====
CREATE TABLE erp_torpedos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID REFERENCES erp_lojas(id),
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

-- ===== Triggers =====
CREATE TRIGGER update_erp_email_marketing_updated_at BEFORE UPDATE ON erp_email_marketing FOR EACH ROW EXECUTE FUNCTION erp_update_updated_at_column();