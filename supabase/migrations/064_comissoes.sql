-- ============================================================
-- 064: Comissões de funcionários — do cadastro à conta.
--
-- O percentual de comissão era digitado em Funcionários, Serviços e
-- Produtos e nunca usado: nenhuma função gerava comissão e nenhuma tela
-- listava ou pagava. Agora a venda finalizada com vendedor vira uma
-- linha em erp_comissoes (pendente), recalculada quando os itens entram
-- (produto/serviço com % próprio sobrepõe o % do funcionário), e
-- cancelada se a venda for cancelada ou devolvida.
--
-- registrar_venda_pdv passa a aceitar vendedor_id no payload: o caixa
-- pode registrar a venda para outro vendedor. Sem ele, continua valendo
-- o funcionário vinculado ao usuário logado.
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- ---------- registrar_venda_pdv: vendedor_id no payload ----------
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

  RETURN jsonb_build_object('venda_id', v_venda_id, 'numero', v_numero, 'duplicada', false);
END;
$function$;

-- ---------- uma comissão por venda ----------
CREATE UNIQUE INDEX IF NOT EXISTS uq_erp_comissoes_venda
  ON erp.erp_comissoes (venda_id) WHERE venda_id IS NOT NULL;

-- ---------- cálculo ----------
-- % do item: serviço > produto > funcionário. Base: valor do item.
CREATE OR REPLACE FUNCTION erp.recalcular_comissao_venda(p_venda_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v      erp.erp_vendas%ROWTYPE;
  v_pct  numeric := 0;
  v_val  numeric := 0;
BEGIN
  SELECT * INTO v FROM erp.erp_vendas WHERE id = p_venda_id;
  IF NOT FOUND OR v.vendedor_id IS NULL THEN RETURN; END IF;

  IF v.status::text IN ('cancelada', 'devolvida') THEN
    UPDATE erp.erp_comissoes SET status = 'cancelada'
     WHERE venda_id = p_venda_id AND status = 'pendente';
    RETURN;
  END IF;
  IF v.status::text <> 'finalizada' THEN RETURN; END IF;

  SELECT COALESCE(f.comissao_percentual, 0) INTO v_pct
    FROM erp.erp_funcionarios f WHERE f.id = v.vendedor_id;

  SELECT COALESCE(SUM(
           COALESCE(i.valor_total, i.subtotal, 0)
           * COALESCE(NULLIF(s.comissao_percentual, 0), NULLIF(p.comissao_percentual, 0), v_pct) / 100
         ), 0)
    INTO v_val
    FROM erp.erp_venda_itens i
    LEFT JOIN erp.erp_produtos p ON p.id = i.produto_id
    LEFT JOIN erp.erp_servicos s ON s.id = i.servico_id
   WHERE i.venda_id = p_venda_id;

  -- Antes dos itens entrarem (INSERT da venda) usa o total × % do funcionário;
  -- o trigger dos itens refina logo em seguida.
  IF v_val = 0 AND NOT EXISTS (SELECT 1 FROM erp.erp_venda_itens WHERE venda_id = p_venda_id) THEN
    v_val := COALESCE(v.total, 0) * v_pct / 100;
  END IF;

  IF v_val <= 0 THEN
    DELETE FROM erp.erp_comissoes WHERE venda_id = p_venda_id AND status = 'pendente';
    RETURN;
  END IF;

  INSERT INTO erp.erp_comissoes
    (loja_id, funcionario_id, venda_id, data_referencia, valor_venda, percentual_comissao, valor_comissao, status)
  VALUES
    (v.loja_id, v.vendedor_id, v.id, COALESCE(v.data_venda::date, current_date), v.total, v_pct, round(v_val, 2), 'pendente')
  ON CONFLICT (venda_id) WHERE venda_id IS NOT NULL DO UPDATE
    SET valor_venda = EXCLUDED.valor_venda,
        percentual_comissao = EXCLUDED.percentual_comissao,
        valor_comissao = EXCLUDED.valor_comissao,
        funcionario_id = EXCLUDED.funcionario_id
    WHERE erp.erp_comissoes.status = 'pendente'; -- paga não se mexe
END;
$$;

CREATE OR REPLACE FUNCTION erp.fn_comissao_venda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public AS $$
BEGIN
  PERFORM erp.recalcular_comissao_venda(NEW.id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION erp.fn_comissao_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public AS $$
BEGIN
  PERFORM erp.recalcular_comissao_venda(COALESCE(NEW.venda_id, OLD.venda_id));
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_comissao_venda ON erp.erp_vendas;
CREATE TRIGGER trg_comissao_venda
  AFTER INSERT OR UPDATE OF status, vendedor_id, total ON erp.erp_vendas
  FOR EACH ROW EXECUTE FUNCTION erp.fn_comissao_venda();

DROP TRIGGER IF EXISTS trg_comissao_item ON erp.erp_venda_itens;
CREATE TRIGGER trg_comissao_item
  AFTER INSERT OR UPDATE OR DELETE ON erp.erp_venda_itens
  FOR EACH ROW EXECUTE FUNCTION erp.fn_comissao_item();

REVOKE ALL ON FUNCTION erp.recalcular_comissao_venda(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION erp.recalcular_comissao_venda(uuid) TO authenticated, service_role;

-- ---------- página no painel de flags ----------
INSERT INTO erp.erp_feature_flags (chave, path, titulo, descricao, categoria, ordem, ativo, is_system, is_protegida)
VALUES ('page.gestao.comissoes', '/gestao/comissoes', 'Comissões',
        'Comissões geradas por venda, por vendedor e período; marcar como pagas.', 'cadastros', 43, true, true, false)
ON CONFLICT (chave) DO NOTHING;
