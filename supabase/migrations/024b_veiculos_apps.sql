-- Aplica migrations 024, 025, 026 com search_path=erp
-- (Necessario pq 024 e 025 foram escritas sem prefixo de schema)

SET search_path TO erp, public;

-- ===== 024 - VEICULOS =====
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
  tipo_combustivel VARCHAR(20),
  capacidade_carga DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'ativo',
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

CREATE TABLE erp_veiculo_manutencoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  veiculo_id UUID NOT NULL REFERENCES erp_veiculos(id) ON DELETE CASCADE,
  tipo VARCHAR(50),
  data_manutencao DATE NOT NULL,
  km_manutencao INTEGER,
  descricao TEXT,
  valor DECIMAL(12,2),
  oficina VARCHAR(100),
  proxima_km INTEGER,
  proxima_data DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_veiculos_loja ON erp_veiculos(loja_id);
CREATE INDEX idx_erp_veiculos_placa ON erp_veiculos(placa);
CREATE INDEX idx_erp_veiculos_status ON erp_veiculos(status);
CREATE INDEX idx_erp_veiculo_abastecimentos_veiculo ON erp_veiculo_abastecimentos(veiculo_id);
CREATE INDEX idx_erp_veiculo_manutencoes_veiculo ON erp_veiculo_manutencoes(veiculo_id);

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

-- Removido: a migration 021 ja endureceu as policies no schema erp.
-- Vamos recriar policies consistentes com o padrao (somente admin/gerente escreve, autenticado le)
DO $$
BEGIN
  DROP POLICY IF EXISTS "veiculos_select_authenticated" ON erp.erp_veiculos;
  DROP POLICY IF EXISTS "veiculos_insert_authenticated" ON erp.erp_veiculos;
  DROP POLICY IF EXISTS "veiculos_update_authenticated" ON erp.erp_veiculos;
  DROP POLICY IF EXISTS "veiculos_delete_authenticated" ON erp.erp_veiculos;
  DROP POLICY IF EXISTS "veiculo_abastecimentos_all" ON erp.erp_veiculo_abastecimentos;
  DROP POLICY IF EXISTS "veiculo_manutencoes_all" ON erp.erp_veiculo_manutencoes;
END $$;

ALTER TABLE erp.erp_veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_veiculo_abastecimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_veiculo_manutencoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_user_select" ON erp.erp_veiculos FOR SELECT TO authenticated USING (erp.current_erp_user_id() IS NOT NULL);
CREATE POLICY "erp_admin_write" ON erp.erp_veiculos FOR ALL TO authenticated USING (erp.is_erp_admin()) WITH CHECK (erp.is_erp_admin());

CREATE POLICY "erp_user_select" ON erp.erp_veiculo_abastecimentos FOR SELECT TO authenticated USING (erp.current_erp_user_id() IS NOT NULL);
CREATE POLICY "erp_admin_write" ON erp.erp_veiculo_abastecimentos FOR ALL TO authenticated USING (erp.is_erp_admin()) WITH CHECK (erp.is_erp_admin());

CREATE POLICY "erp_user_select" ON erp.erp_veiculo_manutencoes FOR SELECT TO authenticated USING (erp.current_erp_user_id() IS NOT NULL);
CREATE POLICY "erp_admin_write" ON erp.erp_veiculo_manutencoes FOR ALL TO authenticated USING (erp.is_erp_admin()) WITH CHECK (erp.is_erp_admin());

SELECT '024_veiculos aplicada com sucesso' AS status;