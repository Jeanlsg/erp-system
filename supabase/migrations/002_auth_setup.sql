-- =====================================================
-- ERP System · Supabase Auth Setup (prefixo erp_)
-- Migration: 002_auth_setup.sql
-- =====================================================

-- Trigger para criar registro em erp_usuarios quando alguém se cadastra
CREATE OR REPLACE FUNCTION erp_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.erp_usuarios (id, email, nome, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    'caixa' -- role padrão
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger no auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION erp_handle_new_user();

-- =====================================================
-- USUÁRIOS DEMO
-- =====================================================
-- IMPORTANTE: Após criar usuários no Supabase Auth,
-- executar isto para promover o primeiro usuário para admin:

-- UPDATE public.erp_usuarios SET role = 'admin', nome = 'Administrador Master'
-- WHERE email = 'seu-email@dominio.com';