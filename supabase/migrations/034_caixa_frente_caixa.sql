-- =====================================================
-- Migration 034: Ajustes na tabela erp_caixa + erp_fechamentos_caixa
-- Adiciona colunas faltantes e cria tabela de fechamentos
-- =====================================================

-- ===== Adicionar colunas faltantes em erp_caixa =====
ALTER TABLE erp.erp_caixa ADD COLUMN IF NOT EXISTS numero_caixa INTEGER DEFAULT 1;
ALTER TABLE erp.erp_caixa ADD COLUMN IF NOT EXISTS valor_troco NUMERIC(12,2) DEFAULT 0;
ALTER TABLE erp.erp_caixa ADD COLUMN IF NOT EXISTS encerrado_por UUID REFERENCES erp.erp_usuarios(id);
ALTER TABLE erp.erp_caixa ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Garantir que numero_caixa tenha valor padrão
UPDATE erp.erp_caixa SET numero_caixa = 1 WHERE numero_caixa IS NULL;
ALTER TABLE erp.erp_caixa ALTER COLUMN numero_caixa SET NOT NULL;

-- ===== Criar tabela erp_fechamentos_caixa =====
CREATE TABLE IF NOT EXISTS erp.erp_fechamentos_caixa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caixa_id UUID NOT NULL REFERENCES erp.erp_caixa(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES erp.erp_usuarios(id),
  data_fechamento TIMESTAMPTZ DEFAULT NOW(),
  valor_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_final NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_vendas NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_sangrias NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_entradas NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_troco NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_dinheiro NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_pix NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_cartao_credito NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_cartao_debito NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_crediario NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_boleto NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_outros NUMERIC(12,2) NOT NULL DEFAULT 0,
  diferenca NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erp_fechamentos_caixa_caixa ON erp.erp_fechamentos_caixa(caixa_id);
CREATE INDEX IF NOT EXISTS idx_erp_fechamentos_caixa_usuario ON erp.erp_fechamentos_caixa(usuario_id);
CREATE INDEX IF NOT EXISTS idx_erp_fechamentos_caixa_data ON erp.erp_fechamentos_caixa(data_fechamento DESC);

-- ===== RLS para erp_fechamentos_caixa =====
ALTER TABLE erp.erp_fechamentos_caixa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "erp_user_select_fechamentos" ON erp.erp_fechamentos_caixa;
CREATE POLICY "erp_user_select_fechamentos" ON erp.erp_fechamentos_caixa
  FOR SELECT TO authenticated
  USING (erp.current_erp_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "erp_admin_write_fechamentos" ON erp.erp_fechamentos_caixa;
CREATE POLICY "erp_admin_write_fechamentos" ON erp.erp_fechamentos_caixa
  FOR ALL TO authenticated
  USING (erp.is_erp_admin())
  WITH CHECK (erp.is_erp_admin());

DROP POLICY IF EXISTS "erp_user_insert_fechamentos" ON erp.erp_fechamentos_caixa;
CREATE POLICY "erp_user_insert_fechamentos" ON erp.erp_fechamentos_caixa
  FOR INSERT TO authenticated
  WITH CHECK (erp.current_erp_user_id() IS NOT NULL);

-- ===== Atualizar políticas de erp_caixa para permitir INSERT/UPDATE =====
DROP POLICY IF EXISTS "erp_admin_write" ON erp.erp_caixa;
CREATE POLICY "erp_admin_write" ON erp.erp_caixa
  FOR ALL TO authenticated
  USING (erp.is_erp_admin())
  WITH CHECK (erp.is_erp_admin());

DROP POLICY IF EXISTS "erp_user_insert_caixa" ON erp.erp_caixa;
CREATE POLICY "erp_user_insert_caixa" ON erp.erp_caixa
  FOR INSERT TO authenticated
  WITH CHECK (erp.current_erp_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "erp_user_update_caixa" ON erp.erp_caixa;
CREATE POLICY "erp_user_update_caixa" ON erp.erp_caixa
  FOR UPDATE TO authenticated
  USING (erp.current_erp_user_id() IS NOT NULL);

-- ===== Comentários =====
COMMENT ON TABLE erp.erp_caixa IS 'Caixas do PDV - controle de abertura/fechamento de caixa';
COMMENT ON TABLE erp.erp_fechamentos_caixa IS 'Histórico de fechamentos de caixa';