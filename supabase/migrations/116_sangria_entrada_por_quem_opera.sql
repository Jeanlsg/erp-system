-- ============================================================
-- 116 — sangria e entrada de valores por quem opera o caixa
--
-- Defeito (conferido no banco em 25/10/2026): erp_sangrias e
-- erp_entradas_extras só tinham policy de INSERT para admin/gerente
-- (is_erp_admin, migrations 021/036). O PDV oferece Sangria (Ctrl+S) e
-- Entrada de Valores (Ctrl+E) a todo operador, e o operador de caixa
-- recebia "new row violates row-level security policy" — a única sangria
-- gravada até hoje era do admin. Com o vendedor (111–113) e a permissão
-- "caixa.sangria" (112), o balcão inteiro precisa conseguir lançar.
--
-- Regra: lança quem pode operar o caixa AGORA — quem abriu o turno, ou o
-- vendedor no turno de alguém acima dele (erp.pode_operar_caixa, 113) — e
-- sempre em nome próprio (usuario_id = quem está logado). Caixa fechado ou
-- de outra pessoa continua recusado; admin/gerente seguem pela policy
-- antiga. A permissão "caixa.sangria" decide se o botão aparece (navegação);
-- esta policy decide o que o banco aceita.
--
-- Depende da 113 (erp.pode_operar_caixa).
-- ============================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

DROP POLICY IF EXISTS erp_operador_insert ON erp.erp_sangrias;
CREATE POLICY erp_operador_insert ON erp.erp_sangrias
  FOR INSERT TO authenticated
  WITH CHECK (
    erp_sangrias.usuario_id = (SELECT erp.current_erp_user_id())
    AND erp.pode_operar_caixa(erp_sangrias.caixa_id)
  );

DROP POLICY IF EXISTS erp_operador_insert ON erp.erp_entradas_extras;
CREATE POLICY erp_operador_insert ON erp.erp_entradas_extras
  FOR INSERT TO authenticated
  WITH CHECK (
    erp_entradas_extras.usuario_id = (SELECT erp.current_erp_user_id())
    AND erp.pode_operar_caixa(erp_entradas_extras.caixa_id)
  );

COMMIT;
