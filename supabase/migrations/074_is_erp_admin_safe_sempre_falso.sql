-- ============================================================
-- 074 — is_erp_admin_safe() sempre devolvia FALSE
--
-- O corpo original declarava uma variável chamada `current_role`:
--
--   DECLARE current_role TEXT;
--   BEGIN
--     SELECT role INTO current_role FROM erp.erp_usuarios WHERE id = ...;
--     RETURN current_role = 'admin';
--
-- `current_role` é palavra reservada do SQL — é CURRENT_ROLE, o papel de
-- banco da sessão ('authenticated' pela API). O parser resolve a keyword
-- antes de o PL/pgSQL procurar a variável, então o RETURN comparava
-- 'authenticated' = 'admin'. Sempre falso. Achado ao testar a função
-- usuarios_crm_disponiveis (073) com o JWT do admin simulado: auth.uid()
-- certo, current_erp_user_id() certo, is_erp_admin_safe() falso.
--
-- Efeito em produção até aqui: toda policy que usa is_erp_admin_safe
-- (erp_admin_all_usuarios, entre outras) nunca liberou nada — o admin só
-- editava a própria linha em erp_usuarios. Com um usuário só, ninguém viu.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION erp.is_erp_admin_safe()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'erp', 'public'
AS $$
DECLARE
  papel_do_usuario text;
BEGIN
  SELECT role INTO papel_do_usuario
    FROM erp.erp_usuarios
   WHERE id = erp.current_erp_user_id()
   LIMIT 1;
  RETURN papel_do_usuario = 'admin';
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

COMMIT;
