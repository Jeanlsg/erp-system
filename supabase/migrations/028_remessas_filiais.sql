-- =====================================================
-- ERP System · Remessas entre Filiais
-- Migration: 028_remessas_filiais.sql
-- =====================================================

-- ===== ENUM =====
CREATE TYPE erp_remessa_status AS ENUM (
  'rascunho', 'nf_emitida', 'em_transito', 'recebida', 'cancelada', 'rejeitada'
);

CREATE TYPE erp_remessa_tipo AS ENUM (
  'remessa', 'retorno', 'transferencia_simples', 'venda_filial'
);

-- ===== Remessas entre Filiais (Cabeçalho) =====
CREATE TABLE erp_remessas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_origem_id UUID NOT NULL REFERENCES erp_lojas(id),
  loja_destino_id UUID NOT NULL REFERENCES erp_lojas(id),
  usuario_id UUID NOT NULL REFERENCES erp_usuarios(id),
  numero_remessa SERIAL,
  tipo erp_remessa_tipo DEFAULT 'remessa',
  data_remessa TIMESTAMPTZ DEFAULT NOW(),
  data_previsao_chegada DATE,
  data_recebimento TIMESTAMPTZ,
  recebido_por UUID REFERENCES erp_usuarios(id),
  -- Valores
  valor_produtos DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_frete DECIMAL(12,2) DEFAULT 0,
  valor_seguro DECIMAL(12,2) DEFAULT 0,
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- CFOP e Natureza da Operação
  cfop VARCHAR(4),
  natureza_operacao VARCHAR(100),
  -- NFe de Remessa (emitida pela origem)
  nfe_remessa_id UUID REFERENCES erp_notas_fiscais(id),
  nfe_remessa_numero INTEGER,
  nfe_remessa_chave VARCHAR(50),
  -- NFe de Retorno (emitida pelo destino)
  nfe_retorno_id UUID REFERENCES erp_notas_fiscais(id),
  -- Vínculo com venda (se for venda entre filiais)
  venda_id UUID REFERENCES erp_vendas(id),
  -- Transportadora
  transportadora_id UUID REFERENCES erp_transportadoras(id),
  -- Status
  status erp_remessa_status DEFAULT 'rascunho',
  motivo_cancelamento TEXT,
  motivo_rejeicao TEXT,
  -- Metadata
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (loja_origem_id <> loja_destino_id)
);

CREATE INDEX idx_erp_remessas_origem ON erp_remessas(loja_origem_id);
CREATE INDEX idx_erp_remessas_destino ON erp_remessas(loja_destino_id);
CREATE INDEX idx_erp_remessas_status ON erp_remessas(status);
CREATE INDEX idx_erp_remessas_data ON erp_remessas(data_remessa);

-- ===== Remessas Itens =====
CREATE TABLE erp_remessa_itens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  remessa_id UUID NOT NULL REFERENCES erp_remessas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES erp_produtos(id),
  -- Dados do produto
  codigo_produto VARCHAR(60),
  nome_produto VARCHAR(255),
  -- Quantidade e valores
  quantidade DECIMAL(12,4) NOT NULL,
  preco_custo DECIMAL(12,4) NOT NULL,
  preco_venda_praticado DECIMAL(12,4),
  subtotal DECIMAL(12,2) NOT NULL,
  -- Controle de estoque
  estoque_origem_baixado BOOLEAN DEFAULT false,
  estoque_destino_adicionado BOOLEAN DEFAULT false,
  data_baixa_origem TIMESTAMPTZ,
  data_entrada_destino TIMESTAMPTZ,
  -- Lote (se aplicável)
  lote_id UUID REFERENCES erp_lotes(id),
  -- Metadata
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_remessa_itens_remessa ON erp_remessa_itens(remessa_id);
CREATE INDEX idx_erp_remessa_itens_produto ON erp_remessa_itens(produto_id);

-- ===== View Consolidada para Dashboard =====
CREATE OR REPLACE VIEW v_erp_remessas_dashboard AS
SELECT
  r.id,
  r.numero_remessa,
  r.tipo,
  r.status,
  r.data_remessa,
  r.data_previsao_chegada,
  r.data_recebimento,
  r.valor_total,
  r.cfop_utilizado as cfop,
  r.natureza_operacao,
  r.nfe_remessa_numero,
  r.nfe_remessa_chave,
  r.nfe_retorno_id,
  o.id as origem_id,
  o.nome as origem_nome,
  o.apelido as origem_apelido,
  o.cnpj as origem_cnpj,
  o.uf as origem_uf,
  d.id as destino_id,
  d.nome as destino_nome,
  d.apelido as destino_apelido,
  d.cnpj as destino_cnpj,
  d.uf as destino_uf,
  u.nome as usuario_nome,
  (SELECT COUNT(*) FROM erp_remessa_itens WHERE remessa_id = r.id) as total_itens,
  CASE
    WHEN o.uf = d.uf THEN true
    ELSE false
  END as mesma_uf
FROM erp_remessas r
JOIN erp_lojas o ON o.id = r.loja_origem_id
JOIN erp_lojas d ON d.id = r.loja_destino_id
LEFT JOIN erp_usuarios u ON u.id = r.usuario_id;

-- ===== Função para CFOP automático =====
CREATE OR REPLACE FUNCTION erp_calcular_cfop_remessa(
  p_origem_uf VARCHAR(2),
  p_destino_uf VARCHAR(2),
  p_tipo VARCHAR(20)
)
RETURNS VARCHAR(4) AS $$
BEGIN
  IF p_tipo = 'retorno' THEN
    IF p_origem_uf = p_destino_uf THEN
      RETURN '5202';
    ELSE
      RETURN '6202';
    END IF;
  ELSE
    IF p_origem_uf = p_destino_uf THEN
      RETURN '5152';
    ELSE
      RETURN '6152';
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ===== Trigger para updated_at =====
CREATE TRIGGER update_erp_remessas_updated_at
  BEFORE UPDATE ON erp_remessas
  FOR EACH ROW EXECUTE FUNCTION erp_update_updated_at_column();

-- ===== RLS =====
ALTER TABLE erp_remessas ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_remessa_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler remessas" ON erp_remessas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir remessas" ON erp_remessas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar remessas" ON erp_remessas FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ler itens remessa" ON erp_remessa_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir itens remessa" ON erp_remessa_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar itens remessa" ON erp_remessa_itens FOR UPDATE TO authenticated USING (true);

-- ===== Seed de CFOPs padrão =====
INSERT INTO erp_configuracoes_sistema (chave, valor, tipo, categoria, descricao) VALUES
  ('cfop_remessa_mesma_uf', '5152', 'texto', 'fiscal', 'CFOP para remessa entre filiais mesma UF'),
  ('cfop_remessa_outra_uf', '6152', 'texto', 'fiscal', 'CFOP para remessa entre filiais UFs diferentes'),
  ('cfop_retorno_mesma_uf', '5202', 'texto', 'fiscal', 'CFOP para retorno de remessa mesma UF'),
  ('cfop_retorno_outra_uf', '6202', 'texto', 'fiscal', 'CFOP para retorno de remessa UFs diferentes'),
  ('cfop_venda_filial_mesma_uf', '5102', 'texto', 'fiscal', 'CFOP para venda entre filiais mesma UF'),
  ('cfop_venda_filial_outra_uf', '6102', 'texto', 'fiscal', 'CFOP para venda entre filiais UFs diferentes');