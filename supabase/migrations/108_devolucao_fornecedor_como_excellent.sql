-- ============================================================
-- 108 — Devolução a fornecedor no formato do Excellent (11/10/2026)
--
-- A loja mostrou a tela do sistema anterior em vídeo e pediu "igual".
-- Faltavam:
--   · RNTC do veículo, finalidade (devolução ou normal), frete e outras
--     despesas rateados igualmente OU informados por produto, casas
--     decimais do valor unitário e endereço de entrega diferente;
--   · VÁRIAS notas de entrada ("Adicionar outro DANFE"): cada item diz de
--     qual nota veio — a NF-e de devolução referencia a origem por item
--     (DFeReferenciado; refNFe no cabeçalho está proibido desde 05/10/2026,
--     NT 2025.002 regra VC02-14). O nº do item na nota de origem é opcional
--     no leiaute; preenchido quando o XML é conhecido;
--   · por item: desconto em % (o R$ já existia), frete/outras quando o
--     rateio é por produto e o IPI devolvido (percentual e valor).
-- ============================================================

ALTER TABLE erp.erp_devolucoes_fornecedor
  ADD COLUMN IF NOT EXISTS rntc text,
  ADD COLUMN IF NOT EXISTS finalidade smallint NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS rateio_frete text NOT NULL DEFAULT 'igual',
  ADD COLUMN IF NOT EXISTS chaves_origem text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS casas_decimais smallint NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS entrega jsonb;

DO $$ BEGIN
  ALTER TABLE erp.erp_devolucoes_fornecedor
    ADD CONSTRAINT erp_devolucoes_fornecedor_finalidade_check CHECK (finalidade IN (1, 4)),
    ADD CONSTRAINT erp_devolucoes_fornecedor_rateio_check CHECK (rateio_frete IN ('igual', 'por_produto')),
    ADD CONSTRAINT erp_devolucoes_fornecedor_casas_check CHECK (casas_decimais BETWEEN 2 AND 10);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE erp.erp_devolucao_fornecedor_itens
  ADD COLUMN IF NOT EXISTS chave_nota_origem text,
  ADD COLUMN IF NOT EXISTS desconto_percentual numeric(9,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_frete numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outras_despesas numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ipi_devolvido_percentual numeric(7,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ipi_devolvido_valor numeric(14,2) NOT NULL DEFAULT 0;

-- devoluções antigas: a chave única do cabeçalho vale para todos os itens
UPDATE erp.erp_devolucao_fornecedor_itens i
   SET chave_nota_origem = d.chave_nota_origem
  FROM erp.erp_devolucoes_fornecedor d
 WHERE d.id = i.devolucao_id AND i.chave_nota_origem IS NULL AND d.chave_nota_origem IS NOT NULL;
UPDATE erp.erp_devolucoes_fornecedor
   SET chaves_origem = ARRAY[chave_nota_origem]
 WHERE chave_nota_origem IS NOT NULL AND cardinality(chaves_origem) = 0;

NOTIFY pgrst, 'reload schema';
