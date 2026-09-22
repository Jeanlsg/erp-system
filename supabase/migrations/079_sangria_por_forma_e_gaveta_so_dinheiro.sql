-- ============================================================
-- 079 — sangria por forma de pagamento, e a gaveta volta a fechar
--
-- Dois defeitos no mesmo cálculo, o valor_esperado_gaveta da vw_caixa_resumo:
--
--   valor_inicial + TODAS as vendas - TODAS as sangrias + entradas - troco
--
-- 1. "TODAS as vendas" inclui cartão, PIX, crediário e boleto. Venda de
--    R$ 189 no débito não põe R$ 189 na gaveta. Medido em produção: um
--    caixa com troco inicial de 200 e uma venda no débito de 189 mostrava
--    esperado 389 contra 200 informados — o operador contou certo e o
--    sistema acusou falta de 189. Numa loja que aceita cartão, a
--    conferência de caixa era inútil.
--
-- 2. "- troco" desconta duas vezes. `total` já é o líquido da venda: o
--    cliente entrega 100, leva 11 de troco, e na gaveta ficam os 89 que
--    são o total. Não apareceu ainda porque as vendas em dinheiro até
--    hoje tiveram troco zero.
--
-- 3. E a sangria não tinha forma: "tirei 15 no PIX para pagar o motoboy"
--    era registrado igual a "tirei 15 da gaveta", e o fechamento passava a
--    esperar 15 a menos em dinheiro que existiam de verdade.
--
-- A gaveta passa a contar só o que é dinheiro vivo. Os totais gerais
-- continuam disponíveis, agora separados por forma, para o relatório e
-- para a conferência das maquininhas.
-- ============================================================

BEGIN;

-- ---------- sangria ganha forma ----------
ALTER TABLE erp.erp_sangrias
  ADD COLUMN IF NOT EXISTS forma_pagamento erp.erp_forma_pagamento NOT NULL DEFAULT 'dinheiro';

COMMENT ON COLUMN erp.erp_sangrias.forma_pagamento IS
  'De onde o dinheiro saiu. Só "dinheiro" reduz o esperado na gaveta; PIX e transferência são saída do caixa mas não da gaveta física.';

-- O que já existe é sangria de gaveta: o modal antigo não perguntava a
-- forma, e a operação de balcão tira dinheiro. Ficam como dinheiro (o
-- default), que é o comportamento que elas tiveram até aqui.

-- ---------- a gaveta conta só dinheiro ----------
-- REPLACE não reordena colunas de view; e a view ganha colunas no meio.
DROP VIEW IF EXISTS erp.vw_caixa_resumo;
CREATE VIEW erp.vw_caixa_resumo AS
SELECT c.id,
       c.loja_id,
       c.usuario_id,
       c.data_abertura,
       c.data_fechamento,
       c.valor_inicial,
       c.valor_final,
       c.total_vendas,
       c.total_sangrias,
       c.total_entradas_extras,
       c.observacoes,
       c.status,
       c.numero_caixa,
       c.valor_troco,
       c.encerrado_por,
       c.updated_at,
       COALESCE(v.vendas, 0)            AS total_vendas_real,
       COALESCE(v.troco, 0)             AS valor_troco_real,
       COALESCE(s.sangrias, 0)          AS total_sangrias_real,
       COALESCE(e.entradas, 0)          AS total_entradas_extras_real,
       -- por forma, para conferir maquininha e PIX no fechamento
       COALESCE(v.vendas_dinheiro, 0)   AS vendas_dinheiro,
       COALESCE(v.vendas_pix, 0)        AS vendas_pix,
       COALESCE(v.vendas_credito, 0)    AS vendas_cartao_credito,
       COALESCE(v.vendas_debito, 0)     AS vendas_cartao_debito,
       COALESCE(v.vendas_outras, 0)     AS vendas_outras,
       COALESCE(s.sangrias_dinheiro, 0) AS sangrias_dinheiro,
       COALESCE(e.entradas_dinheiro, 0) AS entradas_dinheiro,
       -- O que tem de estar na gaveta ao contar: troco inicial, mais o que
       -- entrou EM DINHEIRO, menos o que saiu EM DINHEIRO. `total` já é o
       -- líquido da venda, então o troco não entra de novo.
       c.valor_inicial
         + COALESCE(v.vendas_dinheiro, 0)
         - COALESCE(s.sangrias_dinheiro, 0)
         + COALESCE(e.entradas_dinheiro, 0) AS valor_esperado_gaveta
  FROM erp.erp_caixa c
  LEFT JOIN LATERAL (
    SELECT sum(x.total)                                                      AS vendas,
           sum(x.troco)                                                      AS troco,
           sum(x.total) FILTER (WHERE x.forma_pagamento = 'dinheiro')        AS vendas_dinheiro,
           sum(x.total) FILTER (WHERE x.forma_pagamento = 'pix')             AS vendas_pix,
           sum(x.total) FILTER (WHERE x.forma_pagamento = 'cartao_credito')  AS vendas_credito,
           sum(x.total) FILTER (WHERE x.forma_pagamento = 'cartao_debito')   AS vendas_debito,
           sum(x.total) FILTER (WHERE x.forma_pagamento NOT IN
                ('dinheiro','pix','cartao_credito','cartao_debito'))         AS vendas_outras
      FROM erp.erp_vendas x
     WHERE x.caixa_id = c.id AND x.status::text = 'finalizada'
  ) v ON true
  LEFT JOIN LATERAL (
    SELECT sum(x.valor)                                               AS sangrias,
           sum(x.valor) FILTER (WHERE x.forma_pagamento = 'dinheiro') AS sangrias_dinheiro
      FROM erp.erp_sangrias x WHERE x.caixa_id = c.id
  ) s ON true
  LEFT JOIN LATERAL (
    SELECT sum(x.valor)                                               AS entradas,
           sum(x.valor) FILTER (WHERE x.forma_pagamento = 'dinheiro') AS entradas_dinheiro
      FROM erp.erp_entradas_extras x WHERE x.caixa_id = c.id
  ) e ON true;

COMMENT ON VIEW erp.vw_caixa_resumo IS
  'Movimento real do caixa. valor_esperado_gaveta é só dinheiro vivo: cartão e PIX não passam pela gaveta e faziam o fechamento acusar falta do valor inteiro das vendas na maquininha.';

GRANT SELECT ON erp.vw_caixa_resumo TO authenticated, service_role;

COMMIT;
