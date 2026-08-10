-- =====================================================
-- Migration 040: RLS UPDATE/DELETE para erp_lotes
-- =====================================================

ALTER TABLE erp.erp_lotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "erp_user_update_lotes" ON erp.erp_lotes;
CREATE POLICY "erp_user_update_lotes" ON erp.erp_lotes
  FOR UPDATE TO authenticated
  USING (erp.current_erp_user_id() IS NOT NULL)
  WITH CHECK (erp.current_erp_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "erp_user_insert_lotes" ON erp.erp_lotes;
CREATE POLICY "erp_user_insert_lotes" ON erp.erp_lotes
  FOR INSERT TO authenticated
  WITH CHECK (erp.current_erp_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "erp_user_delete_lotes" ON erp.erp_lotes;
CREATE POLICY "erp_user_delete_lotes" ON erp.erp_lotes
  FOR DELETE TO authenticated
  USING (erp.current_erp_user_id() IS NOT NULL);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_lotes TO authenticated;

-- Recarregar schema
NOTIFY pgrst, 'reload schema';