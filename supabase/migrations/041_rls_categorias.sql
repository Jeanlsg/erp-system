-- =====================================================
-- Migration 041: RLS para Categorias
-- =====================================================

ALTER TABLE erp.erp_categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "erp_user_insert_categorias" ON erp.erp_categorias;
CREATE POLICY "erp_user_insert_categorias" ON erp.erp_categorias
  FOR INSERT TO authenticated
  WITH CHECK (erp.current_erp_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "erp_user_update_categorias" ON erp.erp_categorias;
CREATE POLICY "erp_user_update_categorias" ON erp.erp_categorias
  FOR UPDATE TO authenticated
  USING (erp.current_erp_user_id() IS NOT NULL)
  WITH CHECK (erp.current_erp_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "erp_user_delete_categorias" ON erp.erp_categorias;
CREATE POLICY "erp_user_delete_categorias" ON erp.erp_categorias
  FOR DELETE TO authenticated
  USING (erp.current_erp_user_id() IS NOT NULL);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_categorias TO authenticated;

NOTIFY pgrst, 'reload schema';