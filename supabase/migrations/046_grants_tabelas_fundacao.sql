-- ============================================================
-- 046: GRANTs das tabelas criadas na 045
--
-- A RLS filtra LINHAS, mas o Postgres ainda exige permissão de
-- TABELA. Sem estes grants, o app recebia "permission denied for
-- table erp_estoque_movimentacoes" mesmo com as policies certas.
-- Segue o padrão das demais tabelas do schema erp.
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- Kardex: leitura pelo app; escrita só via RPC SECURITY DEFINER
GRANT SELECT ON erp.erp_estoque_movimentacoes TO authenticated;
GRANT ALL    ON erp.erp_estoque_movimentacoes TO service_role;

-- Inventário: o app cria, conta e consulta (aplicação é via RPC)
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_inventarios      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_inventario_itens TO authenticated;
GRANT ALL ON erp.erp_inventarios      TO service_role;
GRANT ALL ON erp.erp_inventario_itens TO service_role;

-- Cadastros financeiros: leitura para todos, escrita restrita pela RLS a admin
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_plano_contas  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_centros_custo TO authenticated;
GRANT ALL ON erp.erp_plano_contas  TO service_role;
GRANT ALL ON erp.erp_centros_custo TO service_role;

-- Auditoria: somente leitura (a policy já restringe a admin);
-- a escrita acontece pelo trigger, que roda como definer.
GRANT SELECT ON erp.erp_auditoria TO authenticated;
GRANT ALL    ON erp.erp_auditoria TO service_role;
GRANT USAGE, SELECT ON SEQUENCE erp.erp_auditoria_id_seq TO service_role;

GRANT SELECT ON erp.vw_dre_mensal TO authenticated, service_role;
