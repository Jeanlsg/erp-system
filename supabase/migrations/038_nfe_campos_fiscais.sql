-- ============================================================================
-- 038 · NF-e real — campos fiscais e infraestrutura (PLANO_NFE_SELFHOSTED.md)
-- ============================================================================

-- Campos fiscais no produto (NCM é OBRIGATÓRIO no XML da NF-e — sem ele, cStat 778)
ALTER TABLE erp.erp_produtos
  ADD COLUMN IF NOT EXISTS ncm         VARCHAR(8),
  ADD COLUMN IF NOT EXISTS cest        VARCHAR(7),
  ADD COLUMN IF NOT EXISTS cfop_padrao VARCHAR(4) DEFAULT '5102',
  ADD COLUMN IF NOT EXISTS csosn       VARCHAR(4) DEFAULT '102',
  ADD COLUMN IF NOT EXISTS origem_mercadoria SMALLINT DEFAULT 0; -- 0=nacional

-- Resultado real da SEFAZ na nota
ALTER TABLE erp.erp_notas_fiscais
  ADD COLUMN IF NOT EXISTS xml_path   TEXT,
  ADD COLUMN IF NOT EXISTS danfe_path TEXT,
  ADD COLUMN IF NOT EXISTS cstat      VARCHAR(4),
  ADD COLUMN IF NOT EXISTS tentativas INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS destinatario_id UUID REFERENCES erp.erp_pessoas(id);

CREATE INDEX IF NOT EXISTS idx_erp_nf_destinatario ON erp.erp_notas_fiscais (destinatario_id) WHERE destinatario_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_nf_cstat ON erp.erp_notas_fiscais (cstat);

-- Bucket para XML autorizado + DANFE (guarda legal: 5 anos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fiscal', 'fiscal', false)
ON CONFLICT (id) DO NOTHING;

-- Acesso ao bucket fiscal: apenas usuários do ERP (leitura); escrita só service_role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='erp_fiscal_select') THEN
    CREATE POLICY erp_fiscal_select ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'fiscal' AND (SELECT erp.current_erp_user_id()) IS NOT NULL);
  END IF;
END $$;

ANALYZE erp.erp_produtos, erp.erp_notas_fiscais;
NOTIFY pgrst, 'reload schema';
