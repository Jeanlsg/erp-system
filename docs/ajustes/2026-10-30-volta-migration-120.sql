-- ============================================================
-- Volta da migration 120 (comissão dinâmica).
--
-- Deixa o banco como depois da 119: recálculo da 107 (refaz o mês inteiro
-- a cada venda de quem tem faixa), situacao_faixa_* sem trava e fora do
-- authenticated (como a 118 deixou), sem o relatório. As faixas
-- cadastradas e as comissões não são tocadas.
--
-- ssh "$ERP_SSH_HOST" "docker exec -i $ERP_DB_CONTAINER psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1" < docs/ajustes/2026-10-30-volta-migration-120.sql
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

DROP FUNCTION IF EXISTS erp.relatorio_comissao_dinamica(date);

-- recalcular_comissao_venda exatamente como na 107
CREATE OR REPLACE FUNCTION erp.recalcular_comissao_venda(p_venda_id uuid, p_propagar boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'erp', 'public'
AS $$
DECLARE
  v             erp.erp_vendas%ROWTYPE;
  v_pct         numeric := 0;   -- geral do funcionário
  v_pct_serv    numeric := 0;   -- serviço fixo do funcionário
  v_prod_total  numeric := 0;
  v_produtos    numeric := 0;
  v_pct_prod    numeric;
  v_serv_total  numeric := 0;
  v_servicos    numeric := 0;
  v_pct_efet    numeric;
  v_faixa       boolean := false;   -- faixa de serviço
  v_faixa_venda boolean := false;   -- faixa de produtos
  v_val         numeric := 0;
  outra         record;
BEGIN
  SELECT * INTO v FROM erp.erp_vendas WHERE id = p_venda_id;
  IF NOT FOUND OR v.vendedor_id IS NULL THEN RETURN; END IF;

  v_faixa := erp.tem_faixa_servico(v.vendedor_id);
  v_faixa_venda := erp.tem_faixa_venda(v.vendedor_id);

  IF v.status::text IN ('cancelada', 'devolvida') THEN
    UPDATE erp.erp_comissoes SET status = 'cancelada'
     WHERE venda_id = p_venda_id AND status = 'pendente';
    -- cancelar pode derrubar a faixa do mês: refaz as outras do mês
    IF p_propagar AND (v_faixa OR v_faixa_venda) THEN
      FOR outra IN
        SELECT x.id FROM erp.erp_vendas x
        WHERE x.vendedor_id = v.vendedor_id AND x.id <> p_venda_id
          AND x.status::text = 'finalizada'
          AND date_trunc('month', x.data_venda::date) = date_trunc('month', v.data_venda::date)
      LOOP
        PERFORM erp.recalcular_comissao_venda(outra.id, false);
      END LOOP;
    END IF;
    RETURN;
  END IF;
  IF v.status::text <> 'finalizada' THEN RETURN; END IF;

  SELECT COALESCE(f.comissao_percentual, 0),
         COALESCE(NULLIF(f.comissao_percentual_servico, 0), f.comissao_percentual, 0)
    INTO v_pct, v_pct_serv
    FROM erp.erp_funcionarios f WHERE f.id = v.vendedor_id;

  -- ── produtos ──
  SELECT COALESCE(SUM(COALESCE(i.valor_total, i.subtotal, 0)), 0)
    INTO v_prod_total
    FROM erp.erp_venda_itens i
   WHERE i.venda_id = p_venda_id AND i.servico_id IS NULL;

  IF v_faixa_venda THEN
    -- a faixa do mês vale para todos os produtos do mês
    v_pct_prod := erp.pct_faixa_venda(v.vendedor_id,
                    erp.total_produtos_mes(v.vendedor_id, v.data_venda::date));
    v_produtos := v_prod_total * v_pct_prod / 100;
  ELSE
    SELECT COALESCE(SUM(
             COALESCE(i.valor_total, i.subtotal, 0)
             * COALESCE(NULLIF(p.comissao_percentual, 0), v_pct) / 100), 0)
      INTO v_produtos
      FROM erp.erp_venda_itens i
      LEFT JOIN erp.erp_produtos p ON p.id = i.produto_id
     WHERE i.venda_id = p_venda_id AND i.servico_id IS NULL;
    v_pct_prod := CASE WHEN v_prod_total > 0 THEN round(v_produtos / v_prod_total * 100, 2) END;
  END IF;

  -- ── serviços (097) ──
  SELECT COALESCE(SUM(COALESCE(i.valor_total, i.subtotal, 0)), 0)
    INTO v_serv_total
    FROM erp.erp_venda_itens i
   WHERE i.venda_id = p_venda_id AND i.servico_id IS NOT NULL;

  IF v_serv_total > 0 THEN
    IF v_faixa THEN
      v_pct_efet := erp.pct_faixa_servico(v.vendedor_id,
                      erp.total_servicos_mes(v.vendedor_id, v.data_venda::date));
      v_servicos := v_serv_total * v_pct_efet / 100;
    ELSE
      SELECT COALESCE(SUM(
               COALESCE(i.valor_total, i.subtotal, 0)
               * COALESCE(NULLIF(s.comissao_percentual, 0), v_pct_serv) / 100), 0)
        INTO v_servicos
        FROM erp.erp_venda_itens i
        LEFT JOIN erp.erp_servicos s ON s.id = i.servico_id
       WHERE i.venda_id = p_venda_id AND i.servico_id IS NOT NULL;
      v_pct_efet := round(v_servicos / v_serv_total * 100, 2);
    END IF;
  END IF;

  v_val := v_produtos + v_servicos;

  -- Antes dos itens entrarem (INSERT da venda) usa o total × % do funcionário;
  -- o trigger dos itens refina logo em seguida.
  IF v_val = 0 AND NOT v_faixa_venda AND NOT EXISTS (SELECT 1 FROM erp.erp_venda_itens WHERE venda_id = p_venda_id) THEN
    v_val := COALESCE(v.total, 0) * v_pct / 100;
  END IF;

  IF v_val <= 0 THEN
    DELETE FROM erp.erp_comissoes WHERE venda_id = p_venda_id AND status = 'pendente';
  ELSE
    INSERT INTO erp.erp_comissoes
      (loja_id, funcionario_id, venda_id, data_referencia, valor_venda, percentual_comissao,
       valor_comissao, status, valor_servicos, percentual_servico, faixa_servico,
       valor_produtos, percentual_produto, faixa_venda)
    VALUES
      (v.loja_id, v.vendedor_id, v.id, COALESCE(v.data_venda::date, current_date), v.total,
       CASE WHEN v_faixa_venda THEN v_pct_prod ELSE v_pct END,
       round(v_val, 2), 'pendente',
       NULLIF(v_serv_total, 0), v_pct_efet, v_faixa AND v_serv_total > 0,
       NULLIF(v_prod_total, 0), v_pct_prod, v_faixa_venda AND v_prod_total > 0)
    ON CONFLICT (venda_id) WHERE venda_id IS NOT NULL DO UPDATE
      SET valor_venda = EXCLUDED.valor_venda,
          percentual_comissao = EXCLUDED.percentual_comissao,
          valor_comissao = EXCLUDED.valor_comissao,
          funcionario_id = EXCLUDED.funcionario_id,
          valor_servicos = EXCLUDED.valor_servicos,
          percentual_servico = EXCLUDED.percentual_servico,
          faixa_servico = EXCLUDED.faixa_servico,
          valor_produtos = EXCLUDED.valor_produtos,
          percentual_produto = EXCLUDED.percentual_produto,
          faixa_venda = EXCLUDED.faixa_venda
      WHERE erp.erp_comissoes.status = 'pendente'; -- paga não se mexe
  END IF;

  -- Esta venda pode ter levado o mês a outra faixa: refaz as pendentes do
  -- mês desse funcionário com o percentual novo.
  IF p_propagar AND ((v_faixa AND v_serv_total > 0) OR (v_faixa_venda AND v_prod_total > 0)) THEN
    FOR outra IN
      SELECT x.id FROM erp.erp_vendas x
      WHERE x.vendedor_id = v.vendedor_id AND x.id <> p_venda_id
        AND x.status::text = 'finalizada'
        AND date_trunc('month', x.data_venda::date) = date_trunc('month', v.data_venda::date)
    LOOP
      PERFORM erp.recalcular_comissao_venda(outra.id, false);
    END LOOP;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS erp.faixa_do_mes_desatualizada(uuid, date, uuid);

-- situacao_faixa_* como na 107/097, fechadas como a 118 deixou
CREATE OR REPLACE FUNCTION erp.situacao_faixa_venda(p_funcionario uuid, p_ref date)
RETURNS TABLE(total numeric, percentual numeric, proxima_venda_minima numeric, proximo_percentual numeric, falta numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = erp, public AS $$
  WITH t AS (SELECT erp.total_produtos_mes(p_funcionario, p_ref) AS total),
  prox AS (
    SELECT f.venda_minima, f.percentual FROM erp.erp_comissao_venda_faixas f, t
    WHERE f.funcionario_id = p_funcionario AND f.venda_minima > t.total
    ORDER BY f.venda_minima LIMIT 1)
  SELECT t.total, erp.pct_faixa_venda(p_funcionario, t.total),
         prox.venda_minima, prox.percentual,
         CASE WHEN prox.venda_minima IS NULL THEN NULL ELSE prox.venda_minima - t.total END
  FROM t LEFT JOIN prox ON true;
$$;

CREATE OR REPLACE FUNCTION erp.situacao_faixa_servico(p_funcionario uuid, p_ref date)
RETURNS TABLE(total numeric, percentual numeric, proxima_venda_minima numeric, proximo_percentual numeric, falta numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = erp, public AS $$
  WITH t AS (SELECT erp.total_servicos_mes(p_funcionario, p_ref) AS total),
  prox AS (
    SELECT f.venda_minima, f.percentual FROM erp.erp_comissao_servico_faixas f, t
    WHERE f.funcionario_id = p_funcionario AND f.venda_minima > t.total
    ORDER BY f.venda_minima LIMIT 1)
  SELECT t.total, erp.pct_faixa_servico(p_funcionario, t.total),
         prox.venda_minima, prox.percentual,
         CASE WHEN prox.venda_minima IS NULL THEN NULL ELSE prox.venda_minima - t.total END
  FROM t LEFT JOIN prox ON true;
$$;
REVOKE EXECUTE ON FUNCTION erp.situacao_faixa_venda(uuid, date), erp.situacao_faixa_servico(uuid, date)
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
