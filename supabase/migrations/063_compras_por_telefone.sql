-- ============================================================
-- 063: Quantas compras cada cliente fez — contado por TELEFONE.
--
-- O lead do CRM é identificado pelo telefone, e o mesmo cliente
-- costuma ter mais de um cadastro no ERP (comprou no balcão, depois
-- pelo delivery, e alguém digitou o nome diferente). Contar por
-- cliente_id devolveria "1ª compra" para quem já comprou cinco vezes.
-- Aqui a contagem é feita pela CHAVE DO TELEFONE — DDD + os 8 últimos
-- dígitos — que junta os cadastros da mesma pessoa e absorve as duas
-- grafias do celular (com e sem o 9).
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '120s';

-- ---------- chave de comparação ----------
CREATE OR REPLACE FUNCTION erp.chave_telefone(p_telefone text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  WITH d AS (
    SELECT regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g') AS n
  )
  SELECT CASE
    WHEN length(n) < 10 THEN NULL          -- sem DDD não dá para comparar
    -- tira o DDI 55 quando ele existe, guarda DDD + 8 dígitos finais
    ELSE substr(regexp_replace(n, '^55', ''), 1, 2) || right(n, 8)
  END
  FROM d;
$$;

COMMENT ON FUNCTION erp.chave_telefone(text) IS
  'DDD + 8 últimos dígitos. Junta cadastros do mesmo telefone e ignora a diferença do 9º dígito.';

-- Busca por telefone acontece a cada venda sincronizada: sem índice ela
-- varre a tabela inteira de pessoas.
CREATE INDEX IF NOT EXISTS idx_erp_pessoas_chave_telefone
  ON erp.erp_pessoas (erp.chave_telefone(coalesce(nullif(celular, ''), telefone)));

-- ---------- resumo de compras de um telefone ----------
CREATE OR REPLACE FUNCTION erp.resumo_compras_telefone(p_telefone text)
RETURNS TABLE (compras integer, total numeric, primeira date, ultima date)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = erp, public
AS $$
  WITH alvo AS (SELECT erp.chave_telefone(p_telefone) AS k),
  pessoas AS (
    SELECT p.id FROM erp.erp_pessoas p, alvo
     WHERE alvo.k IS NOT NULL
       AND erp.chave_telefone(coalesce(nullif(p.celular, ''), p.telefone)) = alvo.k
  )
  SELECT
    count(*)::integer,
    coalesce(sum(v.total), 0)::numeric,
    min(v.data_venda)::date,
    max(v.data_venda)::date
  FROM erp.erp_vendas v
  WHERE v.cliente_id IN (SELECT id FROM pessoas)
    AND v.status::text = 'finalizada';
$$;

COMMENT ON FUNCTION erp.resumo_compras_telefone(text) IS
  'Compras finalizadas de TODOS os cadastros que compartilham o telefone: quantidade, total gasto, primeira e última compra.';

REVOKE ALL ON FUNCTION erp.chave_telefone(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION erp.resumo_compras_telefone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION erp.chave_telefone(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION erp.resumo_compras_telefone(text) TO authenticated, service_role;

-- ---------- clientes com o histórico junto (tela de Clientes) ----------
-- Assim a tela mostra "5 compras · R$ 1.240" sem ninguém consultar nada.
CREATE OR REPLACE VIEW erp.vw_clientes_compras AS
SELECT
  p.id,
  p.nome_razao,
  p.cpf_cnpj,
  p.email,
  p.telefone,
  p.celular,
  p.tipo,
  p.ativo,
  erp.chave_telefone(coalesce(nullif(p.celular, ''), p.telefone)) AS chave_telefone,
  coalesce(r.compras, 0)  AS compras,
  coalesce(r.total, 0)    AS total_gasto,
  r.primeira              AS primeira_compra,
  r.ultima                AS ultima_compra
FROM erp.erp_pessoas p
LEFT JOIN LATERAL erp.resumo_compras_telefone(
  coalesce(nullif(p.celular, ''), p.telefone)
) r ON true;

GRANT SELECT ON erp.vw_clientes_compras TO authenticated, service_role;

-- conferência
SELECT 'clientes com pelo menos 1 compra: ' || count(*) FROM erp.vw_clientes_compras WHERE compras > 0;
