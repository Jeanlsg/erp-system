-- ============================================================
-- 091 — Aplicar entrada / adiantamento em pedido (Ctrl+A no PDV)
--
-- Do sistema anterior: "a opção Aplicar Entrada (Ctrl+A) será utilizada para
-- efetuar o pagamento da entrada (adiantamento); o pedido deve estar Aprovado."
--
-- O sinal é dinheiro que entra ANTES de existir venda. Duas coisas têm de
-- acontecer juntas, ou o caixa não fecha:
--
--   1. o dinheiro entra na gaveta agora  → erp_entradas_extras
--   2. o pedido passa a dever menos      → erp_pedido_pagamentos
--
-- Por isso as duas gravações moram numa função só. Gravar o sinal sem a
-- entrada no caixa faria o operador contar a mais e o sistema acusar sobra.
--
-- 'adiantamento' entra no enum de forma de pagamento para a venda final poder
-- abater o sinal: a venda é registrada pelo valor cheio, com uma linha de
-- adiantamento. Como vw_caixa_resumo só conta 'dinheiro' na gaveta, o sinal
-- não é somado duas vezes — ele já entrou lá no dia em que foi recebido.
-- ============================================================

-- ADD VALUE não pode ser usado na mesma transação que o usa; fica fora do BEGIN
ALTER TYPE erp.erp_forma_pagamento ADD VALUE IF NOT EXISTS 'adiantamento';
BEGIN;

CREATE TABLE IF NOT EXISTS erp.erp_pedido_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES erp.erp_pedidos(id) ON DELETE CASCADE,
  caixa_id uuid REFERENCES erp.erp_caixa(id),
  -- a entrada que levou o dinheiro para a gaveta; mantida para auditoria:
  -- é por ela que se prova que o sinal apareceu no fechamento daquele dia
  entrada_extra_id uuid REFERENCES erp.erp_entradas_extras(id),
  usuario_id uuid REFERENCES erp.erp_usuarios(id),
  forma_pagamento erp.erp_forma_pagamento NOT NULL,
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  observacoes text,
  -- venda que consumiu este sinal; nulo enquanto o pedido não virou venda
  venda_id uuid REFERENCES erp.erp_vendas(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedido_pagamentos_pedido ON erp.erp_pedido_pagamentos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_pagamentos_caixa ON erp.erp_pedido_pagamentos(caixa_id);

ALTER TABLE erp.erp_pedido_pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS erp_pedido_pagamentos_select ON erp.erp_pedido_pagamentos;
CREATE POLICY erp_pedido_pagamentos_select ON erp.erp_pedido_pagamentos
  FOR SELECT USING ((SELECT erp.current_erp_user_id()) IS NOT NULL);

-- Escrita só pela função: receber sinal sem lançar a entrada no caixa deixaria
-- a gaveta com dinheiro que o sistema não conhece.
DROP POLICY IF EXISTS erp_pedido_pagamentos_admin_write ON erp.erp_pedido_pagamentos;
CREATE POLICY erp_pedido_pagamentos_admin_write ON erp.erp_pedido_pagamentos
  FOR ALL USING ((SELECT erp.is_erp_admin())) WITH CHECK ((SELECT erp.is_erp_admin()));

GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_pedido_pagamentos TO authenticated, service_role;

-- ------------------------------------------------------------
-- Saldo do pedido
--
-- O total vem dos itens; taxa de entrega entra porque o cliente paga por ela.
-- Pedido sem item mas já ligado a uma venda usa o total da venda — é o caso
-- do pedido criado a partir do balcão.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW erp.vw_pedido_saldo AS
SELECT
  p.id AS pedido_id,
  p.loja_id,
  p.cliente_id,
  p.status,
  COALESCE(i.total_itens, 0) + COALESCE(p.taxa_entrega, 0) AS total_itens,
  COALESCE(NULLIF(COALESCE(i.total_itens, 0), 0) + COALESCE(p.taxa_entrega, 0),
           COALESCE(v.total, 0)) AS total_pedido,
  COALESCE(g.pago, 0) AS total_pago,
  GREATEST(
    COALESCE(NULLIF(COALESCE(i.total_itens, 0), 0) + COALESCE(p.taxa_entrega, 0),
             COALESCE(v.total, 0)) - COALESCE(g.pago, 0),
    0) AS saldo
FROM erp.erp_pedidos p
LEFT JOIN LATERAL (
  SELECT sum(x.subtotal) AS total_itens FROM erp.erp_pedido_itens x WHERE x.pedido_id = p.id
) i ON true
LEFT JOIN LATERAL (
  SELECT sum(x.valor) AS pago FROM erp.erp_pedido_pagamentos x WHERE x.pedido_id = p.id
) g ON true
LEFT JOIN erp.erp_vendas v ON v.id = p.venda_id;

GRANT SELECT ON erp.vw_pedido_saldo TO authenticated, service_role;

-- ------------------------------------------------------------
-- Receber a entrada
--
-- SECURITY DEFINER porque quem recebe o sinal é o operador de balcão, e
-- erp_entradas_extras só aceita escrita de admin. A checagem de quem pode
-- está aqui dentro: precisa ser usuário ativo do ERP com o caixa aberto.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION erp.aplicar_entrada_pedido(
  p_pedido_id uuid,
  p_caixa_id uuid,
  p_forma erp.erp_forma_pagamento,
  p_valor numeric,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
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
$$;

REVOKE ALL ON FUNCTION erp.aplicar_entrada_pedido(uuid, uuid, erp.erp_forma_pagamento, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION erp.aplicar_entrada_pedido(uuid, uuid, erp.erp_forma_pagamento, numeric, text) TO authenticated, service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
