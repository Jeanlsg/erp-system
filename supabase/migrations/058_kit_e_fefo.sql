-- ============================================================
-- 058: Kit no PDV (desmembramento) e FEFO na baixa por lote
--
-- KIT — o contrato pede "baixa automática e individualizada dos
-- componentes físicos do kit no estoque no momento da venda". O
-- desmembramento acontece AQUI, no registrar_venda_pdv, e não no front:
-- assim vale igual para venda online, venda da fila offline e qualquer
-- outro caminho que crie venda. O item da venda guarda o kit_id (o cupom
-- mostra "Kit Massa 2x"), o estoque desconta os componentes.
--
-- FEFO — para produto com controla_lote, a saída consome do lote que
-- VENCE PRIMEIRO, registrando o rastro no kardex (lote_detalhe). Regra de
-- convivência: o saldo de erp_estoque continua sendo a verdade para
-- "pode vender?"; os lotes são rastreabilidade. Se os lotes estiverem
-- dessincronizados do saldo, a venda NÃO trava — consome o que houver e
-- anota a diferença, porque recusar venda por causa de rastro é inverter
-- a hierarquia.
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '120s';

-- Rastro dos lotes consumidos na movimentação
ALTER TABLE erp.erp_estoque_movimentacoes
  ADD COLUMN IF NOT EXISTS lote_detalhe jsonb;

COMMENT ON COLUMN erp.erp_estoque_movimentacoes.lote_detalhe IS
  'FEFO: [{lote_id, codigo, validade, quantidade}] consumidos nesta saída. Nulo quando o produto não controla lote.';

-- ── Baixa com FEFO ──
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
$$;

-- ── Venda com kit: o servidor desmembra ──
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
  v_kit        RECORD;
  v_custo_kit  numeric;
  v_baixa      jsonb := '[]'::jsonb;
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
    (SELECT f.id FROM erp.erp_funcionarios f WHERE f.usuario_id = v_uid LIMIT 1),
    v_uuid_local, v_offline,
    COALESCE(NULLIF(p_venda->>'criada_em_local','')::timestamptz, now()),
    now()
  )
  RETURNING id, numero_pedido INTO v_venda_id, v_numero;

  FOR it IN SELECT * FROM jsonb_array_elements(v_itens)
  LOOP
    IF NULLIF(it->>'kit_id','') IS NOT NULL THEN
      -- ── KIT: o item da venda guarda o kit; o estoque desconta os
      --    componentes, cada um com seu próprio movimento no kardex ──
      SELECT k.id, k.nome, k.preco_kit INTO v_kit
        FROM erp.erp_kits k WHERE k.id = (it->>'kit_id')::uuid AND k.ativo;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Kit % não encontrado ou inativo', it->>'kit_id' USING ERRCODE = 'P0001';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM erp.erp_kit_itens WHERE kit_id = v_kit.id) THEN
        RAISE EXCEPTION 'Kit "%" não tem componentes cadastrados', v_kit.nome USING ERRCODE = 'P0001';
      END IF;

      -- custo real do kit = soma do custo médio dos componentes
      SELECT COALESCE(SUM(ki.quantidade * COALESCE(e.custo_medio, p.preco_custo, 0)), 0)
        INTO v_custo_kit
        FROM erp.erp_kit_itens ki
        JOIN erp.erp_produtos p ON p.id = ki.produto_id
        LEFT JOIN erp.erp_estoque e ON e.produto_id = ki.produto_id AND e.loja_id = v_loja
       WHERE ki.kit_id = v_kit.id;

      INSERT INTO erp.erp_venda_itens (
        venda_id, kit_id, nome, preco_unitario, preco_custo, quantidade, subtotal
      ) VALUES (
        v_venda_id, v_kit.id,
        COALESCE(NULLIF(it->>'nome',''), v_kit.nome),
        COALESCE((it->>'preco_unitario')::numeric, v_kit.preco_kit, 0),
        v_custo_kit,
        COALESCE((it->>'quantidade')::integer, 1),
        COALESCE((it->>'subtotal')::numeric, 0)
      );

      -- componentes entram na lista de baixa multiplicados pela qtd do kit
      SELECT v_baixa || COALESCE(jsonb_agg(jsonb_build_object(
               'produto_id', ki.produto_id,
               'quantidade', ki.quantidade * COALESCE((it->>'quantidade')::integer, 1))), '[]'::jsonb)
        INTO v_baixa
        FROM erp.erp_kit_itens ki WHERE ki.kit_id = v_kit.id;
    ELSE
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
      IF NULLIF(it->>'produto_id','') IS NOT NULL THEN
        v_baixa := v_baixa || jsonb_build_object(
          'produto_id', it->>'produto_id', 'quantidade', it->>'quantidade');
      END IF;
    END IF;
  END LOOP;

  -- Um componente pode aparecer em dois kits da mesma venda: consolida
  -- antes de baixar para o kardex ter um movimento por produto.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('produto_id', pid, 'quantidade', qtd)), '[]'::jsonb)
    INTO v_baixa
    FROM (
      SELECT (b->>'produto_id') AS pid, SUM((b->>'quantidade')::int) AS qtd
        FROM jsonb_array_elements(v_baixa) b GROUP BY 1
    ) s;

  IF jsonb_array_length(v_baixa) > 0 THEN
    PERFORM erp.baixar_estoque_movimento(v_loja, v_baixa, 'venda', v_venda_id, v_offline);
  END IF;

  RETURN jsonb_build_object('venda_id', v_venda_id, 'numero', v_numero, 'duplicada', false);
END;
$$;
