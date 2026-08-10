-- =====================================================
-- Migration 043: Trigger de criação automática de erp_usuarios
-- Quando um novo usuário é criado em auth.users, cria
-- automaticamente a entrada em erp.erp_usuarios com role padrão 'caixa'.
-- =====================================================

-- Função que será chamada pelo trigger
CREATE OR REPLACE FUNCTION erp.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insere automaticamente em erp_usuarios
  INSERT INTO erp.erp_usuarios (
    id,
    email,
    nome,
    role,
    ativo,
    tentativas_login,
    bloqueado,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::erp_user_role, 'caixa'::erp_user_role),
    true,
    0,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- não sobrescreve se já existe

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION erp.handle_new_auth_user();

-- Concede permissão para o trigger funcionar (auth.uid() precisa de acesso)
GRANT USAGE ON SCHEMA erp TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE ON erp.erp_usuarios TO supabase_auth_admin;

COMMENT ON FUNCTION erp.handle_new_auth_user() IS
  'Cria automaticamente um registro em erp_usuarios quando um usuário é criado em auth.users';

NOTIFY pgrst, 'reload schema';