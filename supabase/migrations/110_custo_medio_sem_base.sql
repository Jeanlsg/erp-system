-- ============================================================
-- 110 — Custo médio que nunca foi gravado não vale zero (11/10/2026)
--
-- O estoque inicial da loja entrou sem custo_medio (0): 9 de 10 posições
-- com saldo estavam assim. Na primeira reposição com custo, a média móvel
-- tratava o saldo antigo como custo zero — no teste, 4 un. + 3 un. a
-- R$ 72,00 viraram custo médio de R$ 30,86. O mesmo zero entra no custo do
-- kit (registrar_venda_pdv soma o custo médio dos componentes) e no valor
-- das saídas do Kardex.
--
-- 1. creditar_estoque_atomico: sem custo médio gravado, a base é o custo
--    do cadastro do produto.
-- 2. As posições com saldo e custo médio zero recebem o custo do cadastro.
-- ============================================================

CREATE OR REPLACE FUNCTION erp.creditar_estoque_atomico(p_loja_id uuid, p_itens jsonb, p_origem text DEFAULT 'entrada'::text, p_documento_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
DECLARE
  item RECORD;
  v_saldo integer;
  v_cm numeric(14,4);
  v_novo_cm numeric(14,4);
BEGIN
  IF (SELECT erp.current_erp_user_id()) IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;

  FOR item IN
    SELECT (e->>'produto_id')::uuid AS pid,
           (e->>'quantidade')::int AS qtd,
           NULLIF(e->>'custo_unitario','')::numeric AS custo
      FROM jsonb_array_elements(p_itens) e
  LOOP
    IF item.qtd IS NULL OR item.qtd <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida (%) para o produto %', item.qtd, item.pid USING ERRCODE = 'P0001';
    END IF;

    SELECT quantidade, custo_medio INTO v_saldo, v_cm
      FROM erp.erp_estoque
     WHERE produto_id = item.pid AND loja_id = p_loja_id
       FOR UPDATE;

    IF NOT FOUND THEN
      v_saldo := 0;
      v_cm := COALESCE(item.custo, (SELECT preco_custo FROM erp.erp_produtos WHERE id = item.pid), 0);
      v_novo_cm := v_cm;
      INSERT INTO erp.erp_estoque (produto_id, loja_id, quantidade, custo_medio, updated_at)
      VALUES (item.pid, p_loja_id, item.qtd, v_novo_cm, now());
    ELSE
      -- saldo sem custo médio gravado: a base é o custo do cadastro, não zero
      IF COALESCE(v_cm, 0) = 0 THEN
        v_cm := COALESCE(NULLIF((SELECT preco_custo FROM erp.erp_produtos WHERE id = item.pid), 0), item.custo, 0);
      END IF;
      -- Custo médio móvel: só se move quando a entrada traz custo.
      v_novo_cm := CASE
        WHEN item.custo IS NULL THEN v_cm
        WHEN (v_saldo + item.qtd) <= 0 THEN v_cm
        WHEN v_saldo <= 0 THEN item.custo
        ELSE ((v_saldo * v_cm) + (item.qtd * item.custo)) / (v_saldo + item.qtd)
      END;
      UPDATE erp.erp_estoque
         SET quantidade = v_saldo + item.qtd, custo_medio = v_novo_cm, updated_at = now()
       WHERE produto_id = item.pid AND loja_id = p_loja_id;
    END IF;

    INSERT INTO erp.erp_estoque_movimentacoes (
      produto_id, loja_id, tipo, origem, documento_id, quantidade,
      saldo_anterior, saldo_posterior, custo_unitario,
      custo_medio_anterior, custo_medio_posterior, valor_total, usuario_id
    ) VALUES (
      item.pid, p_loja_id, 'entrada', p_origem, p_documento_id, item.qtd,
      v_saldo, v_saldo + item.qtd, COALESCE(item.custo, v_novo_cm), v_cm, v_novo_cm,
      item.qtd * COALESCE(item.custo, v_novo_cm), (SELECT erp.current_erp_user_id())
    );
  END LOOP;
END;
$function$;

UPDATE erp.erp_estoque e
   SET custo_medio = p.preco_custo, updated_at = now()
  FROM erp.erp_produtos p
 WHERE p.id = e.produto_id
   AND e.quantidade > 0
   AND COALESCE(e.custo_medio, 0) = 0
   AND COALESCE(p.preco_custo, 0) > 0;
