-- ============================================================
-- 121 — Entrar com CPF ou e-mail
--
-- Pedido do Jean (03/11/2026): "login tanto pelo CPF quanto pelo e-mail".
-- A edge erp-login acha o login pelo erp_usuarios.cpf; para isso a coluna
-- precisa ser confiável, e não era:
--
-- 1. Ninguém gravava nela. O CPF digitado em Usuários e Permissões ia só
--    para a pessoa e o funcionário; erp_usuarios.cpf estava vazia nos dois
--    logins. Agora a tela grava (front) e esta migration preenche com o CPF
--    do funcionário vinculado, quando ele é de um login só.
-- 2. Aceitava qualquer texto (varchar 14, com ou sem máscara) e repetido.
--    Dois logins com o mesmo CPF deixariam a edge sem saber quem entra.
--    Agora: só os 11 dígitos, e um login por CPF.
-- 3. Qualquer usuário altera a própria linha (policy erp_self_update) — e
--    poria no próprio login o CPF de outra pessoa, tomando o CPF dela antes
--    do cadastro. O CPF de acesso entra no que só o admin muda, e o do dono
--    só o próprio dono, como o resto da conta dele (106).
--
-- Volta: docs/ajustes/2026-11-03-volta-migration-121.sql
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ── 1. só os dígitos; o que não for CPF de 11 dígitos vira nulo ──
UPDATE erp.erp_usuarios
   SET cpf = CASE WHEN regexp_replace(cpf, '\D', '', 'g') ~ '^\d{11}$'
                  THEN regexp_replace(cpf, '\D', '', 'g') END
 WHERE cpf IS NOT NULL AND cpf !~ '^\d{11}$';

-- ── 2. preenche com o CPF do funcionário vinculado ──
-- Só quando aquele CPF é de um login só e ninguém o usa ainda.
WITH f AS (
  SELECT f.usuario_id, regexp_replace(f.cpf, '\D', '', 'g') AS cpf
  FROM erp.erp_funcionarios f
  WHERE f.usuario_id IS NOT NULL AND f.cpf IS NOT NULL
), unicos AS (
  SELECT cpf, min(usuario_id::text)::uuid AS usuario_id
  FROM f
  WHERE cpf ~ '^\d{11}$'
  GROUP BY cpf
  HAVING count(DISTINCT usuario_id) = 1
)
UPDATE erp.erp_usuarios u
   SET cpf = x.cpf
  FROM unicos x
 WHERE u.id = x.usuario_id
   AND u.cpf IS NULL
   AND NOT EXISTS (SELECT 1 FROM erp.erp_usuarios o WHERE o.cpf = x.cpf);

-- ── 3. formato e um login por CPF ──
ALTER TABLE erp.erp_usuarios DROP CONSTRAINT IF EXISTS erp_usuarios_cpf_so_digitos;
ALTER TABLE erp.erp_usuarios ADD CONSTRAINT erp_usuarios_cpf_so_digitos
  CHECK (cpf IS NULL OR cpf ~ '^\d{11}$');
CREATE UNIQUE INDEX IF NOT EXISTS uq_erp_usuarios_cpf ON erp.erp_usuarios (cpf) WHERE cpf IS NOT NULL;

-- ── 4. CPF de acesso: só o admin muda; o do dono, só o dono ──
-- Igual à 106, mais as linhas marcadas com "121".
CREATE OR REPLACE FUNCTION erp.protege_campos_de_acesso()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
DECLARE
  v_principal boolean;
  v_mudou_acesso boolean;
  v_mudou_cpf boolean;   -- 121: o CPF é por onde se entra
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
  v_mudou_cpf := NEW.cpf IS DISTINCT FROM OLD.cpf;

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
     AND (v_mudou_acesso OR v_mudou_cpf) AND NOT v_principal THEN   -- 121: + CPF
    RAISE EXCEPTION 'Só o administrador principal altera a conta dele ou o título de principal.'
      USING ERRCODE = '42501';
  END IF;

  -- admin edita o resto; os demais, só os próprios dados de contato
  IF (SELECT erp.is_erp_admin_safe()) THEN
    RETURN NEW;
  END IF;

  IF v_mudou_acesso OR v_mudou_cpf   -- 121: + CPF
     OR NEW.loja_default_id IS DISTINCT FROM OLD.loja_default_id THEN
    RAISE EXCEPTION 'Só um administrador altera papel, permissões, loja, CPF de acesso ou situação de um usuário.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;
