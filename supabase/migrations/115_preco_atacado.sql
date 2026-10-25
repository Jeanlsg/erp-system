-- ============================================================
-- 115 — valor de atacado no cadastro do produto (pedido da loja, 10/2026)
--
-- O sistema anterior tinha "Valor de atacado" no cadastro do produto, ao
-- lado do valor de venda, e o ERP não tinha onde guardar esse número.
--
-- Por que uma coluna e não as tabelas de preço da 050 (erp_tabelas_preco
-- tipo 'atacado' + erp_tabela_preco_itens): nenhuma tela usa essas tabelas
-- nem a erp.preco_efetivo; guardar um número do produto nelas exigiria criar
-- uma tabela "Atacado" por loja e um item por produto; e a preco_efetivo
-- escolhe a tabela ativa de maior prioridade que não seja de cliente — a
-- tabela "Atacado" viraria o preço padrão de todo mundo no dia em que alguém
-- ligasse a função no PDV. O pedido é um número no cadastro; fica no cadastro.
--
-- Nulo = produto sem preço de atacado (não é "atacado de graça"). Zero é
-- aceito como valor explícito; negativo, não. Por enquanto é informativo: o
-- PDV continua vendendo pelo preco_venda.
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE erp.erp_produtos
  ADD COLUMN IF NOT EXISTS preco_atacado numeric(12,2);

-- Coluna nova e toda nula: a validação do CHECK não tem o que varrer.
DO $$ BEGIN
  ALTER TABLE erp.erp_produtos
    ADD CONSTRAINT erp_produtos_preco_atacado_nao_negativo
    CHECK (preco_atacado IS NULL OR preco_atacado >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN erp.erp_produtos.preco_atacado IS
  'Valor de atacado do produto (R$). Nulo = sem preço de atacado. Informativo: o PDV vende pelo preco_venda.';

NOTIFY pgrst, 'reload schema';
COMMIT;
