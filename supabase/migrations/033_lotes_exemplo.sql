-- =====================================================
-- ERP System · Lotes de Exemplo para Testar Alertas
-- Migration: 033_lotes_exemplo.sql
--
-- Cria lotes com diferentes prazos de validade para testar
-- o sistema de alertas do header (vence em 5d, 15d, 25d, 45d, vencido)
-- =====================================================

DO $$
DECLARE
  v_produto RECORD;
  v_count INTEGER := 0;
  v_loja_id UUID := 'e385d4aa-e724-440b-8336-88daafe06ed4';
BEGIN
  FOR v_produto IN
    SELECT id, sku, nome FROM erp.erp_produtos WHERE ativo = true ORDER BY id LIMIT 8
  LOOP
    v_count := v_count + 1;

    INSERT INTO erp.erp_lotes (produto_id, loja_id, codigo, data_fabricacao, data_validade, quantidade)
    VALUES (
      v_produto.id,
      v_loja_id,
      'LT-' || EXTRACT(YEAR FROM CURRENT_DATE)::text || '-' || LPAD(v_count::text, 4, '0'),
      CURRENT_DATE - INTERVAL '30 days',
      CASE v_count
        WHEN 1 THEN CURRENT_DATE - INTERVAL '10 days'   -- vencido há 10d
        WHEN 2 THEN CURRENT_DATE + INTERVAL '5 days'    -- vence em 5d (crítico)
        WHEN 3 THEN CURRENT_DATE + INTERVAL '15 days'   -- vence em 15d (crítico)
        WHEN 4 THEN CURRENT_DATE + INTERVAL '25 days'   -- vence em 25d (crítico)
        WHEN 5 THEN CURRENT_DATE + INTERVAL '45 days'   -- vence em 45d (alerta)
        WHEN 6 THEN CURRENT_DATE + INTERVAL '75 days'   -- vence em 75d (alerta)
        WHEN 7 THEN CURRENT_DATE + INTERVAL '100 days'  -- vence em 100d
        ELSE CURRENT_DATE + INTERVAL '180 days'         -- vence em 180d
      END,
      20 + (random() * 30)::int
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Também inserir alguns na filial Petrolina
DO $$
DECLARE
  v_produto RECORD;
  v_count INTEGER := 0;
  v_loja_id UUID := '7b26a64b-7832-415c-b1c5-641e3f624d54';
BEGIN
  FOR v_produto IN
    SELECT id, sku FROM erp.erp_produtos WHERE ativo = true ORDER BY id LIMIT 4
  LOOP
    v_count := v_count + 1;
    INSERT INTO erp.erp_lotes (produto_id, loja_id, codigo, data_fabricacao, data_validade, quantidade)
    VALUES (
      v_produto.id,
      v_loja_id,
      'LT-P-' || EXTRACT(YEAR FROM CURRENT_DATE)::text || '-' || LPAD(v_count::text, 4, '0'),
      CURRENT_DATE - INTERVAL '60 days',
      CASE v_count
        WHEN 1 THEN CURRENT_DATE + INTERVAL '3 days'    -- muito crítico
        WHEN 2 THEN CURRENT_DATE + INTERVAL '12 days'   -- crítico
        WHEN 3 THEN CURRENT_DATE + INTERVAL '40 days'   -- alerta
        ELSE CURRENT_DATE + INTERVAL '90 days'
      END,
      15 + (random() * 20)::int
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Verificar resultado
SELECT
  l.codigo,
  p.nome AS produto,
  l.data_validade,
  (l.data_validade - CURRENT_DATE) AS dias,
  CASE
    WHEN l.data_validade < CURRENT_DATE THEN '🔴 VENCIDO'
    WHEN l.data_validade <= CURRENT_DATE + 30 THEN '🟠 CRÍTICO (≤30d)'
    WHEN l.data_validade <= CURRENT_DATE + 60 THEN '🟡 ALERTA (≤60d)'
    ELSE '🟢 OK'
  END AS status
FROM erp.erp_lotes l
JOIN erp.erp_produtos p ON p.id = l.produto_id
ORDER BY l.data_validade;