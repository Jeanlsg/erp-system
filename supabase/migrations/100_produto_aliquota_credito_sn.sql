-- ============================================================
-- 100 — alíquota de crédito do Simples no produto (CSOSN 101)
--
-- O cadastro oferecia CSOSN 101 ("com permissão de crédito"), mas a nota de
-- um produto 101 exige pCredSN e vCredICMSSN, e o sistema não tinha onde
-- guardar a alíquota de crédito — a nota seria recusada no schema. A
-- alíquota vem da faixa do Simples, informada pela contadora.
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE erp.erp_produtos
  ADD COLUMN IF NOT EXISTS aliquota_credito_sn numeric(5,2);
COMMENT ON COLUMN erp.erp_produtos.aliquota_credito_sn IS
  'Alíquota de crédito do ICMS no Simples (pCredSN), usada com CSOSN 101.';
NOTIFY pgrst, 'reload schema';
COMMIT;
