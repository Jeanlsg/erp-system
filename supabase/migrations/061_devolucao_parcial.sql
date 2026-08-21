-- ============================================================
-- 061: Devolução parcial ou total, com rastro completo
--
-- O caso real que motivou: uma creatina vencida volta, o whey da mesma
-- venda fica. A devolução antiga só sabia devolver a venda INTEIRA — e
-- pior: estornava o estoque por update direto (sem kardex) e não tocava
-- o financeiro nem os pontos.
--
-- Decisões:
--   1. Devolução é um REGISTRO próprio (cabeçalho + itens), não um status
--      da venda. A mesma venda pode ter várias devoluções parciais, e o
--      devolvível de cada item é vendido − já devolvido.
--   2. "Retorna ao estoque" é POR ITEM: creatina vencida NÃO volta para a
--      prateleira — fica registrada na devolução como perda, sem entrada
--      no estoque. Produto bom volta com movimento de kardex.
--   3. Financeiro acompanha: conta pendente da venda é reduzida; venda já
--      paga gera reembolso (conta a pagar já baixada — o dinheiro saiu do
--      caixa na hora, como acontece no balcão).
--   4. Pontos de fidelidade acumulados na venda são estornados
--      proporcionalmente (limitados ao saldo do cartão).
--   5. Kit devolvido devolve os COMPONENTES ao estoque, como a venda os
--      baixou.
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS erp.erp_devolucoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id        uuid NOT NULL REFERENCES erp.erp_vendas(id) ON DELETE RESTRICT,
  loja_id         uuid NOT NULL REFERENCES erp.erp_lojas(id) ON DELETE RESTRICT,
  motivo          text,
  valor_devolvido numeric(12,2) NOT NULL DEFAULT 0,
  total_da_venda  boolean NOT NULL DEFAULT false,
  usuario_id      uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp.erp_devolucao_itens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucao_id    uuid NOT NULL REFERENCES erp.erp_devolucoes(id) ON DELETE CASCADE,
  venda_item_id   uuid NOT NULL REFERENCES erp.erp_venda_itens(id) ON DELETE RESTRICT,
  produto_id      uuid REFERENCES erp.erp_produtos(id),
  kit_id          uuid REFERENCES erp.erp_kits(id),
  nome            text NOT NULL,
  quantidade      integer NOT NULL CHECK (quantidade > 0),
  valor_unitario  numeric(12,2) NOT NULL DEFAULT 0,
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  retornou_estoque boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erp_devolucoes_venda ON erp.erp_devolucoes (venda_id);
CREATE INDEX IF NOT EXISTS idx_erp_devolucao_itens_venda_item ON erp.erp_devolucao_itens (venda_item_id);

