-- =====================================================
-- ERP System · Veículos (Frota)
-- Migration: 024_veiculos.sql
-- =====================================================

-- ===== VEÍCULOS =====
CREATE TABLE erp_veiculos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID REFERENCES erp_lojas(id),
  placa VARCHAR(15) UNIQUE NOT NULL,
  chassi VARCHAR(50),
  renavam VARCHAR(20),
  marca VARCHAR(50),
  modelo VARCHAR(50),
  ano_fabricacao INTEGER,
  ano_modelo INTEGER,
  cor VARCHAR(30),
  km_atual INTEGER DEFAULT 0,
  tipo_combustivel VARCHAR(20), -- gasolina, etanol, diesel, flex, gnv, eletrico
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

-- ===== ABASTECIMENTOS =====
CREATE TABLE erp_veiculo_abastecimentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  veiculo_id UUID NOT NULL REFERENCES erp_veiculos(id) ON DELETE CASCADE,
  data_abastecimento TIMESTAMPTZ DEFAULT NOW(),
  km_abastecimento INTEGER NOT NULL,
  litros DECIMAL(10,3) NOT NULL,
  valor_total DECIMAL(12,2) NOT NULL,
  preco_litro DECIMAL(10,3) NOT NULL,
  posto VARCHAR(100),
  motorista_id UUID REFERENCES erp_funcionarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== MANUTENÇÕES =====
CREATE TABLE erp_veiculo_manutencoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  veiculo_id UUID NOT NULL REFERENCES erp_veiculos(id) ON DELETE CASCADE,
  tipo VARCHAR(50), -- troca_oleo, revisao, pne, alinhamento, etc
  data_manutencao DATE NOT NULL,
  km_manutencao INTEGER,
  descricao TEXT,
  valor DECIMAL(12,2),
  oficina VARCHAR(100),
  proxima_km INTEGER,
  proxima_data DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== INDEXES =====
CREATE INDEX idx_erp_veiculos_loja ON erp_veiculos(loja_id);
CREATE INDEX idx_erp_veiculos_placa ON erp_veiculos(placa);
CREATE INDEX idx_erp_veiculos_status ON erp_veiculos(status);
CREATE INDEX idx_erp_veiculo_abastecimentos_veiculo ON erp_veiculo_abastecimentos(veiculo_id);
CREATE INDEX idx_erp_veiculo_manutencoes_veiculo ON erp_veiculo_manutencoes(veiculo_id);

-- ===== TRIGGER updated_at =====
CREATE OR REPLACE FUNCTION erp_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_erp_veiculos_updated_at ON erp_veiculos;
CREATE TRIGGER trg_erp_veiculos_updated_at
  BEFORE UPDATE ON erp_veiculos
  FOR EACH ROW EXECUTE FUNCTION erp_set_updated_at();

-- ===== RLS =====
ALTER TABLE erp_veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_veiculo_abastecimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_veiculo_manutencoes ENABLE ROW LEVEL SECURITY;

-- Policies (mesmo padrão das outras tabelas - leitura para autenticados, escrita para usuários ativos)
CREATE POLICY "veiculos_select_authenticated" ON erp_veiculos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "veiculos_insert_authenticated" ON erp_veiculos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "veiculos_update_authenticated" ON erp_veiculos
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "veiculos_delete_authenticated" ON erp_veiculos
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "veiculo_abastecimentos_all" ON erp_veiculo_abastecimentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "veiculo_manutencoes_all" ON erp_veiculo_manutencoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);