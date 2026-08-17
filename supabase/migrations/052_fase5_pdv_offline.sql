-- ============================================================
-- 052: FASE 5 — PDV offline
--
-- Hoje, se a internet cai, o caixa para e a venda se perde. O que falta
-- não é só guardar o carrinho no navegador: é ter um jeito de replayar a
-- venda depois SEM risco de duplicar e SEM travar por estoque.
--
-- Duas decisões moldam este arquivo:
--
-- 1. IDEMPOTÊNCIA POR CHAVE DO CLIENTE. O PDV gera um uuid local antes de
--    tentar enviar. Reenvio de fila, aba reaberta e clique duplo caem todos
--    na mesma chave — a segunda tentativa devolve a venda que já existe em
--    vez de criar outra. Sem isso, "não sei se foi" vira venda em dobro.
--
-- 2. VENDA OFFLINE NÃO PODE SER RECUSADA POR ESTOQUE. A mercadoria já saiu
--    da loja; recusar o lançamento não a traz de volta, só apaga o registro
--    do que aconteceu. Então o saldo pode ficar negativo, e o negativo é o
--    sintoma visível de que a contagem precisa de inventário — que é
--    exatamente o que a fase 1 construiu.
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '120s';

-- ── Chave de idempotência e procedência da venda ──
ALTER TABLE erp.erp_vendas
  ADD COLUMN IF NOT EXISTS uuid_local      uuid,
  ADD COLUMN IF NOT EXISTS origem_offline  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS criada_em_local timestamptz,
  ADD COLUMN IF NOT EXISTS sincronizada_em timestamptz;

COMMENT ON COLUMN erp.erp_vendas.uuid_local IS
  'Gerado pelo PDV antes do envio. É o que impede a fila de duplicar a venda no reenvio.';
COMMENT ON COLUMN erp.erp_vendas.criada_em_local IS
  'Quando a venda aconteceu no caixa. Difere de created_at quando ficou na fila offline.';

CREATE UNIQUE INDEX IF NOT EXISTS erp_vendas_uuid_local_key
  ON erp.erp_vendas (uuid_local) WHERE uuid_local IS NOT NULL;

