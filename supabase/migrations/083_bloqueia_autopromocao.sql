-- ============================================================
-- 083 — qualquer usuário conseguia se promover a administrador
--
-- A policy erp_self_update_usuarios permite ao usuário atualizar a PRÓPRIA
-- linha:
--
--   USING      (id = current_erp_user_id())
--   WITH CHECK (id = current_erp_user_id())
--
-- Isso garante que ele não edita a linha de outro — e nada mais. RLS no
-- Postgres não distingue COLUNA, então a mesma policy que deixa trocar o
-- telefone deixa trocar o papel.
--
-- Medido em produção, com o JWT de um usuário de papel `caixa`:
--
--   UPDATE erp.erp_usuarios SET role='admin' WHERE id = auth.uid();
--   → papel DEPOIS do update: admin
--
--   UPDATE erp.erp_usuarios SET permissoes='{"all": true}' ...
--   → permissoes depois: {"all": true}
--
-- O token do operador está no navegador dele. Uma chamada à API e o balcão
-- vira administrador — com acesso a folha de pagamento, financeiro e
-- certificado digital. Virar `admin_principal` já falhava, mas por acaso:
-- esbarrava num índice único, não numa regra.
--
-- A correção é um trigger, porque a trava precisa ser POR COLUNA: quem não
-- é admin não altera papel, permissões, situação nem bloqueio — nem os
-- seus. Nome, telefone, e-mail e avatar continuam livres.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION erp.protege_campos_de_acesso()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'erp', 'public'
AS $$
BEGIN
  -- admin edita tudo; o resto só os próprios dados de contato
  IF (SELECT erp.is_erp_admin_safe()) THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.papeis IS DISTINCT FROM OLD.papeis
     OR NEW.permissoes IS DISTINCT FROM OLD.permissoes
     OR NEW.admin_principal IS DISTINCT FROM OLD.admin_principal
     OR NEW.ativo IS DISTINCT FROM OLD.ativo
     OR NEW.bloqueado IS DISTINCT FROM OLD.bloqueado
     OR NEW.loja_default_id IS DISTINCT FROM OLD.loja_default_id
  THEN
    RAISE EXCEPTION 'Só um administrador altera papel, permissões, loja ou situação de um usuário.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protege_campos_de_acesso ON erp.erp_usuarios;
CREATE TRIGGER trg_protege_campos_de_acesso
  BEFORE UPDATE ON erp.erp_usuarios
  FOR EACH ROW EXECUTE FUNCTION erp.protege_campos_de_acesso();

COMMENT ON FUNCTION erp.protege_campos_de_acesso() IS
  'RLS não restringe coluna: sem isto, a policy de auto-edição deixava qualquer usuário virar admin alterando a própria linha.';

COMMIT;
