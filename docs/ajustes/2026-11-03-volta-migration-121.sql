-- ============================================================
-- Volta da migration 121 (entrar com CPF ou e-mail).
--
-- Tira a trava de formato, o índice único e a proteção do CPF no trigger
-- (volta a 106). Os CPFs gravados em erp_usuarios.cpf ficam — sem a edge
-- erp-login e sem o front novo, ninguém entra por eles.
--
-- ssh "$ERP_SSH_HOST" "docker exec -i $ERP_DB_CONTAINER psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1" < docs/ajustes/2026-11-03-volta-migration-121.sql
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

DROP INDEX IF EXISTS erp.uq_erp_usuarios_cpf;
ALTER TABLE erp.erp_usuarios DROP CONSTRAINT IF EXISTS erp_usuarios_cpf_so_digitos;

-- protege_campos_de_acesso como em produção antes da 121 (106)
CREATE OR REPLACE FUNCTION erp.protege_campos_de_acesso()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
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

COMMIT;
