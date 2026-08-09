-- =====================================================
-- Criar schema 'erp' no apps_supabase-db-1
-- (o ERP vai morar aqui, isolado do Overdrive que fica no public)
-- =====================================================

CREATE SCHEMA IF NOT EXISTS erp;

GRANT USAGE ON SCHEMA erp TO supabase_admin;
GRANT ALL ON SCHEMA erp TO supabase_admin;
GRANT USAGE ON SCHEMA erp TO anon, authenticated, service_role;

-- search_path padrao
ALTER ROLE anon SET search_path = public, erp, storage, graphql_public, net, vault;
ALTER ROLE authenticated SET search_path = public, erp, storage, graphql_public, net, vault;
ALTER ROLE service_role SET search_path = public, erp, storage, graphql_public, net, vault;
ALTER ROLE supabase_admin SET search_path = public, erp, storage, graphql_public, net, vault;