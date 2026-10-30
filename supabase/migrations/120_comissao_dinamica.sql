-- ============================================================
-- 120 — Comissão dinâmica: relatório, cartão da faixa de volta e recálculo
--       que só refaz o mês quando a faixa muda
--
-- Pedido do Jean (30/10/2026): as faixas sobre vendas (107) passam a se
-- chamar "comissão dinâmica" e ganham tela de relatório — quanto cada
-- vendedor faturou no mês, em que faixa está, quanto falta para a próxima
-- e quanto tem de comissão.
--
-- Três defeitos corrigidos junto:
--
-- 1. A 118 tirou do authenticated o EXECUTE de situacao_faixa_venda e
--    situacao_faixa_servico, que a tela Comissões chama ao filtrar um
--    vendedor. Desde 26/10 o cartão "faixa atual / quanto falta" sumia sem
--    erro na tela. Voltam a ser chamáveis, com trava de admin/gerente (a
--    mesma das tabelas de faixa): eram SECURITY DEFINER sem trava, e
--    qualquer login do ERP lia a faixa de qualquer vendedor.
--
-- 2. recalcular_comissao_venda refazia TODAS as vendas do mês do vendedor
--    a cada venda dele — e o gatilho dos itens chama uma vez por item. Com
--    500 vendas no mês, uma venda de 4 itens refazia 2.500 comissões, cada
--    uma somando o mês inteiro de novo: o PDV ficaria lento no fim do mês
--    assim que alguém tivesse faixa. Agora só refaz quando alguma comissão
--    pendente do mês está com percentual diferente da faixa atual (ou falta
--    a comissão de uma venda que passou a ter direito). O resultado é o
--    mesmo; o trabalho só acontece quando a faixa muda.
--    Corrige junto: apagar o último produto de uma venda não refazia o mês
--    (a condição antiga exigia produto na venda).
--
-- 3. Não havia como ver o mês de todos de uma vez — só um vendedor por
--    vez, na tela Comissões.
--
-- Volta: docs/ajustes/2026-10-30-volta-migration-120.sql
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- ── 1. cartão da faixa: chamável pela tela, só por admin/gerente ──
-- auth.uid() nulo = sem usuário final (service_role, cron, psql), como na 118.
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
  FROM t LEFT JOIN prox ON true
  WHERE erp.is_erp_admin() OR auth.uid() IS NULL;
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
  FROM t LEFT JOIN prox ON true
  WHERE erp.is_erp_admin() OR auth.uid() IS NULL;
$$;
GRANT EXECUTE ON FUNCTION erp.situacao_faixa_venda(uuid, date), erp.situacao_faixa_servico(uuid, date)
  TO authenticated, service_role;

-- ── 2. recálculo só quando a faixa muda ──

