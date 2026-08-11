-- 039 · Código IBGE do município do emitente (obrigatório no XML da NF-e: cMunFG/enderEmit)
ALTER TABLE erp.erp_lojas
  ADD COLUMN IF NOT EXISTS codigo_municipio_ibge VARCHAR(7);

-- Seed das lojas atuais
UPDATE erp.erp_lojas SET codigo_municipio_ibge = '2918407' WHERE cidade ILIKE 'juazeiro'  AND uf = 'BA' AND codigo_municipio_ibge IS NULL;
UPDATE erp.erp_lojas SET codigo_municipio_ibge = '2611101' WHERE cidade ILIKE 'petrolina' AND uf = 'PE' AND codigo_municipio_ibge IS NULL;

NOTIFY pgrst, 'reload schema';
