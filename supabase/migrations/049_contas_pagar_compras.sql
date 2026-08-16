-- ============================================================
-- 049: FASE 3 (parte 1) — Contas a pagar a partir da compra
--
-- A fase 1 fez a venda gerar conta a RECEBER. Faltava o outro lado:
-- a compra não gerava nada, então o ERP sabia quanto tinha a receber
-- mas não quanto devia — e sem isso não há fluxo de caixa nem DRE.
--
-- As duplicatas da NF-e trazem o parcelamento real (número, vencimento
-- e valor). Quando existirem, cada uma vira uma conta a pagar; sem elas,
-- cai numa parcela única no prazo padrão da loja.
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '120s';

-- Prazo padrão para compra sem duplicatas informadas
INSERT INTO erp.erp_configuracoes_sistema (chave, valor, descricao)
SELECT 'prazo_padrao_compra_dias', '30', 'Dias até o vencimento quando a NF-e de compra não traz duplicatas'
WHERE NOT EXISTS (
  SELECT 1 FROM erp.erp_configuracoes_sistema WHERE chave = 'prazo_padrao_compra_dias'
);

-- Vínculo da conta com a compra que a originou
ALTER TABLE erp.erp_contas
  ADD COLUMN IF NOT EXISTS compra_id uuid REFERENCES erp.erp_compras(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_erp_contas_compra
  ON erp.erp_contas (compra_id) WHERE compra_id IS NOT NULL;

-- Evita duplicar a mesma parcela da mesma compra
CREATE UNIQUE INDEX IF NOT EXISTS erp_contas_compra_parcela_key
  ON erp.erp_contas (compra_id, parcela_numero) WHERE compra_id IS NOT NULL;

-- ── Gera as contas a pagar de uma compra ──
-- p_duplicatas: [{numero, vencimento, valor}] extraído da NF-e.
-- Vazio/nulo => parcela única no prazo padrão.
CREATE OR REPLACE FUNCTION erp.gerar_contas_pagar_compra(
  p_compra_id  uuid,
  p_duplicatas jsonb DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v_compra RECORD;
  v_plano  uuid;
  v_centro uuid;
  v_prazo  integer;
  v_total  integer := 0;
  v_qtd    integer;
  item     RECORD;
BEGIN
  IF (SELECT erp.current_erp_user_id()) IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_compra FROM erp.erp_compras WHERE id = p_compra_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra % não encontrada', p_compra_id USING ERRCODE = 'P0001';
  END IF;

  -- Idempotente: se já existem contas desta compra, não duplica
  IF EXISTS (SELECT 1 FROM erp.erp_contas WHERE compra_id = p_compra_id) THEN
    RETURN 0;
  END IF;

  SELECT id INTO v_plano  FROM erp.erp_plano_contas  WHERE codigo = '4.2.01';  -- Fornecedores
  SELECT id INTO v_centro FROM erp.erp_centros_custo WHERE loja_id = v_compra.loja_id LIMIT 1;

  SELECT COALESCE(NULLIF(valor, '')::integer, 30) INTO v_prazo
    FROM erp.erp_configuracoes_sistema WHERE chave = 'prazo_padrao_compra_dias';
  v_prazo := COALESCE(v_prazo, 30);

  v_qtd := COALESCE(jsonb_array_length(p_duplicatas), 0);

  IF v_qtd > 0 THEN
    FOR item IN
      SELECT (d->>'numero')     AS numero,
             (d->>'vencimento') AS vencimento,
             (d->>'valor')::numeric AS valor,
             row_number() OVER () AS idx
        FROM jsonb_array_elements(p_duplicatas) d
    LOOP
      INSERT INTO erp.erp_contas (
        loja_id, tipo, pessoa_id, compra_id, descricao, categoria, valor,
        data_vencimento, status, parcela_numero, parcela_total,
        numero_documento, plano_conta_id, centro_custo_id, observacoes
      ) VALUES (
        v_compra.loja_id, 'pagar', v_compra.fornecedor_id, p_compra_id,
        'Compra ' || COALESCE(v_compra.numero_pedido::text, p_compra_id::text)
          || ' — parcela ' || item.idx || '/' || v_qtd,
        'compra', item.valor,
        COALESCE(NULLIF(item.vencimento, '')::date, CURRENT_DATE + v_prazo),
        'pendente'::erp.erp_conta_status, item.idx::integer, v_qtd,
        NULLIF(item.numero, ''), v_plano, v_centro,
        'Gerado das duplicatas da NF-e de entrada'
      );
      v_total := v_total + 1;
    END LOOP;
  ELSE
    INSERT INTO erp.erp_contas (
      loja_id, tipo, pessoa_id, compra_id, descricao, categoria, valor,
      data_vencimento, status, parcela_numero, parcela_total,
      plano_conta_id, centro_custo_id, observacoes
    ) VALUES (
      v_compra.loja_id, 'pagar', v_compra.fornecedor_id, p_compra_id,
      'Compra ' || COALESCE(v_compra.numero_pedido::text, p_compra_id::text),
      'compra', v_compra.total,
      COALESCE(v_compra.data_compra::date, CURRENT_DATE) + v_prazo,
      'pendente'::erp.erp_conta_status, 1, 1,
      v_plano, v_centro,
      'Parcela única — NF-e sem duplicatas informadas'
    );
    v_total := 1;
  END IF;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION erp.gerar_contas_pagar_compra(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erp.gerar_contas_pagar_compra(uuid, jsonb) TO authenticated, service_role;

-- ── Baixa de conta (pagar ou receber) com rastro ──
CREATE OR REPLACE FUNCTION erp.baixar_conta(
  p_conta_id  uuid,
  p_valor     numeric DEFAULT NULL,
  p_data      date DEFAULT NULL,
  p_forma     text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE v_conta RECORD;
BEGIN
  IF (SELECT erp.current_erp_user_id()) IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_conta FROM erp.erp_contas WHERE id = p_conta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada' USING ERRCODE = 'P0001';
  END IF;
  IF v_conta.status = 'pago' THEN
    RAISE EXCEPTION 'Conta já está paga' USING ERRCODE = 'P0001';
  END IF;
  IF v_conta.status = 'cancelado' THEN
    RAISE EXCEPTION 'Conta cancelada não pode ser baixada' USING ERRCODE = 'P0001';
  END IF;

  UPDATE erp.erp_contas
     SET status = 'pago'::erp.erp_conta_status,
         valor_pago = COALESCE(p_valor, v_conta.valor),
         data_pagamento = COALESCE(p_data, CURRENT_DATE),
         forma_pagamento = COALESCE(p_forma::erp.erp_forma_pagamento, forma_pagamento),
         updated_at = now()
   WHERE id = p_conta_id;
END;
$$;

REVOKE ALL ON FUNCTION erp.baixar_conta(uuid, numeric, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erp.baixar_conta(uuid, numeric, date, text) TO authenticated, service_role;

-- ── Marca vencidas: o status 'vencido' existia no enum e ninguém usava ──
CREATE OR REPLACE FUNCTION erp.marcar_contas_vencidas() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE v_n integer;
BEGIN
  UPDATE erp.erp_contas
     SET status = 'vencido'::erp.erp_conta_status, updated_at = now()
   WHERE status = 'pendente'
     AND data_vencimento < CURRENT_DATE;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

GRANT EXECUTE ON FUNCTION erp.marcar_contas_vencidas() TO authenticated, service_role;

-- Roda todo dia às 5h (o pg_cron já é usado no schema public)
SELECT cron.schedule(
  'erp_marcar_contas_vencidas',
  '0 5 * * *',
  $cron$ SELECT erp.marcar_contas_vencidas(); $cron$
)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'erp_marcar_contas_vencidas');
