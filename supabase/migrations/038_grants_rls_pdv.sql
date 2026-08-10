-- =====================================================
-- Migration 038: Grants e RLS para PDV
-- =====================================================

-- ===== Grants para authenticated em tabelas PDV =====
GRANT USAGE ON SCHEMA erp TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_caixa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_fechamentos_caixa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_sangrias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_entradas_extras TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_caixa_movimentacoes TO authenticated;

-- ===== Garantir que as policies de UPDATE funcionam em erp_caixa =====
DROP POLICY IF EXISTS "erp_user_update_caixa" ON erp.erp_caixa;
DROP POLICY IF EXISTS "erp_user_update_caixa_v2" ON erp.erp_caixa;

CREATE POLICY "erp_user_update_caixa_v2" ON erp.erp_caixa
  FOR UPDATE TO authenticated
  USING (erp.current_erp_user_id() IS NOT NULL)
  WITH CHECK (erp.current_erp_user_id() IS NOT NULL);

-- ===== Garantir INSERT em erp_fechamentos_caixa para usuários =====
DROP POLICY IF EXISTS "erp_user_insert_fechamentos" ON erp.erp_fechamentos_caixa;
CREATE POLICY "erp_user_insert_fechamentos" ON erp.erp_fechamentos_caixa
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM erp.erp_caixa c
      WHERE c.id = erp_fechamentos_caixa.caixa_id
        AND c.usuario_id = erp.current_erp_user_id()
    )
    OR erp.is_erp_admin()
  );

-- Garantir SELECT/UPDATE/DELETE apenas para admin ou dono
DROP POLICY IF EXISTS "erp_user_select_fechamentos" ON erp.erp_fechamentos_caixa;
CREATE POLICY "erp_user_select_fechamentos" ON erp.erp_fechamentos_caixa
  FOR SELECT TO authenticated
  USING (erp.current_erp_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "erp_admin_write_fechamentos" ON erp.erp_fechamentos_caixa;
CREATE POLICY "erp_admin_write_fechamentos" ON erp.erp_fechamentos_caixa
  FOR ALL TO authenticated
  USING (erp.is_erp_admin())
  WITH CHECK (erp.is_erp_admin());

-- ===== Trigger que faz INSERT precisa ser SECURITY DEFINER =====
ALTER FUNCTION erp.fn_criar_fechamento_automatico() SECURITY DEFINER;
ALTER FUNCTION erp.fn_fechar_caixa_anterior() SECURITY DEFINER;

-- Permitir que authenticated execute as funções
GRANT EXECUTE ON FUNCTION erp.fn_criar_fechamento_automatico() TO authenticated;
GRANT EXECUTE ON FUNCTION erp.fn_fechar_caixa_anterior() TO authenticated;