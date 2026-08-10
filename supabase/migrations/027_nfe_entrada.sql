-- =====================================================
-- ERP System · NFe de Entrada (Compras/Recebimentos)
-- Migration: 027_nfe_entrada.sql
-- =====================================================

-- ===== ENUM =====
CREATE TYPE erp_nfe_entrada_status AS ENUM (
  'pendente', 'processada', 'cancelada', 'rejeitada', 'manifestada'
);

CREATE TYPE erp_nfe_entrada_tipo AS ENUM (
  'nfe', 'nfce', 'cte', 'mdf'
);

-- ===== NFe de Entrada (Cabeçalho) =====
CREATE TABLE erp_nfe_entrada (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id),
  fornecedor_id UUID REFERENCES erp_pessoas(id),
  compra_id UUID REFERENCES erp_compras(id),
  -- Identificação da NFe
  chave_acesso VARCHAR(44) UNIQUE NOT NULL,
  numero INTEGER NOT NULL,
  serie INTEGER NOT NULL DEFAULT 1,
  tipo erp_nfe_entrada_tipo DEFAULT 'nfe',
  -- Datas
  data_emissao TIMESTAMPTZ NOT NULL,
  data_entrada TIMESTAMPTZ DEFAULT NOW(),
  data_vencimento DATE,
  -- Valores
  valor_produtos DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_frete DECIMAL(12,2) DEFAULT 0,
  valor_seguro DECIMAL(12,2) DEFAULT 0,
  valor_desconto DECIMAL(12,2) DEFAULT 0,
  valor_icms DECIMAL(12,2) DEFAULT 0,
  valor_ipi DECIMAL(12,2) DEFAULT 0,
  valor_pis DECIMAL(12,2) DEFAULT 0,
  valor_cofins DECIMAL(12,2) DEFAULT 0,
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- Dados do Emitente (fornecedor)
  emitente_cnpj VARCHAR(18),
  emitente_nome VARCHAR(255),
  emitente_fantasia VARCHAR(255),
  emitente_ie VARCHAR(20),
  emitente_endereco JSONB,
  -- XML Original
  xml_original TEXT,
  xml_url TEXT,
  pdf_url TEXT,
  -- Manifestação
  tipo_manifestacao VARCHAR(20), -- confirmacao, ciencia, desconhecimento, nao_realizada
  data_manifestacao TIMESTAMPTZ,
  justificativa_manifestacao TEXT,
  -- Status
  status erp_nfe_entrada_status DEFAULT 'pendente',
  motivo_cancelamento TEXT,
  protocolo VARCHAR(50),
  -- Metadata
  usuario_id UUID REFERENCES erp_usuarios(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_nfe_entrada_chave ON erp_nfe_entrada(chave_acesso);
CREATE INDEX idx_erp_nfe_entrada_fornecedor ON erp_nfe_entrada(fornecedor_id);
CREATE INDEX idx_erp_nfe_entrada_data ON erp_nfe_entrada(data_emissao);
CREATE INDEX idx_erp_nfe_entrada_loja ON erp_nfe_entrada(loja_id);
CREATE INDEX idx_erp_nfe_entrada_status ON erp_nfe_entrada(status);
CREATE INDEX idx_erp_nfe_entrada_emitente_cnpj ON erp_nfe_entrada(emitente_cnpj);

-- ===== NFe de Entrada (Itens) =====
CREATE TABLE erp_nfe_entrada_itens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nfe_entrada_id UUID NOT NULL REFERENCES erp_nfe_entrada(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES erp_produtos(id),
  -- Dados do XML
  numero_item INTEGER NOT NULL,
  codigo_produto VARCHAR(60),
  codigo_ean VARCHAR(14),
  nome VARCHAR(255) NOT NULL,
  ncm VARCHAR(10),
  cfop VARCHAR(4),
  unidade VARCHAR(6),
  -- Quantidades e valores
  quantidade DECIMAL(12,4) NOT NULL,
  valor_unitario DECIMAL(12,4) NOT NULL,
  valor_total DECIMAL(12,2) NOT NULL,
  valor_desconto DECIMAL(12,2) DEFAULT 0,
  valor_frete DECIMAL(12,2) DEFAULT 0,
  -- Impostos
  icms_origem VARCHAR(2),
  icms_csosn VARCHAR(3),
  icms_aliquota DECIMAL(5,2) DEFAULT 0,
  icms_valor DECIMAL(12,2) DEFAULT 0,
  ipi_aliquota DECIMAL(5,2) DEFAULT 0,
  ipi_valor DECIMAL(12,2) DEFAULT 0,
  pis_aliquota DECIMAL(5,2) DEFAULT 0,
  pis_valor DECIMAL(12,2) DEFAULT 0,
  cofins_aliquota DECIMAL(5,2) DEFAULT 0,
  cofins_valor DECIMAL(12,2) DEFAULT 0,
  -- Controle de Importação
  produto_criado BOOLEAN DEFAULT false,
  estoque_atualizado BOOLEAN DEFAULT false,
  -- Custo calculado (com impostos)
  custo_unitario_final DECIMAL(12,4),
  -- Metadata
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_nfe_entrada_itens_nfe ON erp_nfe_entrada_itens(nfe_entrada_id);
CREATE INDEX idx_erp_nfe_entrada_itens_produto ON erp_nfe_entrada_itens(produto_id);
CREATE INDEX idx_erp_nfe_entrada_itens_codigo ON erp_nfe_entrada_itens(codigo_produto);
CREATE INDEX idx_erp_nfe_entrada_itens_ean ON erp_nfe_entrada_itens(codigo_ean);

-- ===== View: NFe Entrada com relacionamentos =====
CREATE OR REPLACE VIEW v_erp_nfe_entrada_dashboard AS
SELECT
  n.id,
  n.chave_acesso,
  n.numero,
  n.serie,
  n.data_emissao,
  n.data_entrada,
  n.valor_total,
  n.status,
  n.tipo_manifestacao,
  n.emitente_cnpj,
  n.emitente_nome,
  n.emitente_fantasia,
  p.id as fornecedor_id,
  p.nome_razao as fornecedor_nome,
  l.apelido as loja_apelido,
  (SELECT COUNT(*) FROM erp_nfe_entrada_itens WHERE nfe_entrada_id = n.id) as total_itens,
  (SELECT COUNT(*) FROM erp_nfe_entrada_itens WHERE nfe_entrada_id = n.id AND estoque_atualizado = true) as itens_processados
FROM erp_nfe_entrada n
LEFT JOIN erp_pessoas p ON p.id = n.fornecedor_id
LEFT JOIN erp_lojas l ON l.id = n.loja_id;

-- ===== Trigger para updated_at =====
CREATE TRIGGER update_erp_nfe_entrada_updated_at
  BEFORE UPDATE ON erp_nfe_entrada
  FOR EACH ROW EXECUTE FUNCTION erp_update_updated_at_column();

-- ===== RLS =====
ALTER TABLE erp_nfe_entrada ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_nfe_entrada_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler NFe entrada" ON erp_nfe_entrada FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir NFe entrada" ON erp_nfe_entrada FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar NFe entrada" ON erp_nfe_entrada FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ler itens NFe entrada" ON erp_nfe_entrada_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir itens NFe entrada" ON erp_nfe_entrada_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar itens NFe entrada" ON erp_nfe_entrada_itens FOR UPDATE TO authenticated USING (true);