-- ── Uma implementação só para a baixa de estoque ──
-- baixar_estoque_atomico continua com a mesma assinatura e o mesmo
-- comportamento (recusa saldo insuficiente); ela passa a delegar. Duplicar a
-- escrituração do kardex em duas funções seria pedir para elas divergirem.
CREATE OR REPLACE FUNCTION erp.baixar_estoque_movimento(
  p_loja_id           uuid,
  p_itens             jsonb,
  p_origem            text DEFAULT 'venda',
  p_documento_id      uuid DEFAULT NULL,
  p_permitir_negativo boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  item    RECORD;
  v_saldo integer;
  v_cm    numeric(14,4);
  v_uid   uuid := erp.current_erp_user_id();
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
      -- Offline: o produto pode ter sido vendido antes de existir posição na
      -- loja. Cria zerada para o kardex ter de onde partir, em vez de perder
      -- a saída inteira.
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

    INSERT INTO erp.erp_estoque_movimentacoes (
      produto_id, loja_id, tipo, origem, documento_id, quantidade,
      saldo_anterior, saldo_posterior, custo_unitario,
      custo_medio_anterior, custo_medio_posterior, valor_total, usuario_id,
      observacao
    ) VALUES (
      item.pid, p_loja_id, 'saida', p_origem, p_documento_id, item.qtd,
      v_saldo, v_saldo - item.qtd, v_cm, v_cm, v_cm,
      item.qtd * v_cm, v_uid,
      CASE WHEN v_saldo - item.qtd < 0
           THEN 'Saldo negativo: venda registrada offline com estoque desatualizado'
           ELSE NULL END
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION erp.baixar_estoque_movimento(uuid, jsonb, text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erp.baixar_estoque_movimento(uuid, jsonb, text, uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION erp.baixar_estoque_atomico(
  p_loja_id      uuid,
  p_itens        jsonb,
  p_origem       text DEFAULT 'venda',
  p_documento_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
BEGIN
  PERFORM erp.baixar_estoque_movimento(p_loja_id, p_itens, p_origem, p_documento_id, false);
END;
$$;

-- ── A venda inteira em uma chamada ──
-- Online o PDV fazia duas chamadas: cria a venda, depois baixa o estoque.
-- Entre uma e outra a rede podia cair e deixar venda sem baixa. Na fila
-- offline isso seria a regra, não a exceção — então venda, itens e kardex
-- passam a nascer na MESMA transação.
CREATE OR REPLACE FUNCTION erp.registrar_venda_pdv(p_venda jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v_uid        uuid := erp.current_erp_user_id();
  v_uuid_local uuid := NULLIF(p_venda->>'uuid_local','')::uuid;
  v_loja       uuid := (p_venda->>'loja_id')::uuid;
  v_offline    boolean := COALESCE((p_venda->>'origem_offline')::boolean, false);
  v_itens      jsonb := COALESCE(p_venda->'itens', '[]'::jsonb);
  v_venda_id   uuid;
  v_numero     integer;
  v_existente  RECORD;
  it           jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;
  IF v_loja IS NULL THEN
    RAISE EXCEPTION 'loja_id é obrigatório' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_array_length(v_itens) = 0 THEN
    RAISE EXCEPTION 'Venda sem itens' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotência: a fila reenvia sem saber se a primeira tentativa chegou.
  IF v_uuid_local IS NOT NULL THEN
    SELECT id, numero_pedido INTO v_existente
      FROM erp.erp_vendas WHERE uuid_local = v_uuid_local;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'venda_id', v_existente.id,
        'numero',   v_existente.numero_pedido,
        'duplicada', true
      );
    END IF;
  END IF;

  INSERT INTO erp.erp_vendas (
    loja_id, cliente_id, usuario_id, caixa_id,
    subtotal, desconto, desconto_percentual, acrescimo,
    troco, valor_recebido, total, custo_total, lucro_total,
    forma_pagamento, status, tipo_venda, observacoes, vendedor_id,
    uuid_local, origem_offline, criada_em_local, sincronizada_em
  ) VALUES (
    v_loja,
    NULLIF(p_venda->>'cliente_id','')::uuid,
    v_uid,
    NULLIF(p_venda->>'caixa_id','')::uuid,
    COALESCE((p_venda->>'subtotal')::numeric, 0),
    COALESCE((p_venda->>'desconto')::numeric, 0),
    COALESCE((p_venda->>'desconto_percentual')::numeric, 0),
    COALESCE((p_venda->>'acrescimo')::numeric, 0),
    COALESCE((p_venda->>'troco')::numeric, 0),
    COALESCE((p_venda->>'valor_recebido')::numeric, 0),
    COALESCE((p_venda->>'total')::numeric, 0),
    COALESCE((p_venda->>'custo_total')::numeric, 0),
    COALESCE((p_venda->>'lucro_total')::numeric, 0),
    COALESCE(NULLIF(p_venda->>'forma_pagamento',''), 'dinheiro')::erp.erp_forma_pagamento,
    COALESCE(NULLIF(p_venda->>'status',''), 'finalizada')::erp.erp_venda_status,
    COALESCE(NULLIF(p_venda->>'tipo_venda',''), 'pdv'),
    NULLIF(p_venda->>'observacoes',''),
    -- vendedor_id aponta para erp_funcionarios, não para o usuário do ERP
    (SELECT f.id FROM erp.erp_funcionarios f WHERE f.usuario_id = v_uid LIMIT 1),
    v_uuid_local, v_offline,
    COALESCE(NULLIF(p_venda->>'criada_em_local','')::timestamptz, now()),
    now()
  )
  RETURNING id, numero_pedido INTO v_venda_id, v_numero;

  FOR it IN SELECT * FROM jsonb_array_elements(v_itens)
  LOOP
    INSERT INTO erp.erp_venda_itens (
      venda_id, produto_id, nome, preco_unitario, preco_custo, quantidade, subtotal
    ) VALUES (
      v_venda_id,
      NULLIF(it->>'produto_id','')::uuid,
      it->>'nome',
      COALESCE((it->>'preco_unitario')::numeric, 0),
      COALESCE((it->>'preco_custo')::numeric, 0),
      COALESCE((it->>'quantidade')::integer, 1),
      COALESCE((it->>'subtotal')::numeric, 0)
    );
  END LOOP;

  -- Mesma transação da venda: nunca mais venda lançada sem baixa de estoque.
  -- Offline aceita saldo negativo porque a mercadoria já saiu fisicamente.
  PERFORM erp.baixar_estoque_movimento(
    v_loja,
    (SELECT jsonb_agg(jsonb_build_object('produto_id', it2->>'produto_id', 'quantidade', it2->>'quantidade'))
       FROM jsonb_array_elements(v_itens) it2
      WHERE NULLIF(it2->>'produto_id','') IS NOT NULL),
    'venda', v_venda_id, v_offline
  );

  RETURN jsonb_build_object('venda_id', v_venda_id, 'numero', v_numero, 'duplicada', false);
END;
$$;

REVOKE ALL ON FUNCTION erp.registrar_venda_pdv(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erp.registrar_venda_pdv(jsonb) TO authenticated, service_role;

-- ── Saldos negativos: o passivo que a venda offline deixa ──
-- Não é erro a corrigir na mão; é a lista do que precisa de contagem.
CREATE OR REPLACE VIEW erp.vw_estoque_negativo AS
SELECT e.loja_id, l.nome AS loja_nome,
       e.produto_id, p.nome AS produto_nome, p.sku,
       e.quantidade, e.custo_medio, e.updated_at
  FROM erp.erp_estoque e
  JOIN erp.erp_lojas l   ON l.id = e.loja_id
  JOIN erp.erp_produtos p ON p.id = e.produto_id
 WHERE e.quantidade < 0;

GRANT SELECT ON erp.vw_estoque_negativo TO authenticated, service_role;