ALTER TABLE erp.erp_devolucoes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_devolucao_itens ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['erp_devolucoes','erp_devolucao_itens'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS erp_user_select ON erp.%I', t);
    EXECUTE format('CREATE POLICY erp_user_select ON erp.%I FOR SELECT TO authenticated USING ((SELECT erp.current_erp_user_id()) IS NOT NULL)', t);
    EXECUTE format('GRANT SELECT ON erp.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON erp.%I TO service_role', t);
  END LOOP;
END $$;

-- ── A devolução em uma transação ──
-- p_itens: [{venda_item_id, quantidade, retorna_estoque}]
CREATE OR REPLACE FUNCTION erp.registrar_devolucao(
  p_venda_id uuid,
  p_itens    jsonb,
  p_motivo   text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v_uid    uuid := erp.current_erp_user_id();
  v_venda  RECORD;
  v_dev_id uuid;
  it       jsonb;
  v_item   RECORD;
  v_ja_dev integer;
  v_valor  numeric := 0;
  v_val_item numeric;
  v_credito jsonb := '[]'::jsonb;
  v_tudo   boolean;
  v_conta  RECORD;
  v_plano  uuid;
  v_centro uuid;
  v_cartao RECORD;
  v_pts    integer;
  v_por_real numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;
  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um item para devolver' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_venda FROM erp.erp_vendas WHERE id = p_venda_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada' USING ERRCODE = 'P0001';
  END IF;
  IF v_venda.status::text NOT IN ('finalizada','devolvida') THEN
    RAISE EXCEPTION 'Venda com status "%" não aceita devolução', v_venda.status USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO erp.erp_devolucoes (venda_id, loja_id, motivo, usuario_id)
  VALUES (p_venda_id, v_venda.loja_id, NULLIF(trim(COALESCE(p_motivo,'')), ''), v_uid)
  RETURNING id INTO v_dev_id;

  FOR it IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    SELECT * INTO v_item FROM erp.erp_venda_itens
     WHERE id = (it->>'venda_item_id')::uuid AND venda_id = p_venda_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item % não pertence a esta venda', it->>'venda_item_id' USING ERRCODE = 'P0001';
    END IF;

    -- devolvível = vendido − já devolvido em devoluções anteriores
    SELECT COALESCE(SUM(quantidade), 0) INTO v_ja_dev
      FROM erp.erp_devolucao_itens WHERE venda_item_id = v_item.id;
    IF (it->>'quantidade')::int < 1
       OR (it->>'quantidade')::int > (v_item.quantidade - v_ja_dev) THEN
      RAISE EXCEPTION 'Item "%": devolvível %, pedido %',
        v_item.nome, v_item.quantidade - v_ja_dev, (it->>'quantidade')::int USING ERRCODE = 'P0001';
    END IF;

    -- valor proporcional do item (o desconto do item já está no subtotal)
    v_val_item := round((v_item.subtotal / v_item.quantidade) * (it->>'quantidade')::int, 2);
    v_valor := v_valor + v_val_item;

    INSERT INTO erp.erp_devolucao_itens (
      devolucao_id, venda_item_id, produto_id, kit_id, nome,
      quantidade, valor_unitario, subtotal, retornou_estoque
    ) VALUES (
      v_dev_id, v_item.id, v_item.produto_id, v_item.kit_id, v_item.nome,
      (it->>'quantidade')::int, v_item.preco_unitario, v_val_item,
      COALESCE((it->>'retorna_estoque')::boolean, true)
    );

    -- entrada de estoque só para o que RETORNA (vencido/avariado não volta)
    IF COALESCE((it->>'retorna_estoque')::boolean, true) THEN
      IF v_item.kit_id IS NOT NULL THEN
        -- kit: os componentes voltam, como a venda os baixou
        SELECT v_credito || COALESCE(jsonb_agg(jsonb_build_object(
                 'produto_id', ki.produto_id,
                 'quantidade', ki.quantidade * (it->>'quantidade')::int)), '[]'::jsonb)
          INTO v_credito
          FROM erp.erp_kit_itens ki WHERE ki.kit_id = v_item.kit_id;
      ELSIF v_item.produto_id IS NOT NULL THEN
        v_credito := v_credito || jsonb_build_object(
          'produto_id', v_item.produto_id, 'quantidade', (it->>'quantidade')::int);
      END IF;
    END IF;
  END LOOP;

  -- consolida (o mesmo componente pode vir de dois kits) e credita via kardex
  SELECT COALESCE(jsonb_agg(jsonb_build_object('produto_id', pid, 'quantidade', qtd)), '[]'::jsonb)
    INTO v_credito
    FROM (SELECT b->>'produto_id' pid, SUM((b->>'quantidade')::int) qtd
            FROM jsonb_array_elements(v_credito) b GROUP BY 1) s;
  IF jsonb_array_length(v_credito) > 0 THEN
    PERFORM erp.creditar_estoque_atomico(v_venda.loja_id, v_credito, 'devolucao', v_dev_id);
  END IF;

  -- ── financeiro ──
  SELECT id INTO v_plano  FROM erp.erp_plano_contas  WHERE codigo = '3.1.01';
  SELECT id INTO v_centro FROM erp.erp_centros_custo WHERE loja_id = v_venda.loja_id LIMIT 1;

  SELECT * INTO v_conta FROM erp.erp_contas
   WHERE venda_id = p_venda_id AND tipo = 'receber'
     AND status IN ('pendente','vencido')
   ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    -- ainda não pagou: abate da conta em aberto
    IF v_conta.valor - v_valor > 0.009 THEN
      UPDATE erp.erp_contas
         SET valor = round(v_conta.valor - v_valor, 2),
             observacoes = COALESCE(observacoes || ' · ', '') ||
                           'Abatido R$ ' || v_valor || ' por devolução',
             updated_at = now()
       WHERE id = v_conta.id;
    ELSE
      UPDATE erp.erp_contas
         SET status = 'cancelado'::erp.erp_conta_status,
             observacoes = COALESCE(observacoes || ' · ', '') ||
                           'Cancelada por devolução (' || v_dev_id || ')',
             updated_at = now()
       WHERE id = v_conta.id;
    END IF;
  ELSE
    -- já pagou: reembolso no ato — conta a pagar que nasce baixada, porque
    -- no balcão o dinheiro sai da gaveta na hora
    INSERT INTO erp.erp_contas (
      loja_id, tipo, pessoa_id, venda_id, descricao, categoria, valor,
      data_vencimento, data_pagamento, valor_pago, forma_pagamento, status,
      plano_conta_id, centro_custo_id, observacoes
    ) VALUES (
      v_venda.loja_id, 'pagar', v_venda.cliente_id, p_venda_id,
      'Reembolso devolução — venda ' || COALESCE(v_venda.numero_pedido::text, ''),
      'devolucao', v_valor, CURRENT_DATE, CURRENT_DATE, v_valor,
      'dinheiro'::erp.erp_forma_pagamento, 'pago'::erp.erp_conta_status,
      v_plano, v_centro, 'Devolução ' || v_dev_id
    );
  END IF;

  -- ── fidelidade: estorna os pontos proporcionais, limitado ao saldo ──
  IF v_venda.cliente_id IS NOT NULL THEN
    SELECT c.* INTO v_cartao FROM erp.erp_cartao_fidelidade c
     WHERE c.cliente_id = v_venda.cliente_id AND c.ativo
       AND EXISTS (SELECT 1 FROM erp.erp_cartao_fidelidade_movimentacoes m
                    WHERE m.cartao_id = c.id AND m.venda_id = p_venda_id AND m.tipo = 'acumulo');
    IF FOUND THEN
      SELECT COALESCE(NULLIF(valor,'')::numeric, 1) INTO v_por_real
        FROM erp.erp_configuracoes_sistema WHERE chave = 'fidelidade_pontos_por_real';
      v_pts := LEAST(floor(v_valor * COALESCE(v_por_real, 1))::int,
                     COALESCE(v_cartao.saldo_pontos, 0));
      IF v_pts > 0 THEN
        INSERT INTO erp.erp_cartao_fidelidade_movimentacoes (
          cartao_id, venda_id, tipo, pontos, motivo, data_movimentacao
        ) VALUES (v_cartao.id, p_venda_id, 'estorno', -v_pts,
                  'Estorno por devolução (R$ ' || v_valor || ')', now());
        UPDATE erp.erp_cartao_fidelidade
           SET saldo_pontos = saldo_pontos - v_pts WHERE id = v_cartao.id;
      END IF;
    END IF;
  END IF;

  -- ── venda só vira "devolvida" quando TUDO foi devolvido ──
  SELECT NOT EXISTS (
    SELECT 1 FROM erp.erp_venda_itens vi
     WHERE vi.venda_id = p_venda_id
       AND vi.quantidade > COALESCE((SELECT SUM(di.quantidade)
                                       FROM erp.erp_devolucao_itens di
                                      WHERE di.venda_item_id = vi.id), 0)
  ) INTO v_tudo;
  IF v_tudo THEN
    UPDATE erp.erp_vendas SET status = 'devolvida'::erp.erp_venda_status,
           observacoes = COALESCE(observacoes || ' · ', '') || COALESCE('Devolução: ' || p_motivo, 'Devolução total')
     WHERE id = p_venda_id;
  END IF;

  UPDATE erp.erp_devolucoes
     SET valor_devolvido = v_valor, total_da_venda = v_tudo WHERE id = v_dev_id;

  RETURN jsonb_build_object(
    'devolucao_id', v_dev_id,
    'valor_devolvido', v_valor,
    'total_da_venda', v_tudo,
    'itens_ao_estoque', jsonb_array_length(v_credito)
  );
END;
$$;

REVOKE ALL ON FUNCTION erp.registrar_devolucao(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erp.registrar_devolucao(uuid, jsonb, text) TO authenticated, service_role;
