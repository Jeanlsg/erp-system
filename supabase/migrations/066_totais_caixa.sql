-- ============================================================
-- 066: Fechamento de caixa passa a somar o movimento do dia.
--
-- As colunas total_vendas, total_sangrias, total_entradas_extras e
-- valor_troco existiam em erp_caixa e NUNCA eram alimentadas: nenhum
-- gatilho as atualizava. O PDV lia essas colunas para montar o
-- "Valor Esperado em Gaveta", então o esperado era sempre igual ao
-- saldo inicial — e todo fechamento acusaria quebra do tamanho do
-- movimento do dia. Encontrado na auditoria (BUG-01-05): caixa com
-- R$ 100 inicial, R$ 6,00 vendidos, R$ 20 de sangria e R$ 50 de
-- entrada mostrava R$ 100 esperados, em vez de R$ 136.
--
-- A correção calcula na FONTE, somando as tabelas pelo caixa_id, em
-- vez de manter contadores. Assim vale para a venda offline que
-- sincroniza depois e para qualquer outro caminho que grave venda —
-- contador desatualiza em silêncio, soma não.
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE OR REPLACE VIEW erp.vw_caixa_resumo AS
SELECT
  c.*,
  -- os "total_*" abaixo sobrescrevem os da tabela: quem manda é a soma
  COALESCE(v.vendas, 0)          AS total_vendas_real,
  COALESCE(v.troco, 0)           AS valor_troco_real,
  COALESCE(s.sangrias, 0)        AS total_sangrias_real,
  COALESCE(e.entradas, 0)        AS total_entradas_extras_real,
  c.valor_inicial
    + COALESCE(v.vendas, 0)
    - COALESCE(s.sangrias, 0)
    + COALESCE(e.entradas, 0)
    - COALESCE(v.troco, 0)       AS valor_esperado_gaveta
FROM erp.erp_caixa c
LEFT JOIN LATERAL (
  SELECT SUM(x.total) AS vendas, SUM(x.troco) AS troco
    FROM erp.erp_vendas x
   WHERE x.caixa_id = c.id AND x.status::text = 'finalizada'
) v ON true
LEFT JOIN LATERAL (
  SELECT SUM(x.valor) AS sangrias FROM erp.erp_sangrias x WHERE x.caixa_id = c.id
) s ON true
LEFT JOIN LATERAL (
  SELECT SUM(x.valor) AS entradas FROM erp.erp_entradas_extras x WHERE x.caixa_id = c.id
) e ON true;

COMMENT ON VIEW erp.vw_caixa_resumo IS
  'Caixa com o movimento somado das tabelas (vendas, sangrias, entradas) e o valor esperado em gaveta.';

GRANT SELECT ON erp.vw_caixa_resumo TO authenticated, service_role;

-- ---------- fechamento grava os totais reais ----------
-- O histórico do caixa fechado precisa do número congelado: depois de
-- fechado, ninguém deveria recalcular para conferir o passado.
CREATE OR REPLACE FUNCTION erp.fechar_caixa_com_totais(p_caixa_id uuid, p_valor_final numeric, p_observacoes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM erp.vw_caixa_resumo WHERE id = p_caixa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'caixa não encontrado'; END IF;
  IF r.status::text <> 'aberto' THEN RAISE EXCEPTION 'este caixa já está %', r.status; END IF;

  UPDATE erp.erp_caixa SET
    status = 'fechado',
    data_fechamento = now(),
    encerrado_por = auth.uid(),
    valor_final = p_valor_final,
    total_vendas = r.total_vendas_real,
    total_sangrias = r.total_sangrias_real,
    total_entradas_extras = r.total_entradas_extras_real,
    valor_troco = r.valor_troco_real,
    observacoes = COALESCE(p_observacoes, observacoes)
  WHERE id = p_caixa_id;

  RETURN jsonb_build_object(
    'esperado', r.valor_esperado_gaveta,
    'contado', p_valor_final,
    'diferenca', p_valor_final - r.valor_esperado_gaveta,
    'vendas', r.total_vendas_real,
    'sangrias', r.total_sangrias_real,
    'entradas', r.total_entradas_extras_real);
END;
$$;

REVOKE ALL ON FUNCTION erp.fechar_caixa_com_totais(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION erp.fechar_caixa_com_totais(uuid, numeric, text) TO authenticated, service_role;

-- ---------- conferência com o caixa da auditoria ----------
SELECT 'caixa #' || numero_caixa || ': inicial R$ ' || valor_inicial
    || ' + vendas R$ ' || total_vendas_real
    || ' - sangrias R$ ' || total_sangrias_real
    || ' + entradas R$ ' || total_entradas_extras_real
    || ' = esperado R$ ' || valor_esperado_gaveta
  FROM erp.vw_caixa_resumo ORDER BY data_abertura DESC LIMIT 1;
