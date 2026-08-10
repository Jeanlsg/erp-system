-- =====================================================
-- Migration 036: RLS para NFe Entrada e Remessas
-- =====================================================

-- ===== erp_nfe_entrada =====
ALTER TABLE erp.erp_nfe_entrada ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "erp_user_select_nfe_entrada" ON erp.erp_nfe_entrada;
CREATE POLICY "erp_user_select_nfe_entrada" ON erp.erp_nfe_entrada
  FOR SELECT TO authenticated
  USING (erp.current_erp_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "erp_user_insert_nfe_entrada" ON erp.erp_nfe_entrada;
CREATE POLICY "erp_user_insert_nfe_entrada" ON erp.erp_nfe_entrada
  FOR INSERT TO authenticated
  WITH CHECK (erp.current_erp_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "erp_user_update_nfe_entrada" ON erp.erp_nfe_entrada;
CREATE POLICY "erp_user_update_nfe_entrada" ON erp.erp_nfe_entrada
  FOR UPDATE TO authenticated
  USING (erp.current_erp_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "erp_admin_all_nfe_entrada" ON erp.erp_nfe_entrada;
CREATE POLICY "erp_admin_all_nfe_entrada" ON erp.erp_nfe_entrada
  FOR ALL TO authenticated
  USING (erp.is_erp_admin())
  WITH CHECK (erp.is_erp_admin());

-- ===== erp_nfe_entrada_itens =====
ALTER TABLE erp.erp_nfe_entrada_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "erp_user_select_nfe_entrada_itens" ON erp.erp_nfe_entrada_itens;
CREATE POLICY "erp_user_select_nfe_entrada_itens" ON erp.erp_nfe_entrada_itens
  FOR SELECT TO authenticated
  USING (erp.current_erp_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "erp_user_insert_nfe_entrada_itens" ON erp.erp_nfe_entrada_itens;
CREATE POLICY "erp_user_insert_nfe_entrada_itens" ON erp.erp_nfe_entrada_itens
  FOR INSERT TO authenticated
  WITH CHECK (erp.current_erp_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "erp_user_update_nfe_entrada_itens" ON erp.erp_nfe_entrada_itens;
CREATE POLICY "erp_user_update_nfe_entrada_itens" ON erp.erp_nfe_entrada_itens
  FOR UPDATE TO authenticated
  USING (erp.current_erp_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "erp_admin_all_nfe_entrada_itens" ON erp.erp_nfe_entrada_itens;
CREATE POLICY "erp_admin_all_nfe_entrada_itens" ON erp.erp_nfe_entrada_itens
  FOR ALL TO authenticated
  USING (erp.is_erp_admin())
  WITH CHECK (erp.is_erp_admin());