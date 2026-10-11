-- ============================================================
-- 106 — usuários: dono protegido, ninguém mexe no próprio acesso,
-- exclusão numa transação, chave do certificado escondida.
--
-- Revisão da criação de usuários/funcionários (10/10/2026), antes de a loja
-- cadastrar a equipe:
--   * O trigger protege_campos_de_acesso liberava tudo para qualquer admin:
--     um admin comum rebaixava, desativava ou tirava o "admin principal" do
--     dono (e marcava em si mesmo). E barrava a service key — a edge
--     erp-delete-user não conseguia desativar ninguém.
--   * Um admin apagava a linha do dono direto pela API (política ALL).
--   * Excluir pela edge apagava o login antes de saber se o usuário tinha
--     histórico; com venda/caixa a FK barrava e o admin via erro genérico.
--   * chave_cripto_certificado (decifra a senha do certificado A1) era
--     legível por qualquer usuário do ERP e aparecia nas Configurações.
--   * usuarios_crm_disponiveis listava todos os logins do auth.users.
--   * erp.handle_new_auth_user (migration 043, trigger já removido) criava
--     perfil do ERP com o papel vindo do cadastro — sai do banco.
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Chamada pelas edges (service key) ou direto no banco, sem JWT (migration,
-- manutenção, cascata do GoTrue)? Não usa current_user: dentro de função
-- SECURITY DEFINER ele é o dono da função e responderia sempre "sim".
CREATE OR REPLACE FUNCTION erp.chamada_do_servidor()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(auth.role(), '') = 'service_role'
      OR coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}') = '{}';
$$;

CREATE OR REPLACE FUNCTION erp.protege_campos_de_acesso()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'erp', 'public' AS $function$
DECLARE
  v_principal boolean;
  v_mudou_acesso boolean;
BEGIN
  -- as edges (service key) já conferem quem chamou e o que pode
  IF erp.chamada_do_servidor() THEN
    RETURN NEW;
  END IF;

  v_mudou_acesso :=
       NEW.role IS DISTINCT FROM OLD.role
    OR NEW.papeis IS DISTINCT FROM OLD.papeis
    OR NEW.permissoes IS DISTINCT FROM OLD.permissoes
    OR NEW.admin_principal IS DISTINCT FROM OLD.admin_principal
    OR NEW.ativo IS DISTINCT FROM OLD.ativo
    OR NEW.bloqueado IS DISTINCT FROM OLD.bloqueado;

  -- ninguém muda o próprio papel, permissões ou situação (nem o dono: não
  -- dá para se trancar fora do sistema por engano)
  IF NEW.id = auth.uid() AND v_mudou_acesso THEN
    RAISE EXCEPTION 'Ninguém altera o próprio papel, permissões ou situação. Peça a outro administrador.'
      USING ERRCODE = '42501';
  END IF;

  -- a conta do dono e o título de principal: só o próprio principal
  v_principal := EXISTS (SELECT 1 FROM erp.erp_usuarios
                          WHERE id = auth.uid() AND admin_principal AND ativo);
  IF (OLD.admin_principal OR NEW.admin_principal IS DISTINCT FROM OLD.admin_principal)
     AND v_mudou_acesso AND NOT v_principal THEN
    RAISE EXCEPTION 'Só o administrador principal altera a conta dele ou o título de principal.'
      USING ERRCODE = '42501';
  END IF;

  -- admin edita o resto; os demais, só os próprios dados de contato
  IF (SELECT erp.is_erp_admin_safe()) THEN
    RETURN NEW;
  END IF;

  IF v_mudou_acesso OR NEW.loja_default_id IS DISTINCT FROM OLD.loja_default_id THEN
    RAISE EXCEPTION 'Só um administrador altera papel, permissões, loja ou situação de um usuário.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

-- apagar a linha do dono (ou a própria) pela API
CREATE OR REPLACE FUNCTION erp.protege_exclusao_de_usuario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'erp', 'public' AS $function$
BEGIN
  IF erp.chamada_do_servidor() THEN
    RETURN OLD;
  END IF;
  IF OLD.admin_principal THEN
    RAISE EXCEPTION 'O administrador principal não pode ser excluído.' USING ERRCODE = '42501';
  END IF;
  IF OLD.id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir o próprio usuário.' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$function$;
