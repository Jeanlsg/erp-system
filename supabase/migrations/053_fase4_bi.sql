-- ============================================================
-- 053: FASE 4 — BI sobre a fundação da fase 1
--
-- A fase 1 criou kardex com custo médio, plano de contas e contas
-- automáticas. Isso deixou de ser dado inventado, então agora dá para
-- responder as duas perguntas que o lojista faz de verdade:
--   "o que realmente me dá dinheiro?"  → curva ABC
--   "o que eu preciso comprar?"        → ponto de pedido
--
-- As duas saem de venda REALIZADA, não de cadastro. Curva ABC calculada
-- sobre preço de tabela seria uma opinião; sobre venda registrada é um fato.
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '120s';

-- Quantos dias o fornecedor leva para entregar. Entra no ponto de pedido:
-- sem lead time, "comprar quando acabar" chega tarde por definição.
INSERT INTO erp.erp_configuracoes_sistema (chave, valor, descricao)
SELECT 'lead_time_compra_dias', '15', 'Dias entre pedir ao fornecedor e a mercadoria entrar'
WHERE NOT EXISTS (SELECT 1 FROM erp.erp_configuracoes_sistema WHERE chave = 'lead_time_compra_dias');

INSERT INTO erp.erp_configuracoes_sistema (chave, valor, descricao)
SELECT 'janela_giro_dias', '90', 'Período usado para medir o giro do produto na sugestão de compra'
WHERE NOT EXISTS (SELECT 1 FROM erp.erp_configuracoes_sistema WHERE chave = 'janela_giro_dias');

