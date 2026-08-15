-- ============================================================
-- 044: Correções da auditoria de 15/08/2026 (banco)
-- 1) RLS para remessas (estavam deny-all — feature inoperante)
-- 2) search_path fixo nas funções SECURITY DEFINER
-- 3) handle_new_auth_user: tipo qualificado (bug que derrubou o
--    signup em 10/08 — auth.users é COMPARTILHADO com o CRM;
--    o trigger NÃO é reanexado: create-user já provisiona)
-- 4) incrementar_numeracao_nfe atômica (não repete número)
-- 5) UNIQUE em erp_fechamentos_caixa(caixa_id) + dedupe
-- 6) RPCs atômicas de estoque (baixa/crédito sem read-modify-write)
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- ATENÇÃO: aplicar SEM --single-transaction (ALTER TYPE ADD VALUE não roda
-- dentro de transação). Todos os comandos são idempotentes/reaplicáveis.

-- ── 0) Valores de status usados pelo código mas ausentes do enum ──
-- (emitir-nfe já gravava 'pendente_transmissao' — e falhava em silêncio)
ALTER TYPE erp.erp_nota_status ADD VALUE IF NOT EXISTS 'pendente_transmissao';
ALTER TYPE erp.erp_nota_status ADD VALUE IF NOT EXISTS 'pendente_arquivo';

-- ── 0b) Coluna cfop_utilizado (o front e a view usam esse nome; o CREATE
--        TABLE original criou apenas 'cfop') ──
ALTER TABLE erp.erp_remessas ADD COLUMN IF NOT EXISTS cfop_utilizado character varying(10);
UPDATE erp.erp_remessas SET cfop_utilizado = cfop WHERE cfop_utilizado IS NULL AND cfop IS NOT NULL;

-- ── 1) RLS remessas (padrão das demais tabelas transacionais do erp) ──
DROP POLICY IF EXISTS erp_user_select ON erp.erp_remessas;
DROP POLICY IF EXISTS erp_user_insert ON erp.erp_remessas;
DROP POLICY IF EXISTS erp_user_update ON erp.erp_remessas;
DROP POLICY IF EXISTS erp_admin_delete ON erp.erp_remessas;
CREATE POLICY erp_user_select ON erp.erp_remessas
  FOR SELECT TO authenticated
  USING ((SELECT erp.current_erp_user_id()) IS NOT NULL);
CREATE POLICY erp_user_insert ON erp.erp_remessas
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT erp.current_erp_user_id()) IS NOT NULL);
CREATE POLICY erp_user_update ON erp.erp_remessas
  FOR UPDATE TO authenticated
  USING ((SELECT erp.current_erp_user_id()) IS NOT NULL)
  WITH CHECK ((SELECT erp.current_erp_user_id()) IS NOT NULL);
CREATE POLICY erp_admin_delete ON erp.erp_remessas
  FOR DELETE TO authenticated
  USING ((SELECT erp.is_erp_admin()));

DROP POLICY IF EXISTS erp_user_select ON erp.erp_remessa_itens;
DROP POLICY IF EXISTS erp_user_insert ON erp.erp_remessa_itens;
DROP POLICY IF EXISTS erp_user_update ON erp.erp_remessa_itens;
DROP POLICY IF EXISTS erp_admin_delete ON erp.erp_remessa_itens;
CREATE POLICY erp_user_select ON erp.erp_remessa_itens
  FOR SELECT TO authenticated
  USING ((SELECT erp.current_erp_user_id()) IS NOT NULL);
CREATE POLICY erp_user_insert ON erp.erp_remessa_itens
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT erp.current_erp_user_id()) IS NOT NULL);
CREATE POLICY erp_user_update ON erp.erp_remessa_itens
  FOR UPDATE TO authenticated
  USING ((SELECT erp.current_erp_user_id()) IS NOT NULL)
  WITH CHECK ((SELECT erp.current_erp_user_id()) IS NOT NULL);
CREATE POLICY erp_admin_delete ON erp.erp_remessa_itens
  FOR DELETE TO authenticated
  USING ((SELECT erp.is_erp_admin()));

-- ── 2) search_path fixo (evita sequestro de search_path e o erro
--       "type erp_user_role does not exist" vindo do GoTrue) ──
ALTER FUNCTION erp.current_erp_user_id()                       SET search_path = erp, public;
ALTER FUNCTION erp.is_erp_admin()                              SET search_path = erp, public;
ALTER FUNCTION erp.is_erp_admin_safe()                         SET search_path = erp, public;
ALTER FUNCTION erp.criptografar_senha_cert(text)               SET search_path = erp, public, extensions;
ALTER FUNCTION erp.descriptografar_senha_cert(bytea)           SET search_path = erp, public, extensions;
ALTER FUNCTION erp.erp_handle_new_user()                       SET search_path = erp, public;
ALTER FUNCTION erp.loja_pode_emitir_nfe(uuid)                  SET search_path = erp, public;
ALTER FUNCTION erp.incrementar_numeracao_nfe(uuid, character varying) SET search_path = erp, public;
ALTER FUNCTION erp.fn_criar_fechamento_automatico()            SET search_path = erp, public;
ALTER FUNCTION erp.fn_fechar_caixa_anterior()                  SET search_path = erp, public;
ALTER FUNCTION erp.handle_new_auth_user()                      SET search_path = erp, public;

