-- ============================================================
-- 103 — CST do regime normal e PIS/COFINS no produto; regime (CRT) da
-- loja; XML guardado de cancelamento, CC-e e inutilização.
--
-- Pedido da loja (10/10/2026, item 8): tributos completos no produto. Já
-- havia as alíquotas de PIS e COFINS (pis, cofins) sem tela e sem CST, e a
-- nota saía sempre CST 49. O CST do ICMS (regime normal) só vale com a loja
-- fora do Simples — o regime agora é da configuração SEFAZ da loja, não
-- mais fixo na edge.
--
-- Item 6 (contadora): o XML do evento de cancelamento e o da inutilização
-- não eram guardados; o ZIP do mês saía sem eles.
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE erp.erp_produtos
  ADD COLUMN IF NOT EXISTS cst_icms   varchar(3),
  ADD COLUMN IF NOT EXISTS cst_pis    varchar(2),
  ADD COLUMN IF NOT EXISTS cst_cofins varchar(2);
COMMENT ON COLUMN erp.erp_produtos.cst_icms   IS 'CST do ICMS (regime normal, CRT 2/3). No Simples vale o csosn.';
COMMENT ON COLUMN erp.erp_produtos.cst_pis    IS 'CST do PIS; vazio = 49 no Simples, 01 no regime normal. Alíquota em pis.';
COMMENT ON COLUMN erp.erp_produtos.cst_cofins IS 'CST da COFINS; vazio = 49 no Simples, 01 no regime normal. Alíquota em cofins.';

ALTER TABLE erp.erp_configuracoes_sefaz
  ADD COLUMN IF NOT EXISTS crt smallint NOT NULL DEFAULT 1;
DO $$ BEGIN
  ALTER TABLE erp.erp_configuracoes_sefaz
    ADD CONSTRAINT erp_configuracoes_sefaz_crt_check CHECK (crt IN (1, 2, 3, 4));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
COMMENT ON COLUMN erp.erp_configuracoes_sefaz.crt IS
  'Regime tributário: 1 Simples, 2 Simples com excesso de sublimite, 3 Normal, 4 MEI.';

ALTER TABLE erp.erp_nfe_eventos  ADD COLUMN IF NOT EXISTS xml_path text;
ALTER TABLE erp.erp_inutilizacoes ADD COLUMN IF NOT EXISTS xml_path text;

NOTIFY pgrst, 'reload schema';
COMMIT;
