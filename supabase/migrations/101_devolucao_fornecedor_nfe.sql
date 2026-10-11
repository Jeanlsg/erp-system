-- ============================================================
-- 101 — devolução a fornecedor pronta para virar NF-e
--
-- A tela registrava a devolução e baixava o estoque, mas não emitia nota.
-- Para emitir faltavam, por item: a base do ICMS (a loja pediu "base de
-- cálculo, alíquota e ICMS da operação", como no sistema anterior) e o
-- número do item na nota de compra — desde a NT 2025.002 (regra VC02-14) a
-- devolução referencia a nota original POR ITEM (DFeReferenciado), e o
-- refNFe no cabeçalho é recusado.
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE erp.erp_devolucao_fornecedor_itens
  ADD COLUMN IF NOT EXISTS icms_base numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS item_nota_origem integer;

COMMENT ON COLUMN erp.erp_devolucao_fornecedor_itens.item_nota_origem IS
  'nItem do produto na nota de compra (DFeReferenciado da NF-e de devolução). Vem da nota de entrada importada ou é digitado.';

-- quem já veio de nota de entrada importada herda o número do item
UPDATE erp.erp_devolucao_fornecedor_itens d
   SET item_nota_origem = e.numero_item
  FROM erp.erp_nfe_entrada_itens e
 WHERE d.nfe_item_id = e.id AND d.item_nota_origem IS NULL;

NOTIFY pgrst, 'reload schema';
COMMIT;
