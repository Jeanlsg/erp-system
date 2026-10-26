-- Volta da migration 118 (login só do CRM fora do ERP).
--
-- Use só se uma tela do ERP quebrar por causa da 118. Devolver o acesso
-- reabre o vazamento para logins do CRM (ver o cabeçalho da 118).
--
-- Funções internas: devolva só a que quebrou, por exemplo
--   GRANT EXECUTE ON FUNCTION erp.situacao_faixa_venda(uuid, date) TO authenticated;
--
-- Trava nas 5 funções e filtro nas views: para tirar de uma view, recrie-a
-- a partir da definição atual sem o "WHERE erp.chamador_do_erp()":
--   SELECT pg_get_viewdef('erp.<view>'::regclass);
-- A função erp.chamador_do_erp() só pode sair depois que nenhuma view ou
-- função a usar.
BEGIN;
DROP POLICY IF EXISTS erp_papel_permissoes_select ON erp.erp_papel_permissoes;
CREATE POLICY erp_papel_permissoes_select ON erp.erp_papel_permissoes
  FOR SELECT TO authenticated USING (true);
COMMIT;
