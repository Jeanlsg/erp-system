-- =====================================================
-- Migration 042: CRUD de Usuários com Permissões Granulares
-- =====================================================

-- Garantir que apenas admins possam UPDATE/DELETE em erp_usuarios
-- A política atual erp_admin_write_usuarios já permite tudo para admins

-- Garantir GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_usuarios TO authenticated;

-- Função SQL para verificar se usuário atual é admin
CREATE OR REPLACE FUNCTION erp.is_erp_admin_safe()
RETURNS BOOLEAN AS $$
DECLARE
  current_role TEXT;
BEGIN
  SELECT role INTO current_role
  FROM erp.erp_usuarios
  WHERE id = erp.current_erp_user_id()
  LIMIT 1;
  RETURN current_role = 'admin';
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION erp.is_erp_admin_safe() TO authenticated;

-- Recriar política ALL do admin de forma mais explícita
DROP POLICY IF EXISTS "erp_admin_write_usuarios" ON erp.erp_usuarios;

CREATE POLICY "erp_admin_all_usuarios" ON erp.erp_usuarios
  FOR ALL TO authenticated
  USING (erp.is_erp_admin_safe())
  WITH CHECK (erp.is_erp_admin_safe());

-- Política adicional: qualquer usuário pode atualizar apenas seu próprio registro (avatar, telefone)
DROP POLICY IF EXISTS "erp_self_update_usuarios" ON erp.erp_usuarios;
CREATE POLICY "erp_self_update_usuarios" ON erp.erp_usuarios
  FOR UPDATE TO authenticated
  USING (id = erp.current_erp_user_id())
  WITH CHECK (id = erp.current_erp_user_id());

NOTIFY pgrst, 'reload schema';