-- Alguma outra venda finalizada do mês está com a comissão fora da faixa
-- atual? Compara o que está gravado com o que a faixa manda agora:
-- comissão pendente com outro percentual (ou ainda sem faixa), ou venda que
-- não tem comissão nenhuma mas passou a ter direito. Paga e cancelada não
-- se mexem, como no resto.
CREATE OR REPLACE FUNCTION erp.faixa_do_mes_desatualizada(p_funcionario uuid, p_ref date, p_exceto uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = erp, public AS $$
  WITH pct AS (
    SELECT CASE WHEN erp.tem_faixa_venda(p_funcionario)
                THEN erp.pct_faixa_venda(p_funcionario, erp.total_produtos_mes(p_funcionario, p_ref)) END AS prod,
           CASE WHEN erp.tem_faixa_servico(p_funcionario)
                THEN erp.pct_faixa_servico(p_funcionario, erp.total_servicos_mes(p_funcionario, p_ref)) END AS serv
  ), vendas AS (
    SELECT x.id,
           coalesce(sum(coalesce(i.valor_total, i.subtotal, 0)) FILTER (WHERE i.servico_id IS NULL), 0) AS prod,
           coalesce(sum(coalesce(i.valor_total, i.subtotal, 0)) FILTER (WHERE i.servico_id IS NOT NULL), 0) AS serv
    FROM erp.erp_vendas x
    JOIN erp.erp_venda_itens i ON i.venda_id = x.id
    WHERE x.vendedor_id = p_funcionario
      AND x.id <> p_exceto
      AND x.status::text = 'finalizada'
      AND date_trunc('month', x.data_venda::date) = date_trunc('month', p_ref)
    GROUP BY x.id
  )
  SELECT EXISTS (
    SELECT 1
    FROM vendas s
    CROSS JOIN pct
    LEFT JOIN erp.erp_comissoes c ON c.venda_id = s.id
    WHERE (pct.prod IS NOT NULL AND s.prod > 0 AND (
             (c.id IS NULL AND pct.prod > 0)
          OR (c.status::text = 'pendente'
              AND (NOT c.faixa_venda OR c.percentual_produto IS DISTINCT FROM pct.prod))))
       OR (pct.serv IS NOT NULL AND s.serv > 0 AND (
             (c.id IS NULL AND pct.serv > 0)
          OR (c.status::text = 'pendente'
              AND (NOT c.faixa_servico OR c.percentual_servico IS DISTINCT FROM pct.serv))))
  );
$$;
-- interna: só o recálculo a usa
REVOKE EXECUTE ON FUNCTION erp.faixa_do_mes_desatualizada(uuid, date, uuid) FROM PUBLIC, anon, authenticated;

-- Igual à 107, menos as duas condições de propagar (marcadas com "120").
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
    -- 120: só se alguma ficou fora da faixa nova
    IF p_propagar AND (v_faixa OR v_faixa_venda)
       AND erp.faixa_do_mes_desatualizada(v.vendedor_id, v.data_venda::date, p_venda_id) THEN
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
  -- 120: só quando alguma está fora da faixa atual. Antes refazia o mês
  -- inteiro a cada item de cada venda.
  IF p_propagar AND (v_faixa OR v_faixa_venda)
     AND erp.faixa_do_mes_desatualizada(v.vendedor_id, v.data_venda::date, p_venda_id) THEN
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

-- ── 3. relatório do mês, todos os vendedores de uma vez ──
-- Entra quem tem comissão dinâmica (mesmo sem venda no mês: mostra quanto
-- falta para a primeira faixa), quem vendeu e quem teve comissão no mês.
-- Os totais vêm das mesmas funções que calculam a faixa, para o número do
-- relatório ser o mesmo da comissão.
CREATE OR REPLACE FUNCTION erp.relatorio_comissao_dinamica(p_mes date)
RETURNS TABLE(
  funcionario_id uuid, nome text, cargo text, demitido_em date,
  dinamica boolean, percentual_fixo numeric, faixas jsonb,
  vendas integer, itens numeric, faturamento numeric, servicos numeric,
  percentual numeric, proxima_venda_minima numeric, proximo_percentual numeric, falta numeric,
  comissao numeric, comissao_pendente numeric, comissao_paga numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = erp, public AS $$
#variable_conflict use_column
BEGIN
  IF NOT (erp.is_erp_admin() OR auth.uid() IS NULL) THEN
    RAISE EXCEPTION 'O relatório de comissão é só de administrador e gerente.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH vend AS (
    SELECT v.vendedor_id AS fid,
           count(DISTINCT v.id)::integer AS vendas,
           coalesce(sum(i.quantidade) FILTER (WHERE i.servico_id IS NULL), 0)::numeric AS itens
    FROM erp.erp_vendas v
    LEFT JOIN erp.erp_venda_itens i ON i.venda_id = v.id
    WHERE v.vendedor_id IS NOT NULL
      AND v.status::text = 'finalizada'
      AND date_trunc('month', v.data_venda::date) = date_trunc('month', p_mes)
    GROUP BY v.vendedor_id
  ), com AS (
    SELECT c.funcionario_id AS fid,
           coalesce(sum(c.valor_comissao) FILTER (WHERE c.status::text <> 'cancelada'), 0) AS total,
           coalesce(sum(c.valor_comissao) FILTER (WHERE c.status::text = 'pendente'), 0) AS pendente,
           coalesce(sum(c.valor_comissao) FILTER (WHERE c.status::text = 'paga'), 0) AS paga
    FROM erp.erp_comissoes c
    WHERE c.funcionario_id IS NOT NULL
      AND date_trunc('month', c.data_referencia) = date_trunc('month', p_mes)
    GROUP BY c.funcionario_id
  ), fx AS (
    SELECT x.funcionario_id AS fid,
           jsonb_agg(jsonb_build_object('venda_minima', x.venda_minima, 'percentual', x.percentual)
                     ORDER BY x.venda_minima) AS faixas
    FROM erp.erp_comissao_venda_faixas x
    GROUP BY x.funcionario_id
  )
  SELECT f.id,
         coalesce(p.nome_razao, f.cargo, '—')::text,
         f.cargo::text,
         f.data_demissao,
         fx.fid IS NOT NULL,
         coalesce(f.comissao_percentual, 0)::numeric,
         coalesce(fx.faixas, '[]'::jsonb),
         coalesce(vend.vendas, 0),
         coalesce(vend.itens, 0),
         s.total,
         erp.total_servicos_mes(f.id, p_mes),
         CASE WHEN fx.fid IS NOT NULL THEN s.percentual END,
         s.proxima_venda_minima,
         s.proximo_percentual,
         s.falta,
         coalesce(com.total, 0),
         coalesce(com.pendente, 0),
         coalesce(com.paga, 0)
  FROM erp.erp_funcionarios f
  LEFT JOIN erp.erp_pessoas p ON p.id = f.pessoa_id
  LEFT JOIN vend ON vend.fid = f.id
  LEFT JOIN com ON com.fid = f.id
  LEFT JOIN fx ON fx.fid = f.id
  CROSS JOIN LATERAL erp.situacao_faixa_venda(f.id, p_mes) s
  WHERE vend.fid IS NOT NULL
     OR com.fid IS NOT NULL
     OR (fx.fid IS NOT NULL
         AND (f.data_demissao IS NULL OR f.data_demissao >= date_trunc('month', p_mes)::date))
  ORDER BY s.total DESC, 2;
END;
$$;
-- o event trigger da 117 já dá EXECUTE ao authenticated; a trava é a de cima
GRANT EXECUTE ON FUNCTION erp.relatorio_comissao_dinamica(date) TO authenticated, service_role;

-- Confere antes de gravar: nada do erp executável pelo anon (117).
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'erp' AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF n > 0 THEN
    RAISE EXCEPTION '120: há % função(ões) do erp executáveis pelo anon', n;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