DROP TRIGGER IF EXISTS trg_protege_exclusao_de_usuario ON erp.erp_usuarios;
CREATE TRIGGER trg_protege_exclusao_de_usuario BEFORE DELETE ON erp.erp_usuarios
  FOR EACH ROW EXECUTE FUNCTION erp.protege_exclusao_de_usuario();

-- Exclusão pela edge: tudo ou nada. Desvincula o funcionário (o cadastro de
-- RH fica), apaga o perfil do ERP; se houver histórico (vendas, caixas,
-- compras…) a FK barra e a mensagem diz o que fazer. Só depois disso a edge
-- apaga o login.
CREATE OR REPLACE FUNCTION erp.excluir_usuario_erp(p_usuario uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'erp', 'public' AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM erp.erp_usuarios WHERE id = p_usuario) THEN
    RAISE EXCEPTION 'Usuário não é do ERP.' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM erp.erp_usuarios WHERE id = p_usuario AND admin_principal) THEN
    RAISE EXCEPTION 'O administrador principal não pode ser excluído.' USING ERRCODE = '42501';
  END IF;
  UPDATE erp.erp_funcionarios SET usuario_id = NULL WHERE usuario_id = p_usuario;
  DELETE FROM erp.erp_usuarios WHERE id = p_usuario;
EXCEPTION WHEN foreign_key_violation THEN
  RAISE EXCEPTION 'Este usuário tem histórico no sistema (vendas, caixas, compras…) e não pode ser excluído. Desative-o: ele deixa de entrar e o histórico fica.'
    USING ERRCODE = '23503';
END;
$function$;
REVOKE ALL ON FUNCTION erp.excluir_usuario_erp(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION erp.excluir_usuario_erp(uuid) TO service_role;

-- chave do certificado: ninguém lê nem altera pela API (a função que
-- decifra é SECURITY DEFINER e lê direto)
DROP POLICY IF EXISTS erp_user_select ON erp.erp_configuracoes_sistema;
CREATE POLICY erp_user_select ON erp.erp_configuracoes_sistema FOR SELECT TO authenticated
  USING ((SELECT erp.current_erp_user_id()) IS NOT NULL AND chave <> 'chave_cripto_certificado');
DROP POLICY IF EXISTS erp_admin_update ON erp.erp_configuracoes_sistema;
CREATE POLICY erp_admin_update ON erp.erp_configuracoes_sistema FOR UPDATE TO authenticated
  USING ((SELECT erp.is_erp_admin()) AND chave <> 'chave_cripto_certificado');
DROP POLICY IF EXISTS erp_admin_delete ON erp.erp_configuracoes_sistema;
CREATE POLICY erp_admin_delete ON erp.erp_configuracoes_sistema FOR DELETE TO authenticated
  USING ((SELECT erp.is_erp_admin()) AND chave <> 'chave_cripto_certificado');
DROP POLICY IF EXISTS erp_admin_insert ON erp.erp_configuracoes_sistema;
CREATE POLICY erp_admin_insert ON erp.erp_configuracoes_sistema FOR INSERT TO authenticated
  WITH CHECK ((SELECT erp.is_erp_admin()) AND chave <> 'chave_cripto_certificado');

-- Importar do CRM: só o login do e-mail digitado, não a lista de todos
DROP FUNCTION IF EXISTS erp.usuarios_crm_disponiveis();
CREATE OR REPLACE FUNCTION erp.usuario_crm_por_email(p_email text)
RETURNS TABLE (id uuid, email text, nome text, criado_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = erp, public, auth AS $$
  SELECT u.id, u.email::text,
         coalesce(p.nome, u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1)),
         u.created_at
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
   WHERE erp.is_erp_admin_safe()
     AND u.deleted_at IS NULL
     AND lower(u.email) = lower(trim(p_email))
     AND NOT EXISTS (SELECT 1 FROM erp.erp_usuarios e WHERE e.id = u.id);
$$;
REVOKE ALL ON FUNCTION erp.usuario_crm_por_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION erp.usuario_crm_por_email(text) TO authenticated;

DROP FUNCTION IF EXISTS erp.handle_new_auth_user();

NOTIFY pgrst, 'reload schema';
COMMIT;
