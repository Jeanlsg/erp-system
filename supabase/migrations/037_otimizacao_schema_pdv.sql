-- =====================================================
-- Migration 037: Otimização do Schema PDV
-- =====================================================

-- ===== 1. Apenas UM caixa aberto por usuário =====
-- Remove caixas duplicados (mantém o mais recente)
DELETE FROM erp.erp_caixa a
WHERE EXISTS (
  SELECT 1 FROM erp.erp_caixa b
  WHERE b.usuario_id = a.usuario_id
    AND b.status = 'aberto'
    AND b.data_fechamento IS NULL
    AND b.data_abertura > a.data_abertura
);

-- ===== 2. Índice único parcial: apenas 1 caixa aberto por usuário =====
CREATE UNIQUE INDEX IF NOT EXISTS uq_erp_caixa_aberto_por_usuario
  ON erp.erp_caixa (usuario_id)
  WHERE status = 'aberto' AND data_fechamento IS NULL;

-- ===== 3. Índices adicionais para performance =====
CREATE INDEX IF NOT EXISTS idx_erp_caixa_status_data
  ON erp.erp_caixa (status, data_abertura DESC);

CREATE INDEX IF NOT EXISTS idx_erp_caixa_loja_status
  ON erp.erp_caixa (loja_id, status);

-- ===== 4. Função para fechar caixa automaticamente se tentar abrir outro =====
CREATE OR REPLACE FUNCTION erp.fn_fechar_caixa_anterior()
RETURNS TRIGGER AS $$
BEGIN
  -- Se está abrindo um novo caixa aberto, fecha qualquer caixa aberto anterior do mesmo usuário
  IF NEW.status = 'aberto' AND NEW.data_fechamento IS NULL THEN
    UPDATE erp.erp_caixa
    SET status = 'fechado',
        data_fechamento = NOW(),
        observacoes = COALESCE(observacoes, '') || ' | Fechado automaticamente ao abrir novo caixa'
    WHERE usuario_id = NEW.usuario_id
      AND status = 'aberto'
      AND data_fechamento IS NULL
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_erp_caixa_fechar_anterior ON erp.erp_caixa;
CREATE TRIGGER tg_erp_caixa_fechar_anterior
  BEFORE INSERT OR UPDATE ON erp.erp_caixa
  FOR EACH ROW
  EXECUTE FUNCTION erp.fn_fechar_caixa_anterior();

-- ===== 5. Função para criar fechamento automaticamente quando caixa fecha =====
CREATE OR REPLACE FUNCTION erp.fn_criar_fechamento_automatico()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o caixa acabou de ser fechado e não tem fechamento criado
  IF NEW.status = 'fechado'
     AND NEW.data_fechamento IS NOT NULL
     AND (OLD.status IS NULL OR OLD.status != 'fechado' OR OLD.data_fechamento IS NULL)
  THEN
    INSERT INTO erp.erp_fechamentos_caixa (
      caixa_id, usuario_id, data_fechamento,
      valor_inicial, valor_final, valor_vendas, valor_sangrias, valor_entradas, valor_troco,
      valor_dinheiro, valor_pix, valor_cartao_credito, valor_cartao_debito,
      valor_crediario, valor_boleto, valor_outros, diferenca, observacoes
    ) VALUES (
      NEW.id, NEW.usuario_id, NEW.data_fechamento,
      NEW.valor_inicial, COALESCE(NEW.valor_final, 0), NEW.total_vendas, NEW.total_sangrias,
      NEW.total_entradas_extras, NEW.valor_troco,
      0, 0, 0, 0, 0, 0, 0,
      COALESCE(NEW.valor_final, 0) - (NEW.valor_inicial + NEW.total_vendas - NEW.total_sangrias + NEW.total_entradas_extras - NEW.valor_troco),
      NEW.observacoes
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_erp_caixa_criar_fechamento ON erp.erp_caixa;
CREATE TRIGGER tg_erp_caixa_criar_fechamento
  AFTER INSERT OR UPDATE ON erp.erp_caixa
  FOR EACH ROW
  EXECUTE FUNCTION erp.fn_criar_fechamento_automatico();

-- ===== 6. View para resumo do caixa =====
CREATE OR REPLACE VIEW erp.v_erp_caixa_resumo AS
SELECT
  c.id,
  c.loja_id,
  c.usuario_id,
  c.numero_caixa,
  c.status,
  c.data_abertura,
  c.data_fechamento,
  c.valor_inicial,
  c.valor_final,
  c.total_vendas,
  c.total_sangrias,
  c.total_entradas_extras,
  c.valor_troco,
  -- Saldo atual = inicial + vendas - sangrias + entradas - troco
  (c.valor_inicial + c.total_vendas - c.total_sangrias + c.total_entradas_extras - c.valor_troco) AS saldo_atual,
  -- Quantidade de vendas realizadas
  COALESCE(v.qtd_vendas, 0) AS qtd_vendas,
  -- Tempo aberto em horas
  CASE
    WHEN c.data_fechamento IS NOT NULL
    THEN EXTRACT(EPOCH FROM (c.data_fechamento - c.data_abertura)) / 3600
    ELSE EXTRACT(EPOCH FROM (NOW() - c.data_abertura)) / 3600
  END AS horas_aberto
FROM erp.erp_caixa c
LEFT JOIN (
  SELECT caixa_id, COUNT(*) AS qtd_vendas
  FROM erp.erp_vendas
  WHERE caixa_id IS NOT NULL
  GROUP BY caixa_id
) v ON v.caixa_id = c.id;

-- ===== 7. Comentários =====
COMMENT ON INDEX uq_erp_caixa_aberto_por_usuario IS 'Garante apenas 1 caixa aberto por usuário';
COMMENT ON FUNCTION erp.fn_fechar_caixa_anterior IS 'Fecha automaticamente caixas abertos anteriores ao abrir novo';
COMMENT ON FUNCTION erp.fn_criar_fechamento_automatico IS 'Cria registro de fechamento automaticamente ao fechar caixa';