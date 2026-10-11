-- ============================================================
-- 107 — Comissão sobre VENDAS (produtos) por faixa, por funcionário
--
-- Pedido do Jean (11/10/2026): "a comissão personalizada é a partir das
-- vendas: se atingir X em vendas ganha X%, e vai mudando de faixa como
-- cálculo de frete". A 097 já fazia isso para serviços; aqui o mesmo para os
-- produtos vendidos.
--
-- Regra (a mesma dos serviços): o total de produtos que o funcionário
-- vendeu no MÊS define a faixa, e o percentual dessa faixa vale para TODOS os
-- produtos que ele vendeu no mês — bateu a meta, o mês inteiro sobe de
-- patamar. Cada venda nova (ou cancelada) recalcula as comissões PENDENTES
-- do mês dele; comissão já paga não se mexe.
--
-- Sem faixa cadastrada, nada muda: produto comissiona pelo percentual do
-- produto, senão o geral do funcionário.
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS erp.erp_comissao_venda_faixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES erp.erp_funcionarios(id) ON DELETE CASCADE,
  -- "a partir de": total de produtos vendidos no mês
  venda_minima numeric(12,2) NOT NULL CHECK (venda_minima >= 0),
  percentual numeric(5,2) NOT NULL CHECK (percentual >= 0 AND percentual <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, venda_minima)
);
ALTER TABLE erp.erp_comissao_venda_faixas ENABLE ROW LEVEL SECURITY;
-- dado de pagamento: mesmo critério das faixas de serviço (097)
DROP POLICY IF EXISTS erp_comissao_venda_faixas_gestao ON erp.erp_comissao_venda_faixas;
CREATE POLICY erp_comissao_venda_faixas_gestao ON erp.erp_comissao_venda_faixas
  FOR ALL USING ((SELECT erp.is_erp_admin())) WITH CHECK ((SELECT erp.is_erp_admin()));
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_comissao_venda_faixas TO authenticated, service_role;

-- para a tela mostrar de onde veio a comissão dos produtos
ALTER TABLE erp.erp_comissoes
  ADD COLUMN IF NOT EXISTS valor_produtos numeric(12,2),
  ADD COLUMN IF NOT EXISTS percentual_produto numeric(5,2),
  ADD COLUMN IF NOT EXISTS faixa_venda boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION erp.tem_faixa_venda(p_funcionario uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = erp, public AS $$
  SELECT EXISTS (SELECT 1 FROM erp.erp_comissao_venda_faixas WHERE funcionario_id = p_funcionario);
$$;

-- Total de produtos vendidos pelo funcionário no mês da data informada.
CREATE OR REPLACE FUNCTION erp.total_produtos_mes(p_funcionario uuid, p_ref date)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = erp, public AS $$
  SELECT coalesce(sum(coalesce(i.valor_total, i.subtotal, 0)), 0)
  FROM erp.erp_venda_itens i
  JOIN erp.erp_vendas v ON v.id = i.venda_id
  WHERE v.vendedor_id = p_funcionario
    AND v.status::text = 'finalizada'
    AND i.servico_id IS NULL
    AND date_trunc('month', v.data_venda::date) = date_trunc('month', p_ref);
$$;

-- Percentual da faixa atingida; 0 abaixo da primeira faixa.
CREATE OR REPLACE FUNCTION erp.pct_faixa_venda(p_funcionario uuid, p_total numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = erp, public AS $$
  SELECT coalesce((
    SELECT percentual FROM erp.erp_comissao_venda_faixas
    WHERE funcionario_id = p_funcionario AND venda_minima <= p_total
    ORDER BY venda_minima DESC LIMIT 1), 0);
$$;

-- Situação do mês, para a tela: quanto vendeu, em que faixa está, quanto
-- falta para a próxima.
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
GRANT EXECUTE ON FUNCTION erp.situacao_faixa_venda(uuid, date) TO authenticated, service_role;

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

-- Mudou a tabela de faixas: refaz as comissões pendentes do mês corrente
-- daquele funcionário (senão só mudariam na próxima venda) — como a 097.
CREATE OR REPLACE FUNCTION erp.fn_faixas_venda_mudaram()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'erp', 'public' AS $$
DECLARE
  v_func uuid := COALESCE(NEW.funcionario_id, OLD.funcionario_id);
  x record;
BEGIN
  FOR x IN
    SELECT v.id FROM erp.erp_vendas v
    WHERE v.vendedor_id = v_func AND v.status::text = 'finalizada'
      AND date_trunc('month', v.data_venda::date) = date_trunc('month', current_date)
  LOOP
    PERFORM erp.recalcular_comissao_venda(x.id, false);
  END LOOP;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS tg_faixas_venda_mudaram ON erp.erp_comissao_venda_faixas;
CREATE TRIGGER tg_faixas_venda_mudaram
  AFTER INSERT OR UPDATE OR DELETE ON erp.erp_comissao_venda_faixas
  FOR EACH ROW EXECUTE FUNCTION erp.fn_faixas_venda_mudaram();

NOTIFY pgrst, 'reload schema';
COMMIT;
