-- ============================================================
-- 085 — uma venda pode ter mais de uma forma de pagamento
--
-- erp_vendas tem UMA forma_pagamento. Cliente que paga metade no cartão e
-- metade em dinheiro é registrado como se tivesse pago tudo de uma forma
-- só — e o erro não para aí: a conta da gaveta soma as vendas "em
-- dinheiro", então a venda mista lançada como dinheiro faz o fechamento
-- esperar dinheiro que nunca entrou (ou o contrário).
--
-- A coluna antiga CONTINUA, preenchida com a forma de maior valor. Não é
-- redundância: relatório antigo, integração e o histórico de milhares de
-- vendas dependem dela, e reescrever isso agora seria trocar um erro
-- conhecido por um desconhecido.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS erp.erp_venda_pagamentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id      uuid NOT NULL REFERENCES erp.erp_vendas(id) ON DELETE CASCADE,
  forma         erp.erp_forma_pagamento NOT NULL,
  valor         numeric(14,2) NOT NULL CHECK (valor > 0),
  -- o que o cliente entregou nesta forma; só difere de `valor` em dinheiro
  valor_recebido numeric(14,2),
  troco         numeric(14,2) NOT NULL DEFAULT 0,
  bandeira      text,
  parcelas      integer NOT NULL DEFAULT 1 CHECK (parcelas >= 1),
  autorizacao   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venda_pagamentos_venda ON erp.erp_venda_pagamentos(venda_id);

COMMENT ON TABLE erp.erp_venda_pagamentos IS
  'As formas com que a venda foi paga. A venda mista vive aqui; erp_vendas.forma_pagamento guarda a de maior valor, para o histórico não mudar de sentido.';
COMMENT ON COLUMN erp.erp_venda_pagamentos.troco IS
  'Devolvido nesta linha. Só existe em dinheiro: cartão e PIX não dão troco.';

ALTER TABLE erp.erp_venda_pagamentos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_venda_pagamentos TO authenticated;

DROP POLICY IF EXISTS erp_venda_pagamentos_operacao ON erp.erp_venda_pagamentos;
CREATE POLICY erp_venda_pagamentos_operacao ON erp.erp_venda_pagamentos
  FOR ALL TO authenticated
  USING ((SELECT erp.current_erp_user_id()) IS NOT NULL)
  WITH CHECK ((SELECT erp.current_erp_user_id()) IS NOT NULL);

-- ---------- a gaveta passa a olhar os pagamentos ----------
-- Venda antiga não tem linha em erp_venda_pagamentos; para ela vale a
-- forma única, como sempre valeu. Venda nova soma por forma.
CREATE OR REPLACE FUNCTION erp.venda_valor_na_forma(p_venda erp.erp_vendas, p_forma erp.erp_forma_pagamento)
RETURNS numeric
LANGUAGE sql STABLE
SET search_path TO 'erp', 'public' AS $$
  SELECT COALESCE(
    (SELECT sum(p.valor) FROM erp.erp_venda_pagamentos p
      WHERE p.venda_id = p_venda.id AND p.forma = p_forma),
    CASE WHEN p_venda.forma_pagamento = p_forma THEN p_venda.total ELSE 0 END
  );
$$;

COMMENT ON FUNCTION erp.venda_valor_na_forma(erp.erp_vendas, erp.erp_forma_pagamento) IS
  'Quanto da venda foi pago nesta forma. Cai na forma única quando a venda não tem pagamentos detalhados — é o caso de tudo que foi vendido antes da migration 085.';

DROP VIEW IF EXISTS erp.vw_caixa_resumo;
CREATE VIEW erp.vw_caixa_resumo AS
SELECT c.id, c.loja_id, c.usuario_id, c.data_abertura, c.data_fechamento,
       c.valor_inicial, c.valor_final, c.total_vendas, c.total_sangrias,
       c.total_entradas_extras, c.observacoes, c.status, c.numero_caixa,
       c.valor_troco, c.encerrado_por, c.updated_at, c.ponto_venda_id,
       COALESCE(v.vendas, 0)            AS total_vendas_real,
       COALESCE(v.troco, 0)             AS valor_troco_real,
       COALESCE(s.sangrias, 0)          AS total_sangrias_real,
       COALESCE(e.entradas, 0)          AS total_entradas_extras_real,
       COALESCE(v.dinheiro, 0)          AS vendas_dinheiro,
       COALESCE(v.pix, 0)               AS vendas_pix,
       COALESCE(v.credito, 0)           AS vendas_cartao_credito,
       COALESCE(v.debito, 0)            AS vendas_cartao_debito,
       COALESCE(v.outras, 0)            AS vendas_outras,
       COALESCE(s.sangrias_dinheiro, 0) AS sangrias_dinheiro,
       COALESCE(e.entradas_dinheiro, 0) AS entradas_dinheiro,
       c.valor_inicial
         + COALESCE(v.dinheiro, 0)
         - COALESCE(s.sangrias_dinheiro, 0)
         + COALESCE(e.entradas_dinheiro, 0) AS valor_esperado_gaveta
  FROM erp.erp_caixa c
  LEFT JOIN LATERAL (
    SELECT sum(x.total) AS vendas,
           sum(x.troco) AS troco,
           sum(erp.venda_valor_na_forma(x, 'dinheiro'))       AS dinheiro,
           sum(erp.venda_valor_na_forma(x, 'pix'))            AS pix,
           sum(erp.venda_valor_na_forma(x, 'cartao_credito')) AS credito,
           sum(erp.venda_valor_na_forma(x, 'cartao_debito'))  AS debito,
           sum(x.total
               - erp.venda_valor_na_forma(x, 'dinheiro')
               - erp.venda_valor_na_forma(x, 'pix')
               - erp.venda_valor_na_forma(x, 'cartao_credito')
               - erp.venda_valor_na_forma(x, 'cartao_debito'))  AS outras
      FROM erp.erp_vendas x
     WHERE x.caixa_id = c.id AND x.status::text = 'finalizada'
  ) v ON true
  LEFT JOIN LATERAL (
    SELECT sum(x.valor) AS sangrias,
           sum(x.valor) FILTER (WHERE x.forma_pagamento = 'dinheiro') AS sangrias_dinheiro
      FROM erp.erp_sangrias x WHERE x.caixa_id = c.id
  ) s ON true
  LEFT JOIN LATERAL (
    SELECT sum(x.valor) AS entradas,
           sum(x.valor) FILTER (WHERE x.forma_pagamento = 'dinheiro') AS entradas_dinheiro
      FROM erp.erp_entradas_extras x WHERE x.caixa_id = c.id
  ) e ON true;

COMMENT ON VIEW erp.vw_caixa_resumo IS
  'Movimento real do caixa. As formas somam de erp_venda_pagamentos quando existem — a venda mista conta em cada forma pelo que foi pago nela.';

GRANT SELECT ON erp.vw_caixa_resumo TO authenticated, service_role;

COMMIT;
