-- =====================================================
-- VERIFICACAO FINAL DO ESTADO UNIFICADO
-- Stack: apps_supabase-db-1
-- Overdrive: schema 'public'
-- ERP: schema 'erp'
-- =====================================================

\echo ==== ESTADO GERAL ====
SELECT
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') AS tabelas_overdrive,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'erp') AS tabelas_erp,
  (SELECT COUNT(*) FROM pg_views WHERE schemaname = 'public') AS views_overdrive,
  (SELECT COUNT(*) FROM pg_views WHERE schemaname = 'erp') AS views_erp,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') AS policies_overdrive,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'erp') AS policies_erp;

\echo
\echo ==== SEED ERP ====
SELECT 'lojas' AS tabela, COUNT(*) FROM erp.erp_lojas
UNION ALL SELECT 'categorias', COUNT(*) FROM erp.erp_categorias
UNION ALL SELECT 'produtos', COUNT(*) FROM erp.erp_produtos
UNION ALL SELECT 'estoque', COUNT(*) FROM erp.erp_estoque;

\echo
\echo ==== PESSOAS SINCRONIZADAS DO OVERDRIVE ====
SELECT nome_razao, celular, substr(observacoes, 1, 50) AS obs
FROM erp.erp_pessoas
WHERE observacoes LIKE '%overdrive%'
ORDER BY created_at DESC;

\echo
\echo ==== RLS NO ERP ====
SELECT
  COUNT(*) FILTER (WHERE rowsecurity = true) AS com_rls,
  COUNT(*) FILTER (WHERE rowsecurity = false) AS sem_rls,
  COUNT(*) AS total
FROM pg_tables
WHERE schemaname = 'erp';