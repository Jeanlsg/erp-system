-- =====================================================
-- ERP System · Views Úteis (prefixo erp_)
-- Migration: 010_views.sql
-- =====================================================

-- ===== Aniversariantes do Mês =====
CREATE OR REPLACE VIEW v_erp_aniversariantes_mes AS
SELECT
  id,
  nome_razao,
  email,
  telefone,
  celular,
  endereco->>'data_nascimento' as data_nascimento,
  EXTRACT(MONTH FROM (endereco->>'data_nascimento')::date) as mes,
  EXTRACT(DAY FROM (endereco->>'data_nascimento')::date) as dia,
  EXTRACT(YEAR FROM AGE(CURRENT_DATE, (endereco->>'data_nascimento')::date)) as idade
FROM erp_pessoas
WHERE endereco->>'data_nascimento' IS NOT NULL
  AND ativo = true;

-- ===== Contas Vencidas =====
CREATE OR REPLACE VIEW v_erp_contas_vencidas AS
SELECT
  c.*,
  p.nome_razao as pessoa_nome,
  p.email as pessoa_email,
  p.telefone as pessoa_telefone,
  p.celular as pessoa_celular,
  l.apelido as loja_apelido,
  (c.valor - c.valor_pago) as valor_restante,
  (CURRENT_DATE - c.data_vencimento) as dias_atraso
FROM erp_contas c
JOIN erp_lojas l ON l.id = c.loja_id
LEFT JOIN erp_pessoas p ON p.id = c.pessoa_id
WHERE c.status = 'pendente'
  AND c.data_vencimento < CURRENT_DATE;

-- ===== Vendas por Dia (Consolidado) =====
CREATE OR REPLACE VIEW v_erp_vendas_por_dia AS
SELECT
  v.loja_id,
  l.apelido as loja_apelido,
  DATE(v.data_venda) as dia,
  COUNT(*) as total_vendas,
  SUM(v.total) as valor_total,
  SUM(v.custo_total) as custo_total,
  SUM(v.lucro_total) as lucro_total,
  SUM(v.desconto) as total_desconto
FROM erp_vendas v
JOIN erp_lojas l ON l.id = v.loja_id
WHERE v.status = 'finalizada'
GROUP BY v.loja_id, l.apelido, DATE(v.data_venda);

-- ===== Top Produtos (Mais Vendidos) =====
CREATE OR REPLACE VIEW v_erp_top_produtos AS
SELECT
  vi.produto_id,
  p.sku,
  p.nome,
  vi.loja_id,
  l.apelido as loja_apelido,
  SUM(vi.quantidade) as quantidade_vendida,
  SUM(vi.subtotal) as receita_total,
  SUM(vi.preco_custo * vi.quantidade) as custo_total,
  SUM(vi.subtotal - (vi.preco_custo * vi.quantidade)) as lucro_total,
  COUNT(DISTINCT v.id) as num_vendas
FROM erp_venda_itens vi
JOIN erp_vendas v ON v.id = vi.venda_id
JOIN erp_produtos p ON p.id = vi.produto_id
JOIN erp_lojas l ON l.id = vi.loja_id
WHERE v.status = 'finalizada'
  AND vi.produto_id IS NOT NULL
GROUP BY vi.produto_id, p.sku, p.nome, vi.loja_id, l.apelido;

-- ===== Estoque Baixo =====
CREATE OR REPLACE VIEW v_erp_estoque_baixo AS
SELECT
  p.id as produto_id,
  p.sku,
  p.nome,
  p.estoque_minimo,
  e.loja_id,
  l.apelido as loja_apelido,
  e.quantidade,
  (p.estoque_minimo - e.quantidade) as deficit
FROM erp_produtos p
JOIN erp_estoque e ON e.produto_id = p.id
JOIN erp_lojas l ON l.id = e.loja_id
WHERE e.quantidade <= p.estoque_minimo
  AND p.ativo = true
  AND p.estoque_minimo > 0;

-- ===== Lotes Próximos do Vencimento =====
CREATE OR REPLACE VIEW v_erp_lotes_vencendo AS
SELECT
  lo.id as lote_id,
  lo.codigo,
  lo.produto_id,
  p.nome as produto_nome,
  p.sku,
  lo.loja_id,
  l.apelido as loja_apelido,
  lo.data_validade,
  lo.quantidade,
  (lo.data_validade - CURRENT_DATE) as dias_para_vencer,
  CASE
    WHEN lo.data_validade < CURRENT_DATE THEN 'vencido'
    WHEN (lo.data_validade - CURRENT_DATE) <= 30 THEN 'critico'
    WHEN (lo.data_validade - CURRENT_DATE) <= 60 THEN 'alerta'
    ELSE 'ok'
  END as severidade
FROM erp_lotes lo
JOIN erp_produtos p ON p.id = lo.produto_id
JOIN erp_lojas l ON l.id = lo.loja_id
WHERE lo.quantidade > 0
  AND (lo.data_validade - CURRENT_DATE) <= 60;

-- ===== Fluxo de Caixa =====
CREATE OR REPLACE VIEW v_erp_fluxo_caixa AS
SELECT
  DATE(v.data_venda) as data,
  v.loja_id,
  l.apelido as loja_apelido,
  v.forma_pagamento,
  SUM(v.total) as total_vendas,
  SUM(v.custo_total) as custo,
  SUM(v.lucro_total) as lucro,
  COUNT(*) as qtd_vendas
FROM erp_vendas v
JOIN erp_lojas l ON l.id = v.loja_id
WHERE v.status = 'finalizada'
GROUP BY DATE(v.data_venda), v.loja_id, l.apelido, v.forma_pagamento;

-- ===== Resumo por Loja =====
CREATE OR REPLACE VIEW v_erp_resumo_loja AS
SELECT
  l.id as loja_id,
  l.apelido,
  l.cnpj,
  COUNT(DISTINCT v.id) as total_vendas,
  COALESCE(SUM(v.total), 0) as receita_total,
  COALESCE(SUM(v.lucro_total), 0) as lucro_total,
  COALESCE(SUM(v.desconto), 0) as total_desconto,
  COUNT(DISTINCT p.id) as total_produtos,
  COALESCE(SUM(e.quantidade), 0) as total_estoque
FROM erp_lojas l
LEFT JOIN erp_vendas v ON v.loja_id = l.id AND v.status = 'finalizada'
LEFT JOIN erp_produtos p ON p.ativo = true
LEFT JOIN erp_estoque e ON e.loja_id = l.id AND e.produto_id = p.id
GROUP BY l.id, l.apelido, l.cnpj;

-- ===== Aniversariantes da Semana =====
CREATE OR REPLACE VIEW v_erp_aniversariantes_semana AS
SELECT
  id,
  nome_razao,
  email,
  telefone,
  celular,
  endereco->>'data_nascimento' as data_nascimento,
  EXTRACT(MONTH FROM (endereco->>'data_nascimento')::date) as mes,
  EXTRACT(DAY FROM (endereco->>'data_nascimento')::date) as dia,
  EXTRACT(YEAR FROM AGE(CURRENT_DATE, (endereco->>'data_nascimento')::date)) as idade,
  EXTRACT(DOY FROM (endereco->>'data_nascimento')::date) as dia_ano
FROM erp_pessoas
WHERE endereco->>'data_nascimento' IS NOT NULL
  AND ativo = true
  AND EXTRACT(DOY FROM (endereco->>'data_nascimento')::date) BETWEEN
      EXTRACT(DOY FROM CURRENT_DATE) AND
      EXTRACT(DOY FROM CURRENT_DATE + INTERVAL '7 days');