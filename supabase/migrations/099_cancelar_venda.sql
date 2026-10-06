-- ============================================================
-- 099 — cancelar venda
--
-- O ERP não tinha como cancelar uma venda: só devolução. Venda lançada errada
-- no balcão (produto trocado, cliente desistiu antes de sair da loja, teste)
-- ficava finalizada para sempre, contando no caixa, no estoque, nas contas e
-- na comissão — ou era apagada à mão no banco, sem rastro.
--
-- Cancelar ≠ devolver. Cancelamento desfaz a venda como se não tivesse
-- acontecido, no mesmo turno: a mercadoria volta pelo MESMO caminho que saiu
-- (os movimentos da venda, lote por lote, ao custo da saída), a conta a
-- receber é cancelada (o dinheiro volta da gaveta, e o esperado do caixa cai
-- sozinho porque vw_caixa_resumo só soma venda finalizada), os pontos de
-- fidelidade são estornados, e a comissão pendente e o pedido de entrega são
-- cancelados pelos triggers que já existem. Depois do turno, ou com parte já
-- recebida no crediário, o caminho é a Devolução — e o cancelamento recusa
-- dizendo isso.
--
-- A nota fiscal é cancelada ANTES, na SEFAZ, pela tela (erp-eventos-fiscais):
-- aqui só se confere que não sobrou nota vigente. Para a tela não cancelar a
-- nota e descobrir depois que a venda não podia ser cancelada, a função tem
-- o modo `p_simular`, que faz todas as conferências sem gravar nada.
-- ============================================================

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ---------- permissão efetiva do usuário logado ----------
-- O mesmo critério do can() da tela: admin principal pode tudo; permissões
-- próprias, quando existem, valem sozinhas ({"all": true} é curinga); senão
-- a união das permissões dos papéis em erp_papel_permissoes.
CREATE OR REPLACE FUNCTION erp.usuario_tem_permissao(p_permissao text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
  SELECT COALESCE((
    SELECT CASE
      WHEN u.admin_principal THEN true
      WHEN u.permissoes IS NOT NULL AND u.permissoes::text NOT IN ('{}', 'null') THEN
        COALESCE((u.permissoes->>'all')::boolean, false)
        OR COALESCE((u.permissoes->>p_permissao)::boolean, false)
      ELSE EXISTS (
        SELECT 1 FROM erp.erp_papel_permissoes pp
         WHERE pp.papel::text = ANY (
                 CASE WHEN COALESCE(array_length(u.papeis, 1), 0) > 0
                      THEN u.papeis::text[] ELSE ARRAY[u.role::text] END)
           AND p_permissao = ANY (pp.permissoes::text[]))
    END
    FROM erp.erp_usuarios u
   WHERE u.id = erp.current_erp_user_id() AND u.ativo
  ), false);
$function$;

REVOKE ALL ON FUNCTION erp.usuario_tem_permissao(text) FROM public;
GRANT EXECUTE ON FUNCTION erp.usuario_tem_permissao(text) TO authenticated;

-- ---------- cancelar venda ----------
CREATE OR REPLACE FUNCTION erp.cancelar_venda(p_venda_id uuid, p_motivo text, p_simular boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
DECLARE
  v_uid      uuid := erp.current_erp_user_id();
  v_venda    RECORD;
  v_caixa    RECORD;
  v_nota     RECORD;
  m          RECORD;
  l          jsonb;
  v_credito  jsonb := '[]'::jsonb;
  v_contas   integer := 0;
  v_cartao   RECORD;
  v_pts      integer := 0;
  v_com_paga boolean := false;
  v_pedido   boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;
  IF NOT erp.usuario_tem_permissao('venda.cancelar') THEN
    RAISE EXCEPTION 'Sem permissão para cancelar venda (venda.cancelar)' USING ERRCODE = '42501';
  END IF;
  IF length(trim(COALESCE(p_motivo, ''))) < 15 THEN
    -- 15 é o mínimo da justificativa de cancelamento na SEFAZ; o mesmo texto vai para as duas
    RAISE EXCEPTION 'Informe o motivo do cancelamento (mínimo 15 caracteres)' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_venda FROM erp.erp_vendas WHERE id = p_venda_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada' USING ERRCODE = 'P0001';
  END IF;
  IF v_venda.status::text <> 'finalizada' THEN
    RAISE EXCEPTION 'Venda com status "%" não pode ser cancelada', v_venda.status USING ERRCODE = 'P0001';
  END IF;

  -- turno já fechado: o dinheiro já foi conferido e o caixa encerrado
  IF v_venda.caixa_id IS NOT NULL THEN
    SELECT status, data_fechamento INTO v_caixa FROM erp.erp_caixa WHERE id = v_venda.caixa_id;
    IF FOUND AND (v_caixa.status <> 'aberto' OR v_caixa.data_fechamento IS NOT NULL) THEN
      RAISE EXCEPTION 'O caixa desta venda já foi fechado — para desfazer, use Devolução' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM erp.erp_devolucoes WHERE venda_id = p_venda_id) THEN
    RAISE EXCEPTION 'Esta venda já tem devolução — para o restante, use Devolução' USING ERRCODE = 'P0001';
  END IF;

  -- já recebido a prazo (crediário, boleto, promissória, cheque): cancelar
  -- apagaria um recebimento que aconteceu
  IF EXISTS (
    SELECT 1 FROM erp.erp_contas c
     WHERE c.venda_id = p_venda_id AND c.tipo = 'receber'
       AND COALESCE(c.valor_pago, 0) > 0
       AND c.forma_pagamento::text NOT IN ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito')
  ) OR EXISTS (
    SELECT 1 FROM erp.erp_crediario_parcelas cp
      JOIN erp.erp_crediario_parcela_itens ci ON ci.crediario_id = cp.id
     WHERE cp.venda_id = p_venda_id AND ci.status = 'pago'
  ) OR EXISTS (
    SELECT 1 FROM erp.erp_promissorias pr WHERE pr.venda_id = p_venda_id AND pr.data_pagamento IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Já há parcela recebida desta venda — para desfazer, use Devolução' USING ERRCODE = 'P0001';
  END IF;

  -- nota vigente: tem de ser cancelada na SEFAZ antes (a tela faz isso)
  IF NOT p_simular THEN
    SELECT numero, tipo, status INTO v_nota FROM erp.erp_notas_fiscais
     WHERE venda_id = p_venda_id
       AND status::text NOT IN ('cancelada', 'rejeitada', 'denegada', 'inutilizada', 'erro', 'rascunho')
     LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION '% nº % (status %) ainda vigente — cancele a nota antes da venda',
        CASE WHEN v_nota.tipo::text = 'nfce' THEN 'NFC-e' ELSE 'NF-e' END, v_nota.numero, v_nota.status
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT EXISTS (SELECT 1 FROM erp.erp_comissoes
                  WHERE venda_id = p_venda_id AND status NOT IN ('pendente', 'cancelada'))
    INTO v_com_paga;
  SELECT EXISTS (SELECT 1 FROM erp.erp_pedidos
                  WHERE venda_id = p_venda_id AND status NOT IN ('entregue', 'cancelado'))
    INTO v_pedido;

  IF p_simular THEN
    RETURN jsonb_build_object('pode', true, 'comissao_ja_paga', v_com_paga, 'pedido_entrega', v_pedido);
  END IF;

  -- ---------- estoque: pelo mesmo caminho que saiu ----------
  -- Os movimentos da venda já trazem os componentes dos kits e os lotes que o
  -- FEFO consumiu. A mercadoria volta ao custo da saída.
  FOR m IN
    SELECT produto_id, quantidade, custo_unitario, lote_detalhe
      FROM erp.erp_estoque_movimentacoes
     WHERE documento_id = p_venda_id AND tipo = 'saida' AND loja_id = v_venda.loja_id
  LOOP
    v_credito := v_credito || jsonb_build_object(
      'produto_id', m.produto_id, 'quantidade', m.quantidade, 'custo_unitario', m.custo_unitario);
    IF jsonb_typeof(m.lote_detalhe) = 'array' THEN
      FOR l IN SELECT * FROM jsonb_array_elements(m.lote_detalhe)
      LOOP
        IF NULLIF(l->>'lote_id', '') IS NOT NULL THEN
          UPDATE erp.erp_lotes SET quantidade = quantidade + (l->>'quantidade')::int
           WHERE id = (l->>'lote_id')::uuid;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  IF jsonb_array_length(v_credito) > 0 THEN
    PERFORM erp.creditar_estoque_atomico(v_venda.loja_id, v_credito, 'cancelamento_venda', p_venda_id);
  END IF;

  -- ---------- financeiro ----------
  UPDATE erp.erp_contas
     SET status = 'cancelado'::erp.erp_conta_status,
         observacoes = concat_ws(' · ', NULLIF(observacoes, ''), 'Venda cancelada: ' || trim(p_motivo)),
         updated_at = now()
   WHERE venda_id = p_venda_id AND tipo = 'receber' AND status <> 'cancelado';
  GET DIAGNOSTICS v_contas = ROW_COUNT;

  UPDATE erp.erp_crediario_parcela_itens SET status = 'cancelado'
   WHERE crediario_id IN (SELECT id FROM erp.erp_crediario_parcelas WHERE venda_id = p_venda_id)
     AND status <> 'pago';
  UPDATE erp.erp_crediario_parcelas SET status = 'cancelado', updated_at = now()
   WHERE venda_id = p_venda_id;
  UPDATE erp.erp_promissorias SET status = 'cancelada', updated_at = now()
   WHERE venda_id = p_venda_id AND data_pagamento IS NULL;

  -- ---------- fidelidade: estorna o que esta venda deu, limitado ao saldo ----------
  IF v_venda.cliente_id IS NOT NULL THEN
    SELECT c.*,
           COALESCE((SELECT SUM(mv.pontos) FROM erp.erp_cartao_fidelidade_movimentacoes mv
                      WHERE mv.cartao_id = c.id AND mv.venda_id = p_venda_id), 0) AS liquido
      INTO v_cartao
      FROM erp.erp_cartao_fidelidade c
     WHERE c.cliente_id = v_venda.cliente_id
       AND EXISTS (SELECT 1 FROM erp.erp_cartao_fidelidade_movimentacoes mv
                    WHERE mv.cartao_id = c.id AND mv.venda_id = p_venda_id AND mv.tipo = 'acumulo')
     LIMIT 1;
    IF FOUND THEN
      v_pts := LEAST(GREATEST(v_cartao.liquido, 0)::int, COALESCE(v_cartao.saldo_pontos, 0));
      IF v_pts > 0 THEN
        INSERT INTO erp.erp_cartao_fidelidade_movimentacoes (
          cartao_id, venda_id, tipo, pontos, motivo, data_movimentacao
        ) VALUES (v_cartao.id, p_venda_id, 'estorno', -v_pts, 'Estorno por cancelamento da venda', now());
        UPDATE erp.erp_cartao_fidelidade SET saldo_pontos = saldo_pontos - v_pts WHERE id = v_cartao.id;
      END IF;
    END IF;
  END IF;

  -- ---------- a venda ----------
  -- os triggers de status cancelam a comissão pendente (recalcular_comissao_venda)
  -- e o pedido de entrega ainda não entregue (fn_cancelar_pedido_da_venda, 098)
  UPDATE erp.erp_vendas
     SET status = 'cancelada'::erp.erp_venda_status,
         data_cancelamento = now(),
         motivo_cancelamento = trim(p_motivo),
         cancelado_por = v_uid
   WHERE id = p_venda_id;

  RETURN jsonb_build_object(
    'cancelada', true,
    'itens_ao_estoque', jsonb_array_length(v_credito),
    'contas_canceladas', v_contas,
    'pontos_estornados', v_pts,
    'comissao_ja_paga', v_com_paga,
    'pedido_entrega_cancelado', v_pedido
  );
END;
$function$;

REVOKE ALL ON FUNCTION erp.cancelar_venda(uuid, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION erp.cancelar_venda(uuid, text, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
