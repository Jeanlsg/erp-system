-- ============================================================
-- 086 — a venda registra as formas com que foi paga
--
-- registrar_venda_pdv passa a aceitar `pagamentos` no payload e a gravar
-- em erp_venda_pagamentos (migration 085). Sem `pagamentos`, o
-- comportamento é o de sempre: uma forma só, no campo da venda.
--
-- A soma é conferida AQUI, não só na tela: a tela é a conveniência, o
-- banco é a regra. Venda que sai com pagamento a menos vira divergência
-- de caixa no fim do dia, e aí ninguém lembra qual venda foi.
--
-- Tolerância de meio centavo por causa de arredondamento de parcela: três
-- parcelas de um total de R$ 100 somam 99,99 ou 100,01 conforme quem
-- arredonda.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION erp.registrar_venda_pdv(p_venda jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
DECLARE
  v_uid        uuid := erp.current_erp_user_id();
  v_uuid_local uuid := NULLIF(p_venda->>'uuid_local','')::uuid;
  v_loja       uuid := (p_venda->>'loja_id')::uuid;
  v_offline    boolean := COALESCE((p_venda->>'origem_offline')::boolean, false);
  v_itens      jsonb := COALESCE(p_venda->'itens', '[]'::jsonb);
  -- formas com que a venda foi paga; vazio = forma única, como antes
  v_pagamentos jsonb := COALESCE(p_venda->'pagamentos', '[]'::jsonb);
  pg           jsonb;
  v_soma_pag   numeric := 0;
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

  -- CPF na nota: se veio documento do consumidor, ele precisa ser válido —
  -- CPF errado é rejeição da SEFAZ na hora do cupom.
  IF NULLIF(regexp_replace(COALESCE(p_venda->>'consumidor_cpf',''), '\D', '', 'g'), '') IS NOT NULL
     AND NOT erp.documento_valido(p_venda->>'consumidor_cpf') THEN
    RAISE EXCEPTION 'CPF/CNPJ do consumidor inválido — confira os dígitos' USING ERRCODE = 'P0001';
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
    uuid_local, origem_offline, criada_em_local, sincronizada_em,
    consumidor_cpf, consumidor_nome
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
    -- vendedor informado no PDV; sem ele, o funcionário ligado ao usuário logado
    COALESCE(NULLIF(p_venda->>'vendedor_id','')::uuid,
             (SELECT f.id FROM erp.erp_funcionarios f WHERE f.usuario_id = v_uid LIMIT 1)),
    v_uuid_local, v_offline,
    COALESCE(NULLIF(p_venda->>'criada_em_local','')::timestamptz, now()),
    now(),
    NULLIF(regexp_replace(COALESCE(p_venda->>'consumidor_cpf',''), '\D', '', 'g'), ''),
    NULLIF(trim(COALESCE(p_venda->>'consumidor_nome','')), '')
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

  -- ---------- formas de pagamento ----------
  -- A venda mista vive em erp_venda_pagamentos; erp_vendas.forma_pagamento
  -- fica com a de maior valor, porque relatório antigo e histórico contam
  -- com ela. A soma é conferida aqui: pagamento que não fecha o total é
  -- dinheiro que ninguém sabe se entrou.
  IF jsonb_array_length(v_pagamentos) > 0 THEN
    SELECT sum((e->>'valor')::numeric) INTO v_soma_pag
      FROM jsonb_array_elements(v_pagamentos) e;

    IF v_soma_pag < (COALESCE((p_venda->>'total')::numeric, 0) - 0.005) THEN
      RAISE EXCEPTION 'Pagamentos somam % e a venda é de %: falta %',
        v_soma_pag, (p_venda->>'total')::numeric,
        (p_venda->>'total')::numeric - v_soma_pag
        USING ERRCODE = 'P0001';
    END IF;

    FOR pg IN SELECT * FROM jsonb_array_elements(v_pagamentos)
    LOOP
      INSERT INTO erp.erp_venda_pagamentos (
        venda_id, forma, valor, valor_recebido, troco, bandeira, parcelas, autorizacao
      ) VALUES (
        v_venda_id,
        (pg->>'forma')::erp.erp_forma_pagamento,
        (pg->>'valor')::numeric,
        NULLIF(pg->>'valor_recebido','')::numeric,
        COALESCE(NULLIF(pg->>'troco','')::numeric, 0),
        NULLIF(pg->>'bandeira',''),
        COALESCE(NULLIF(pg->>'parcelas','')::integer, 1),
        NULLIF(pg->>'autorizacao','')
      );
    END LOOP;

    -- a forma "principal" passa a ser a de maior valor
    UPDATE erp.erp_vendas SET forma_pagamento = (
      SELECT p.forma FROM erp.erp_venda_pagamentos p
       WHERE p.venda_id = v_venda_id ORDER BY p.valor DESC LIMIT 1
    ) WHERE id = v_venda_id;
  END IF;

  RETURN jsonb_build_object('venda_id', v_venda_id, 'numero', v_numero, 'duplicada', false);
END;
$function$;

COMMIT;
