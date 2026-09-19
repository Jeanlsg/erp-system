-- ============================================================
-- 076 — lotes vencidos: a venda não tira deles, e existe baixa por vencimento
--
-- Até aqui o FEFO de baixar_estoque_movimento ordenava os lotes por
-- data_validade ASC sem excluir os já vencidos — o PDV tirava PRIMEIRO do
-- lote vencido. E não havia destino para um lote vencido: só o badge
-- "Vencido" no diálogo, sem baixa, sem Kardex.
--
-- 1. FEFO pula lote com data_validade < hoje.
-- 2. erp.baixar_lote_vencido(lote): tira do estoque o que o lote ainda tem,
--    registra saída com origem 'vencimento' no Kardex (com o lote no
--    lote_detalhe) e zera o lote. O rastro fica; o lote não some.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION erp.baixar_estoque_movimento(p_loja_id uuid, p_itens jsonb, p_origem text DEFAULT 'venda'::text, p_documento_id uuid DEFAULT NULL::uuid, p_permitir_negativo boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
DECLARE
  item    RECORD;
  v_saldo integer;
  v_cm    numeric(14,4);
  v_uid   uuid := erp.current_erp_user_id();
  v_controla boolean;
  v_restante integer;
  v_lote  RECORD;
  v_tira  integer;
  v_rastro jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;

  FOR item IN
    SELECT (e->>'produto_id')::uuid AS pid, (e->>'quantidade')::int AS qtd
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
      IF NOT p_permitir_negativo THEN
        RAISE EXCEPTION 'Produto % sem posição de estoque na loja %', item.pid, p_loja_id USING ERRCODE = 'P0001';
      END IF;
      INSERT INTO erp.erp_estoque (produto_id, loja_id, quantidade, custo_medio)
      VALUES (item.pid, p_loja_id, 0, 0)
      ON CONFLICT (produto_id, loja_id) DO NOTHING;
      v_saldo := 0; v_cm := 0;
    END IF;

    IF v_saldo < item.qtd AND NOT p_permitir_negativo THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto %: saldo %, pedido %', item.pid, v_saldo, item.qtd USING ERRCODE = 'P0001';
    END IF;

    UPDATE erp.erp_estoque
       SET quantidade = v_saldo - item.qtd, updated_at = now()
     WHERE produto_id = item.pid AND loja_id = p_loja_id;

    -- ── FEFO: consumir os lotes que vencem primeiro ──
    v_rastro := NULL;
    SELECT controla_lote INTO v_controla FROM erp.erp_produtos WHERE id = item.pid;
    IF COALESCE(v_controla, false) THEN
      v_restante := item.qtd;
      v_rastro := '[]'::jsonb;
      FOR v_lote IN
        SELECT id, codigo, data_validade, quantidade
          FROM erp.erp_lotes
         WHERE produto_id = item.pid AND loja_id = p_loja_id AND quantidade > 0
           -- lote vencido não vai para a sacola do cliente: fica para a baixa
           -- por vencimento (erp.baixar_lote_vencido)
           AND (data_validade IS NULL OR data_validade >= CURRENT_DATE)
         ORDER BY data_validade ASC NULLS LAST, created_at ASC
         FOR UPDATE
      LOOP
        EXIT WHEN v_restante <= 0;
        v_tira := LEAST(v_lote.quantidade, v_restante);
        UPDATE erp.erp_lotes SET quantidade = quantidade - v_tira WHERE id = v_lote.id;
        v_rastro := v_rastro || jsonb_build_object(
          'lote_id', v_lote.id, 'codigo', v_lote.codigo,
          'validade', v_lote.data_validade, 'quantidade', v_tira);
        v_restante := v_restante - v_tira;
      END LOOP;
      IF v_restante > 0 THEN
        -- Lotes não cobriram a saída: venda passa (o saldo é a verdade),
        -- mas a divergência fica gravada para o inventário de lotes.
        v_rastro := v_rastro || jsonb_build_object(
          'sem_lote', true, 'quantidade', v_restante);
      END IF;
    END IF;

    INSERT INTO erp.erp_estoque_movimentacoes (
      produto_id, loja_id, tipo, origem, documento_id, quantidade,
      saldo_anterior, saldo_posterior, custo_unitario,
      custo_medio_anterior, custo_medio_posterior, valor_total, usuario_id,
      observacao, lote_detalhe
    ) VALUES (
      item.pid, p_loja_id, 'saida', p_origem, p_documento_id, item.qtd,
      v_saldo, v_saldo - item.qtd, v_cm, v_cm, v_cm,
      item.qtd * v_cm, v_uid,
      CASE WHEN v_saldo - item.qtd < 0
           THEN 'Saldo negativo: venda registrada offline com estoque desatualizado'
           ELSE NULL END,
      v_rastro
    );
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION erp.baixar_lote_vencido(p_lote_id uuid, p_observacao text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'erp', 'public'
AS $$
DECLARE
  v_lote   erp.erp_lotes%ROWTYPE;
  v_uid    uuid := erp.current_erp_user_id();
  v_saldo  integer;
  v_cm     numeric;
  v_tira   integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'usuário sem perfil no ERP';
  END IF;

  SELECT * INTO v_lote FROM erp.erp_lotes WHERE id = p_lote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lote não encontrado'; END IF;
  IF v_lote.quantidade <= 0 THEN RAISE EXCEPTION 'este lote já está zerado'; END IF;
  IF v_lote.data_validade IS NULL OR v_lote.data_validade >= CURRENT_DATE THEN
    RAISE EXCEPTION 'este lote ainda não venceu (vence em %)', v_lote.data_validade;
  END IF;

  SELECT quantidade, custo_medio INTO v_saldo, v_cm
    FROM erp.erp_estoque
   WHERE produto_id = v_lote.produto_id AND loja_id = v_lote.loja_id
   FOR UPDATE;
  v_saldo := COALESCE(v_saldo, 0);
  v_cm    := COALESCE(v_cm, 0);

  -- o saldo é a verdade: se o lote diz mais do que há na prateleira, tira o
  -- que existe e registra a diferença na observação
  v_tira := LEAST(v_lote.quantidade, v_saldo);

  IF v_tira > 0 THEN
    UPDATE erp.erp_estoque
       SET quantidade = quantidade - v_tira, updated_at = now()
     WHERE produto_id = v_lote.produto_id AND loja_id = v_lote.loja_id;
  END IF;

  INSERT INTO erp.erp_estoque_movimentacoes (
    produto_id, loja_id, tipo, origem, quantidade,
    saldo_anterior, saldo_posterior, custo_unitario,
    custo_medio_anterior, custo_medio_posterior, valor_total,
    lote_id, usuario_id, observacao, lote_detalhe
  ) VALUES (
    v_lote.produto_id, v_lote.loja_id, 'saida', 'vencimento', v_tira,
    v_saldo, v_saldo - v_tira, v_cm, v_cm, v_cm, v_tira * v_cm,
    v_lote.id, v_uid,
    concat_ws(' · ',
      'baixa por vencimento do lote ' || v_lote.codigo || ' (venceu em ' || v_lote.data_validade || ')',
      CASE WHEN v_tira < v_lote.quantidade
           THEN 'lote dizia ' || v_lote.quantidade || ', estoque tinha ' || v_saldo END,
      NULLIF(p_observacao, '')),
    jsonb_build_array(jsonb_build_object(
      'lote_id', v_lote.id, 'codigo', v_lote.codigo,
      'validade', v_lote.data_validade, 'quantidade', v_lote.quantidade))
  );

  UPDATE erp.erp_lotes SET quantidade = 0 WHERE id = v_lote.id;

  RETURN jsonb_build_object(
    'lote', v_lote.codigo, 'baixado', v_tira, 'no_lote', v_lote.quantidade,
    'saldo_anterior', v_saldo, 'saldo_posterior', v_saldo - v_tira);
END;
$$;

REVOKE ALL ON FUNCTION erp.baixar_lote_vencido(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION erp.baixar_lote_vencido(uuid, text) TO authenticated;

COMMIT;