-- ── Curva ABC ──
-- Classe A = os produtos que somam os primeiros 80% da receita, B até 95%,
-- C o resto. O corte é sobre o ACUMULADO, não sobre a participação
-- individual: é isso que separa "poucos itens que sustentam a loja" de
-- "muitos itens que só ocupam prateleira".
CREATE OR REPLACE FUNCTION erp.curva_abc(
  p_loja_id uuid    DEFAULT NULL,
  p_desde   date    DEFAULT NULL,
  p_ate     date    DEFAULT NULL
) RETURNS TABLE (
  produto_id     uuid,
  sku            text,
  produto_nome   text,
  quantidade     numeric,
  receita        numeric,
  custo          numeric,
  margem         numeric,
  margem_pct     numeric,
  participacao   numeric,
  acumulado      numeric,
  classe         text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = erp, public
AS $$
  WITH base AS (
    SELECT i.produto_id,
           SUM(i.quantidade)::numeric                        AS quantidade,
           SUM(COALESCE(i.valor_total, i.subtotal, 0))::numeric AS receita,
           SUM(COALESCE(i.preco_custo,0) * i.quantidade)::numeric AS custo
      FROM erp.erp_venda_itens i
      JOIN erp.erp_vendas v ON v.id = i.venda_id
     WHERE v.status = 'finalizada'
       AND i.produto_id IS NOT NULL
       AND (p_loja_id IS NULL OR v.loja_id = p_loja_id)
       AND (p_desde   IS NULL OR v.data_venda >= p_desde)
       AND (p_ate     IS NULL OR v.data_venda <  (p_ate + 1))
     GROUP BY i.produto_id
  ), total AS (
    SELECT NULLIF(SUM(receita), 0) AS receita_total FROM base
  ), ranqueado AS (
    SELECT b.*,
           b.receita / t.receita_total * 100 AS participacao,
           SUM(b.receita) OVER (ORDER BY b.receita DESC, b.produto_id)
             / t.receita_total * 100 AS acumulado
      FROM base b CROSS JOIN total t
     WHERE t.receita_total IS NOT NULL
  )
  SELECT r.produto_id,
         p.sku::text,
         p.nome::text,
         r.quantidade,
         round(r.receita, 2),
         round(r.custo, 2),
         round(r.receita - r.custo, 2),
         CASE WHEN r.receita > 0
              THEN round((r.receita - r.custo) / r.receita * 100, 2) ELSE 0 END,
         round(r.participacao, 2),
         round(r.acumulado, 2),
         CASE WHEN r.acumulado <= 80 THEN 'A'
              WHEN r.acumulado <= 95 THEN 'B'
              ELSE 'C' END
    FROM ranqueado r
    JOIN erp.erp_produtos p ON p.id = r.produto_id
   ORDER BY r.receita DESC;
$$;

GRANT EXECUTE ON FUNCTION erp.curva_abc(uuid, date, date) TO authenticated, service_role;

-- ── Ponto de pedido e sugestão de compra ──
-- "Comprar quando o estoque zerar" chega tarde: entre o pedido e a entrega
-- a loja fica sem vender. O ponto de pedido é o saldo em que ainda dá tempo:
-- consumo diário × lead time + o mínimo de segurança já cadastrado.
CREATE OR REPLACE VIEW erp.vw_sugestao_compra AS
WITH cfg AS (
  SELECT
    COALESCE((SELECT NULLIF(valor,'')::int FROM erp.erp_configuracoes_sistema WHERE chave='lead_time_compra_dias'), 15) AS lead,
    COALESCE((SELECT NULLIF(valor,'')::int FROM erp.erp_configuracoes_sistema WHERE chave='janela_giro_dias'), 90) AS janela
), giro AS (
  SELECT v.loja_id, i.produto_id,
         SUM(i.quantidade)::numeric AS vendido
    FROM erp.erp_venda_itens i
    JOIN erp.erp_vendas v ON v.id = i.venda_id
   CROSS JOIN cfg
   WHERE v.status = 'finalizada'
     AND i.produto_id IS NOT NULL
     AND v.data_venda >= now() - (cfg.janela || ' days')::interval
   GROUP BY v.loja_id, i.produto_id
)
SELECT e.loja_id,
       l.nome AS loja_nome,
       e.produto_id,
       p.sku,
       p.nome AS produto_nome,
       e.quantidade                                   AS estoque_atual,
       COALESCE(p.estoque_minimo, 0)                  AS estoque_minimo,
       COALESCE(g.vendido, 0)                         AS vendido_periodo,
       round(COALESCE(g.vendido,0) / cfg.janela, 3)   AS consumo_diario,
       ceil(COALESCE(g.vendido,0) / cfg.janela * cfg.lead
            + COALESCE(p.estoque_minimo,0))           AS ponto_pedido,
       -- Repor até cobrir o lead time mais a janela seguinte, descontando o
       -- que ainda há. Nunca sugere negativo.
       GREATEST(
         ceil(COALESCE(g.vendido,0) / cfg.janela * (cfg.lead + 30)
              + COALESCE(p.estoque_minimo,0) - e.quantidade),
         0)                                           AS sugestao_compra,
       -- Dias até acabar no ritmo atual. NULL = produto parado.
       CASE WHEN COALESCE(g.vendido,0) > 0
            THEN round(e.quantidade / (g.vendido / cfg.janela), 1)
            ELSE NULL END                             AS dias_de_cobertura,
       e.custo_medio
  FROM erp.erp_estoque e
  CROSS JOIN cfg
  JOIN erp.erp_lojas l    ON l.id = e.loja_id
  JOIN erp.erp_produtos p ON p.id = e.produto_id AND COALESCE(p.ativo, true)
  LEFT JOIN giro g ON g.loja_id = e.loja_id AND g.produto_id = e.produto_id
 WHERE e.quantidade <= ceil(COALESCE(g.vendido,0) / cfg.janela * cfg.lead
                            + COALESCE(p.estoque_minimo,0))
   -- Produto parado e com saldo não é sugestão de compra, é estoque encalhado.
   AND (COALESCE(g.vendido,0) > 0 OR e.quantidade <= COALESCE(p.estoque_minimo,0));

GRANT SELECT ON erp.vw_sugestao_compra TO authenticated, service_role;

-- ── Estoque parado ──
-- O outro lado da mesma pergunta: dinheiro imobilizado que não gira.
CREATE OR REPLACE VIEW erp.vw_estoque_parado AS
SELECT e.loja_id, l.nome AS loja_nome, e.produto_id, p.sku, p.nome AS produto_nome,
       e.quantidade, e.custo_medio,
       round(e.quantidade * COALESCE(e.custo_medio, p.preco_custo, 0), 2) AS capital_parado,
       (SELECT max(v.data_venda)
          FROM erp.erp_venda_itens i JOIN erp.erp_vendas v ON v.id = i.venda_id
         WHERE i.produto_id = e.produto_id AND v.loja_id = e.loja_id
           AND v.status = 'finalizada')               AS ultima_venda
  FROM erp.erp_estoque e
  JOIN erp.erp_lojas l    ON l.id = e.loja_id
  JOIN erp.erp_produtos p ON p.id = e.produto_id AND COALESCE(p.ativo, true)
 WHERE e.quantidade > 0
   AND NOT EXISTS (
     SELECT 1 FROM erp.erp_venda_itens i JOIN erp.erp_vendas v ON v.id = i.venda_id
      WHERE i.produto_id = e.produto_id AND v.loja_id = e.loja_id
        AND v.status = 'finalizada'
        AND v.data_venda >= now() - interval '90 days'
   );

GRANT SELECT ON erp.vw_estoque_parado TO authenticated, service_role;

-- ── DRE consolidado ──
-- vw_dre_mensal (fase 1) abre linha por conta contábil, que é o certo para
-- conferir. Para responder "o mês fechou positivo?" falta o consolidado.
CREATE OR REPLACE VIEW erp.vw_dre_resumo AS
SELECT d.loja_id,
       l.nome AS loja_nome,
       d.competencia,
       round(SUM(CASE WHEN d.natureza = 'receita' THEN d.realizado ELSE 0 END), 2) AS receita,
       round(SUM(CASE WHEN d.natureza = 'despesa' THEN d.realizado ELSE 0 END), 2) AS despesa,
       round(SUM(CASE WHEN d.natureza = 'receita' THEN d.realizado ELSE -d.realizado END), 2) AS resultado,
       round(SUM(CASE WHEN d.natureza = 'receita' THEN d.previsto ELSE 0 END), 2) AS receita_prevista,
       round(SUM(CASE WHEN d.natureza = 'despesa' THEN d.previsto ELSE 0 END), 2) AS despesa_prevista
  FROM erp.vw_dre_mensal d
  LEFT JOIN erp.erp_lojas l ON l.id = d.loja_id
 GROUP BY d.loja_id, l.nome, d.competencia;

GRANT SELECT ON erp.vw_dre_resumo TO authenticated, service_role;
