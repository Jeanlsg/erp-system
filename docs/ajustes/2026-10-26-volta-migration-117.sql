-- Volta da migration 117 (fecha EXECUTE do anon no erp).
--
-- Só use se o event trigger atrapalhar uma migration futura. NÃO devolva o
-- EXECUTE de PUBLIC/anon às funções: isso reabre o vazamento (ver o cabeçalho
-- da 117). authenticated e service_role mantêm o acesso que tinham.
BEGIN;
DROP EVENT TRIGGER IF EXISTS erp_fecha_execute_funcao_nova;
DROP FUNCTION IF EXISTS erp.fecha_execute_funcao_nova();
-- A view public.v_erp_nfe_entrada_dashboard não volta: nenhuma tela a usa, e
-- recriada no public ela fica aberta ao anon. Se precisar dela, crie em erp
-- WITH (security_invoker = true) e conceda só a authenticated.
COMMIT;