-- ── 3) handle_new_auth_user com tipo qualificado ──
-- IMPORTANTE: NÃO criar trigger em auth.users com o nome on_auth_user_created
-- (a migration 043 fazia isso e SOBRESCREVIA o trigger do CRM, que compartilha
-- o mesmo auth.users — foi a causa do 500 na criação de usuários em 10/08).
-- O provisionamento do ERP é feito pela edge function create-user.
CREATE OR REPLACE FUNCTION erp.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
BEGIN
  INSERT INTO erp.erp_usuarios (
    id, email, nome, role, ativo, tentativas_login, bloqueado, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::erp.erp_user_role, 'caixa'::erp.erp_user_role),
    true, 0, false, NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── 4) Numeração de NF-e atômica ──
CREATE OR REPLACE FUNCTION erp.incrementar_numeracao_nfe(p_loja_id uuid, p_tipo character varying DEFAULT 'nfe'::character varying)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
DECLARE
  v_proximo INTEGER;
BEGIN
  UPDATE erp.erp_configuracoes_sefaz
  SET
    numeracao_atual_nfe  = CASE WHEN p_tipo = 'nfe'  THEN numeracao_atual_nfe  + 1 ELSE numeracao_atual_nfe  END,
    numeracao_atual_nfce = CASE WHEN p_tipo = 'nfce' THEN numeracao_atual_nfce + 1 ELSE numeracao_atual_nfce END,
    updated_at = NOW()
  WHERE loja_id = p_loja_id AND ativo = true
  RETURNING CASE WHEN p_tipo = 'nfe' THEN numeracao_atual_nfe ELSE numeracao_atual_nfce END
  INTO v_proximo;

  IF v_proximo IS NULL THEN
    RAISE EXCEPTION 'Configuração SEFAZ ativa não encontrada para a loja % — numeração não incrementada', p_loja_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_proximo;
END;
$$;

-- ── 5) Dedupe + UNIQUE em erp_fechamentos_caixa(caixa_id) ──
-- Mantém, por caixa, o registro mais completo (valor_final preenchido) e mais antigo.
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY caixa_id
    ORDER BY (valor_final IS NOT NULL) DESC, created_at ASC, id ASC
  ) AS rn
  FROM erp.erp_fechamentos_caixa
)
DELETE FROM erp.erp_fechamentos_caixa f
USING ranked r
WHERE f.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS erp_fechamentos_caixa_caixa_id_key
  ON erp.erp_fechamentos_caixa (caixa_id);

-- ── 6) RPCs atômicas de estoque ──
CREATE OR REPLACE FUNCTION erp.baixar_estoque_atomico(p_loja_id uuid, p_itens jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
DECLARE
  item RECORD;
  v_updated INTEGER;
BEGIN
  IF (SELECT erp.current_erp_user_id()) IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;

  FOR item IN
    SELECT (e->>'produto_id')::uuid AS pid, (e->>'quantidade')::int AS qtd
    FROM jsonb_array_elements(p_itens) e
  LOOP
    IF item.qtd IS NULL OR item.qtd <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida (%) para o produto %', item.qtd, item.pid USING ERRCODE = 'P0001';
    END IF;

    UPDATE erp.erp_estoque
    SET quantidade = quantidade - item.qtd, updated_at = NOW()
    WHERE produto_id = item.pid AND loja_id = p_loja_id AND quantidade >= item.qtd;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      RAISE EXCEPTION 'Estoque insuficiente ou inexistente para o produto % na loja %', item.pid, p_loja_id
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION erp.creditar_estoque_atomico(p_loja_id uuid, p_itens jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
DECLARE
  item RECORD;
BEGIN
  IF (SELECT erp.current_erp_user_id()) IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;

  FOR item IN
    SELECT (e->>'produto_id')::uuid AS pid, (e->>'quantidade')::int AS qtd
    FROM jsonb_array_elements(p_itens) e
  LOOP
    IF item.qtd IS NULL OR item.qtd <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida (%) para o produto %', item.qtd, item.pid USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO erp.erp_estoque (produto_id, loja_id, quantidade, updated_at)
    VALUES (item.pid, p_loja_id, item.qtd, NOW())
    ON CONFLICT (produto_id, loja_id)
    DO UPDATE SET quantidade = erp_estoque.quantidade + EXCLUDED.quantidade, updated_at = NOW();
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION erp.baixar_estoque_atomico(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION erp.creditar_estoque_atomico(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erp.baixar_estoque_atomico(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION erp.creditar_estoque_atomico(uuid, jsonb) TO authenticated, service_role;
