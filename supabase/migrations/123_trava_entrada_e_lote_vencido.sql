-- ============================================================
-- 123 — Entrada de pedido e baixa de lote vencido conferem quem pode
--
-- Varredura de segurança de 03/11/2026, achado 6. As duas funções rodam com
-- o poder do dono do banco (SECURITY DEFINER) e só conferiam se quem chama
-- é usuário do ERP:
--
-- 1. aplicar_entrada_pedido: qualquer usuário lançava entrada de dinheiro
--    em qualquer caixa aberto, de qualquer filial. Agora vale a mesma regra
--    da entrada avulsa (policy erp_operador_insert de erp_entradas_extras):
--    quem opera aquele caixa (pode_operar_caixa: quem abriu, ou o vendedor
--    no turno de quem está acima — 113), ou admin/gerente.
-- 2. baixar_lote_vencido: qualquer usuário (operador de caixa, vendedor)
--    tirava do estoque de qualquer filial — e erp_estoque é só de
--    admin/gerente na RLS. Agora precisa de estoque.ajustar e de trabalhar
--    na filial do lote (admin/gerente: todas).
--
-- O resto do corpo é o de produção antes desta migration (091 e 076); as
-- linhas novas estão marcadas com "123".
--
-- Volta: docs/ajustes/2026-11-03-volta-migration-123.sql
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION erp.aplicar_entrada_pedido(p_pedido_id uuid, p_caixa_id uuid, p_forma erp_forma_pagamento, p_valor numeric, p_observacoes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
DECLARE
  v_usuario uuid;
  v_status text;
  v_saldo numeric;
  v_entrada uuid;
  v_pagamento uuid;
  v_numero text;
BEGIN
  v_usuario := erp.current_erp_user_id();
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'Sem usuário do ERP na sessão.';
  END IF;

  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'O valor da entrada precisa ser maior que zero.';
  END IF;

  -- Sinal é adiantamento de dinheiro que chega; lançar o próprio
  -- 'adiantamento' como forma aqui seria circular.
  IF p_forma = 'adiantamento' THEN
    RAISE EXCEPTION 'Escolha como o cliente está pagando a entrada (dinheiro, pix, cartão...).';
  END IF;

  SELECT status INTO v_status FROM erp.erp_pedidos WHERE id = p_pedido_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;
  IF v_status = 'cancelado' THEN
    RAISE EXCEPTION 'Pedido cancelado não recebe entrada.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM erp.erp_caixa WHERE id = p_caixa_id AND status = 'aberto') THEN
    RAISE EXCEPTION 'O caixa precisa estar aberto para receber a entrada.';
  END IF;

  -- 123: só quem opera este caixa, ou admin/gerente (a regra da entrada avulsa)
  IF NOT ((SELECT erp.is_erp_admin()) OR erp.pode_operar_caixa(p_caixa_id)) THEN
    RAISE EXCEPTION 'Você não opera este caixa: a entrada vai no caixa que você abriu.'
      USING ERRCODE = '42501';
  END IF;

  SELECT saldo INTO v_saldo FROM erp.vw_pedido_saldo WHERE pedido_id = p_pedido_id;

  -- Receber mais que o devido vira troco que ninguém registrou, e sobra no
  -- caixa no fim do dia. Tolerância de meio centavo para arredondamento.
  IF v_saldo IS NOT NULL AND v_saldo > 0 AND p_valor > v_saldo + 0.005 THEN
    RAISE EXCEPTION 'Entrada de % maior que o saldo do pedido (%).', p_valor, v_saldo;
  END IF;

  v_numero := left(replace(p_pedido_id::text, '-', ''), 8);

  INSERT INTO erp.erp_entradas_extras (caixa_id, usuario_id, motivo, forma_pagamento, valor, observacoes)
  VALUES (p_caixa_id, v_usuario, 'Entrada de pedido ' || v_numero, p_forma, p_valor,
          COALESCE(p_observacoes, 'Adiantamento do pedido ' || v_numero))
  RETURNING id INTO v_entrada;

  INSERT INTO erp.erp_pedido_pagamentos
    (pedido_id, caixa_id, entrada_extra_id, usuario_id, forma_pagamento, valor, observacoes)
  VALUES (p_pedido_id, p_caixa_id, v_entrada, v_usuario, p_forma, p_valor, p_observacoes)
  RETURNING id INTO v_pagamento;

  RETURN (
    SELECT jsonb_build_object(
      'pagamento_id', v_pagamento,
      'entrada_extra_id', v_entrada,
      'total_pedido', s.total_pedido,
      'total_pago', s.total_pago,
      'saldo', s.saldo)
    FROM erp.vw_pedido_saldo s WHERE s.pedido_id = p_pedido_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION erp.baixar_lote_vencido(p_lote_id uuid, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
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

  -- 123: mexe no estoque da filial — quem ajusta estoque, numa filial em que
  -- trabalha (admin/gerente: todas, como na RLS de erp_estoque)
  IF NOT erp.usuario_tem_permissao('estoque.ajustar')
     OR NOT ((SELECT erp.is_erp_admin()) OR erp.usuario_tem_loja(v_uid, v_lote.loja_id)) THEN
    RAISE EXCEPTION 'Sem permissão para baixar lote vencido desta filial (precisa de ajustar estoque).'
      USING ERRCODE = '42501';
  END IF;

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
$function$;

COMMIT;
