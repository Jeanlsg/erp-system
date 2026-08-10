-- =====================================================
-- Migration 039: View Consolidada de Produtos
-- Combina erp_produtos + erp_estoque + erp_lotes em uma
-- única view para a página unificada.
--
-- Estrutura mantida (3 tabelas) por boas práticas de
-- normalização, mas a UI consome UMA view.
-- =====================================================

-- ===== View consolidada por LOJA (uma linha por produto+loja) =====
CREATE OR REPLACE VIEW erp.v_erp_produto_completo AS
SELECT
  p.id AS produto_id,
  p.sku,
  p.nome,
  p.descricao,
  p.categoria_id,
  c.nome AS categoria_nome,
  p.marca,
  p.modelo,
  p.unidade,
  p.codigo_barras,
  p.imagem_url,
  p.preco_custo,
  p.preco_venda,
  p.estoque_minimo,
  p.estoque_maximo,
  p.peso,
  p.volume,
  p.ncm,
  p.cfop,
  p.icms,
  p.ipi,
  p.pis,
  p.cofins,
  p.cest,
  p.orig,
  p.comissao_percentual,
  p.tipo_produto,
  p.controla_lote,
  p.controla_serie,
  p.ativo,
  p.created_at AS produto_created_at,
  p.updated_at AS produto_updated_at,
  -- Loja
  l.id AS loja_id,
  l.apelido AS loja_apelido,
  l.nome AS loja_nome,
  -- Estoque
  COALESCE(e.quantidade, 0) AS estoque_atual,
  e.localizacao,
  e.updated_at AS estoque_updated_at,
  -- Status de estoque
  CASE
    WHEN COALESCE(e.quantidade, 0) = 0 THEN 'sem_estoque'
    WHEN COALESCE(e.quantidade, 0) <= p.estoque_minimo THEN 'baixo'
    WHEN p.estoque_maximo IS NOT NULL AND COALESCE(e.quantidade, 0) >= p.estoque_maximo THEN 'excesso'
    ELSE 'ok'
  END AS status_estoque,
  -- Valor em estoque
  (COALESCE(e.quantidade, 0) * p.preco_custo) AS valor_estoque,
  -- Lotes (agregados)
  COALESCE(lotes_resumo.qtd_lotes, 0) AS qtd_lotes,
  COALESCE(lotes_resumo.qtd_total_lotes, 0) AS qtd_total_lotes,
  lotes_resumo.lote_mais_proximo_validade,
  lotes_resumo.lote_mais_proximo_dias,
  lotes_resumo.lote_mais_proximo_severidade
FROM erp.erp_produtos p
LEFT JOIN erp.erp_categorias c ON c.id = p.categoria_id
LEFT JOIN erp.erp_lojas l ON l.ativo = true
LEFT JOIN erp.erp_estoque e
  ON e.produto_id = p.id AND e.loja_id = l.id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS qtd_lotes,
    SUM(lo.quantidade) AS qtd_total_lotes,
    MIN(lo.data_validade) AS lote_mais_proximo_validade,
    MIN(lo.data_validade) - CURRENT_DATE AS lote_mais_proximo_dias,
    CASE
      WHEN MIN(lo.data_validade) < CURRENT_DATE THEN 'vencido'
      WHEN MIN(lo.data_validade) <= CURRENT_DATE + INTERVAL '30 days' THEN 'critico'
      WHEN MIN(lo.data_validade) <= CURRENT_DATE + INTERVAL '60 days' THEN 'alerta'
      ELSE 'ok'
    END AS lote_mais_proximo_severidade
  FROM erp.erp_lotes lo
  WHERE lo.produto_id = p.id
    AND lo.loja_id = l.id
    AND lo.quantidade > 0
) lotes_resumo ON true
WHERE p.ativo = true;

-- ===== Comentários =====
COMMENT ON VIEW erp.v_erp_produto_completo IS 'Visão consolidada de produtos + estoque por loja + lotes (1 linha por produto+loja)';

-- ===== Permissões =====
GRANT SELECT ON erp.v_erp_produto_completo TO authenticated;

-- ===== View alternativa: total agregado (sem loja) =====
CREATE OR REPLACE VIEW erp.v_erp_produto_total AS
SELECT
  p.id AS produto_id,
  p.sku,
  p.nome,
  p.categoria_id,
  c.nome AS categoria_nome,
  p.marca,
  p.unidade,
  p.codigo_barras,
  p.preco_custo,
  p.preco_venda,
  p.estoque_minimo,
  p.tipo_produto,
  p.controla_lote,
  p.ativo,
  -- Estoque total somado
  COALESCE(SUM(e.quantidade), 0) AS estoque_total,
  COUNT(DISTINCT e.loja_id) AS qtd_lojas_com_estoque,
  CASE
    WHEN COALESCE(SUM(e.quantidade), 0) = 0 THEN 'sem_estoque'
    WHEN COALESCE(SUM(e.quantidade), 0) <= p.estoque_minimo THEN 'baixo'
    ELSE 'ok'
  END AS status_estoque,
  -- Lotes
  COALESCE(lotes_resumo.qtd_lotes, 0) AS qtd_lotes,
  COALESCE(lotes_resumo.qtd_total_lotes, 0) AS qtd_total_lotes,
  lotes_resumo.lote_mais_proximo_validade,
  lotes_resumo.lote_mais_proximo_severidade
FROM erp.erp_produtos p
LEFT JOIN erp.erp_categorias c ON c.id = p.categoria_id
LEFT JOIN erp.erp_estoque e ON e.produto_id = p.id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS qtd_lotes,
    SUM(lo.quantidade) AS qtd_total_lotes,
    MIN(lo.data_validade) AS lote_mais_proximo_validade,
    CASE
      WHEN MIN(lo.data_validade) < CURRENT_DATE THEN 'vencido'
      WHEN MIN(lo.data_validade) <= CURRENT_DATE + INTERVAL '30 days' THEN 'critico'
      WHEN MIN(lo.data_validade) <= CURRENT_DATE + INTERVAL '60 days' THEN 'alerta'
      ELSE 'ok'
    END AS lote_mais_proximo_severidade
  FROM erp.erp_lotes lo
  WHERE lo.produto_id = p.id AND lo.quantidade > 0
) lotes_resumo ON true
WHERE p.ativo = true
GROUP BY p.id, c.nome, lotes_resumo.qtd_lotes, lotes_resumo.qtd_total_lotes,
         lotes_resumo.lote_mais_proximo_validade, lotes_resumo.lote_mais_proximo_severidade;

COMMENT ON VIEW erp.v_erp_produto_total IS 'Visão consolidada agregando estoque total de todas as lojas (1 linha por produto)';

GRANT SELECT ON erp.v_erp_produto_total TO authenticated;

-- ===== Notificar PostgREST para recarregar schema =====
NOTIFY pgrst, 'reload schema';