-- ============================================================
-- 122 — Limite de tentativas no login por CPF
--
-- Varredura de segurança de 03/11/2026, achado 1: nada contava senha errada.
-- A coluna erp_usuarios.tentativas_login existe e ninguém a incrementa; a
-- edge erp-login (CPF, 121) chamava o Auth sem limite, e todas as tentativas
-- chegam lá com o IP da própria função — ou não há limite nenhum, ou quem
-- martela tranca o login por CPF de todo mundo.
--
-- Agora a erp-login conta as falhas aqui, por CPF e por IP de quem chama,
-- numa janela de 15 minutos:
--   - 5 erros no mesmo CPF  → aquele CPF espera 15 minutos;
--   - 20 erros do mesmo IP  → aquele IP espera 15 minutos.
-- A chave é o CPF digitado, exista login ou não: a resposta não conta se o
-- CPF tem acesso. Entrar certo zera o CPF (não o IP: quem tem uma conta não
-- usa a dela para zerar o contador do IP). Trocar a senha pelo admin
-- (erp-reset-password) zera também.
--
-- Só a service role (as edges) lê e chama: sem policy e sem EXECUTE para
-- anon/authenticated (o event trigger da 117 dá EXECUTE ao authenticated em
-- função nova — o REVOKE abaixo tira).
--
-- O login por e-mail vai direto ao Auth (é o mesmo servidor do CRM): o
-- limite dele é o do próprio Auth — ver docs/seguranca/varredura-2026-11-03.md.
--
-- Volta: docs/ajustes/2026-11-03-volta-migration-122.sql
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS erp.erp_tentativas_login (
  -- 'cpf:<11 dígitos>' ou 'ip:<endereço>'
  chave           text PRIMARY KEY,
  falhas          integer     NOT NULL DEFAULT 0,
  primeira_falha  timestamptz NOT NULL DEFAULT now(),
  bloqueado_ate   timestamptz,
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE erp.erp_tentativas_login ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON erp.erp_tentativas_login FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_tentativas_login TO service_role;

-- segundos até liberar (0 = pode tentar)
CREATE OR REPLACE FUNCTION erp.login_bloqueado(p_chaves text[])
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
  SELECT COALESCE(max(ceil(extract(epoch FROM t.bloqueado_ate - now())))::integer, 0)
    FROM erp.erp_tentativas_login t
   WHERE t.chave = ANY (p_chaves) AND t.bloqueado_ate > now();
$function$;

-- conta uma falha em cada chave; devolve os segundos de espera que valem agora
CREATE OR REPLACE FUNCTION erp.registrar_falha_login(p_chaves text[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_chave  text;
  v_limite integer;
BEGIN
  FOREACH v_chave IN ARRAY coalesce(p_chaves, '{}') LOOP
    v_limite := CASE WHEN v_chave LIKE 'ip:%' THEN 20 ELSE 5 END;
    INSERT INTO erp.erp_tentativas_login AS t (chave, falhas, primeira_falha, atualizado_em)
    VALUES (v_chave, 1, now(), now())
    ON CONFLICT (chave) DO UPDATE SET
      -- janela de 15 minutos a partir da primeira falha
      falhas         = CASE WHEN t.primeira_falha < now() - interval '15 minutes' THEN 1 ELSE t.falhas + 1 END,
      primeira_falha = CASE WHEN t.primeira_falha < now() - interval '15 minutes' THEN now() ELSE t.primeira_falha END,
      atualizado_em  = now();
    UPDATE erp.erp_tentativas_login
       SET bloqueado_ate = now() + interval '15 minutes'
     WHERE chave = v_chave
       AND falhas >= v_limite
       AND (bloqueado_ate IS NULL OR bloqueado_ate <= now());
  END LOOP;
  -- faxina: chave parada há um dia não conta nem bloqueia
  DELETE FROM erp.erp_tentativas_login WHERE atualizado_em < now() - interval '1 day';
  RETURN erp.login_bloqueado(p_chaves);
END;
$function$;

-- entrou certo, ou o admin trocou a senha: a chave volta a zero
CREATE OR REPLACE FUNCTION erp.liberar_login(p_chaves text[])
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
  DELETE FROM erp.erp_tentativas_login WHERE chave = ANY (p_chaves);
$function$;

REVOKE EXECUTE ON FUNCTION erp.login_bloqueado(text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION erp.registrar_falha_login(text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION erp.liberar_login(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION erp.login_bloqueado(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION erp.registrar_falha_login(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION erp.liberar_login(text[]) TO service_role;

COMMIT;
