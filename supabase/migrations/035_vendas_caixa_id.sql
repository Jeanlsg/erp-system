-- =====================================================
-- Migration 035: Adicionar caixa_id em erp_vendas
-- =====================================================

ALTER TABLE erp.erp_vendas ADD COLUMN IF NOT EXISTS caixa_id UUID REFERENCES erp.erp_caixa(id);

CREATE INDEX IF NOT EXISTS idx_erp_vendas_caixa ON erp.erp_vendas(caixa_id);

COMMENT ON COLUMN erp.erp_vendas.caixa_id IS 'Caixa PDV associado à venda (para controle de fluxo de caixa)';