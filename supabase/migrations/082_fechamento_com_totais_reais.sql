-- ============================================================
-- 082 — o fechamento registrava "vendas: R$ 0,00" e inventava diferença
--
-- fn_criar_fechamento_automatico monta a linha de fechamento a partir de
-- NEW.total_vendas, NEW.total_sangrias e NEW.total_entradas_extras — três
-- colunas de erp_caixa que NUNCA são preenchidas por ninguém: ficam 0.00
-- desde a abertura. Quem tem o número real é vw_caixa_resumo, que soma as
-- vendas e sangrias do caixa.
--
-- Medido em produção: o caixa fechado em 19/09 teve uma venda de R$ 89 em
-- dinheiro. O fechamento gravou vendas = 0,00, esperado = 200 (só o troco
-- inicial) e, contra os 289 contados, uma diferença de R$ 89 — exatamente o
-- valor vendido. O operador contou certo e o relatório acusou sobra.
--
-- O trigger passa a ler a view. O esperado na gaveta também vem dela, que
-- desde a migration 079 conta só dinheiro vivo.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION erp.fn_criar_fechamento_automatico()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'erp', 'public'
AS $$
DECLARE
  r RECORD;
BEGIN
  IF NEW.status = 'fechado' AND NEW.data_fechamento IS NOT NULL
     AND (OLD.status IS NULL OR OLD.status <> 'fechado' OR OLD.data_fechamento IS NULL) THEN

    SELECT total_vendas_real, total_sangrias_real, total_entradas_extras_real,
           valor_troco_real, valor_esperado_gaveta,
           vendas_dinheiro, vendas_pix, vendas_cartao_credito, vendas_cartao_debito
      INTO r
      FROM erp.vw_caixa_resumo WHERE id = NEW.id;

    INSERT INTO erp.erp_fechamentos_caixa (
      caixa_id, usuario_id, data_fechamento, valor_inicial, valor_final,
      valor_vendas, valor_sangrias, valor_entradas, valor_troco,
      valor_dinheiro, valor_pix, valor_cartao_credito, valor_cartao_debito,
      valor_crediario, valor_boleto, valor_outros, diferenca, observacoes
    ) VALUES (
      NEW.id, NEW.usuario_id, NEW.data_fechamento, NEW.valor_inicial,
      COALESCE(NEW.valor_final, 0),
      COALESCE(r.total_vendas_real, 0),
      COALESCE(r.total_sangrias_real, 0),
      COALESCE(r.total_entradas_extras_real, 0),
      COALESCE(r.valor_troco_real, 0),
      -- o detalhamento por forma é preenchido pela tela, que pergunta ao
      -- operador quanto entrou em cada uma; aqui vai o que a venda registrou
      COALESCE(r.vendas_dinheiro, 0),
      COALESCE(r.vendas_pix, 0),
      COALESCE(r.vendas_cartao_credito, 0),
      COALESCE(r.vendas_cartao_debito, 0),
      0, 0, 0,
      COALESCE(NEW.valor_final, 0) - COALESCE(r.valor_esperado_gaveta, NEW.valor_inicial),
      NEW.observacoes
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION erp.fn_criar_fechamento_automatico() IS
  'Registra o fechamento a partir de vw_caixa_resumo. As colunas total_* de erp_caixa nunca são alimentadas e valiam 0, o que zerava as vendas do relatório e criava diferença falsa.';

COMMIT;
