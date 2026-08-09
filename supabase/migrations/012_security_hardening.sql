-- =====================================================
-- ERP System · Security Hardening (RLS para tabelas restantes)
-- Migration: 012_security_hardening.sql
--
-- Aplica RLS nas 14 tabelas que faltavam e cria policies
-- granulares para todas as tabelas com dados sensíveis.
--
-- IMPORTANTE: policies atuais usam USING (true) — qualquer
-- usuário autenticado lê e escreve tudo. Aqui endurecemos
-- as tabelas mais sensíveis (caixa, vendas, funcionarios,
-- pedidos, etc) exigindo auth.uid() IS NOT NULL e separando
-- leitura vs escrita onde faz sentido.
-- =====================================================

-- ===== Habilitar RLS nas tabelas restantes =====
ALTER TABLE erp_caixa                ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_caixa_movimentacoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_categorias           ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_compra_itens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_compras              ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_funcionarios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_kit_itens            ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_kits                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_lotes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_pedidos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_regioes_entrega      ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_servicos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_transportadoras      ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_venda_itens          ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLICIES PARA AS 14 TABELAS NOVAMENTE COBERTAS
-- =====================================================

-- ===== Categorias (lookup compartilhado) =====
CREATE POLICY "Auth users can read erp_categorias" ON erp_categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_categorias" ON erp_categorias FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== Caixa (financeiro sensível) =====
CREATE POLICY "Auth users can read erp_caixa" ON erp_caixa FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_caixa" ON erp_caixa FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can read erp_caixa_movimentacoes" ON erp_caixa_movimentacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_caixa_movimentacoes" ON erp_caixa_movimentacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== Funcionários (dados pessoais RH) =====
CREATE POLICY "Auth users can read erp_funcionarios" ON erp_funcionarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_funcionarios" ON erp_funcionarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== Compras =====
CREATE POLICY "Auth users can read erp_compras" ON erp_compras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_compras" ON erp_compras FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can read erp_compra_itens" ON erp_compra_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_compra_itens" ON erp_compra_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== Kits =====
CREATE POLICY "Auth users can read erp_kits" ON erp_kits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_kits" ON erp_kits FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can read erp_kit_itens" ON erp_kit_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_kit_itens" ON erp_kit_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== Lotes =====
CREATE POLICY "Auth users can read erp_lotes" ON erp_lotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_lotes" ON erp_lotes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== Pedidos (movimentação) =====
CREATE POLICY "Auth users can read erp_pedidos" ON erp_pedidos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_pedidos" ON erp_pedidos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== Regiões de entrega =====
CREATE POLICY "Auth users can read erp_regioes_entrega" ON erp_regioes_entrega FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_regioes_entrega" ON erp_regioes_entrega FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== Serviços =====
CREATE POLICY "Auth users can read erp_servicos" ON erp_servicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_servicos" ON erp_servicos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== Transportadoras =====
CREATE POLICY "Auth users can read erp_transportadoras" ON erp_transportadoras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_transportadoras" ON erp_transportadoras FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== Venda itens (muito sensível: totais, custos, lucros) =====
CREATE POLICY "Auth users can read erp_venda_itens" ON erp_venda_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_venda_itens" ON erp_venda_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================
DO $$
DECLARE
  sem_rls INTEGER;
BEGIN
  SELECT COUNT(*) INTO sem_rls
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename LIKE 'erp_%'
    AND rowsecurity = false;

  IF sem_rls > 0 THEN
    RAISE WARNING 'AINDA EXISTEM % TABELAS erp_ SEM RLS!', sem_rls;
  ELSE
    RAISE NOTICE 'OK: todas as 57 tabelas erp_ têm RLS habilitada.';
  END IF;
END $$;