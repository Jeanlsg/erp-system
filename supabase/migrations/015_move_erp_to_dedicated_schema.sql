-- =====================================================
-- ERP System · Migrar para schema 'erp'
-- Migration: 015_move_erp_to_dedicated_schema.sql
--
-- Move todas as tabelas erp_* e views v_erp_* de public → erp
-- Isola o ERP do Overdrive (que tb usa public) no mesmo banco.
-- =====================================================

-- Cria schema dedicado
CREATE SCHEMA IF NOT EXISTS erp;

-- Garante que o usuario supabase_admin tem permissões no schema
GRANT USAGE ON SCHEMA erp TO supabase_admin;
GRANT ALL ON SCHEMA erp TO supabase_admin;
GRANT USAGE ON SCHEMA erp TO anon, authenticated, service_role;

-- =====================================================
-- PASSO 1: Mover tabelas erp_* de public → erp
-- (ordem importa por causa de FKs)
-- =====================================================

-- Função helper: move tabela se existir no public
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'erp_%'
    ORDER BY tablename
  LOOP
    EXECUTE format('ALTER TABLE public.%I SET SCHEMA erp', r.tablename);
    RAISE NOTICE 'Movido: public.% → erp.%', r.tablename, r.tablename;
  END LOOP;
END $$;

-- =====================================================
-- PASSO 2: Mover views v_erp_* de public → erp
-- =====================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT viewname FROM pg_views
    WHERE schemaname = 'public' AND viewname LIKE 'v_erp_%'
    ORDER BY viewname
  LOOP
    EXECUTE format('ALTER VIEW public.%I SET SCHEMA erp', r.viewname);
    RAISE NOTICE 'Movido: public.% → erp.%', r.viewname, r.viewname;
  END LOOP;
END $$;

-- =====================================================
-- PASSO 3: Mover tipos customizados (erp_pessoa_tipo, etc)
-- =====================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT typname FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND typtype = 'e' AND typname LIKE 'erp_%'
    ORDER BY typname
  LOOP
    EXECUTE format('ALTER TYPE public.%I SET SCHEMA erp', r.typname);
    RAISE NOTICE 'Movido tipo: public.% → erp.%', r.typname, r.typname;
  END LOOP;
END $$;

-- =====================================================
-- PASSO 4: Mover funcoes/triggers do ERP
-- =====================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'erp_%'
    ORDER BY p.proname
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET SCHEMA erp', r.proname, r.args);
    RAISE NOTICE 'Movida funcao: public.%(%) → erp.%(%)', r.proname, r.args, r.proname, r.args;
  END LOOP;
END $$;

-- =====================================================
-- PASSO 5: Atualizar policies para usar schema qualificado
-- (as policies já estão bound às tabelas, mas RLS precisa estar OK no novo schema)
-- =====================================================
-- As policies se movem automaticamente com a tabela (são attachadas a ela).
-- Mas o search_path de quem executa queries precisa enxergar 'erp'.

-- Garante search_path padrao para roles do Supabase
ALTER ROLE anon SET search_path = public, erp, storage, graphql_public;
ALTER ROLE authenticated SET search_path = public, erp, storage, graphql_public;
ALTER ROLE service_role SET search_path = public, erp, storage, graphql_public;
ALTER ROLE supabase_admin SET search_path = public, erp, storage, graphql_public;

-- =====================================================
-- PASSO 6: Garante indice unico em erp.pessoas.celular (para UPSERT sync)
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS erp_pessoas_celular_uidx
  ON erp.pessoas (celular)
  WHERE celular IS NOT NULL;

-- =====================================================
-- VERIFICACAO FINAL
-- =====================================================
DO $$
DECLARE
  total_tab_erp INTEGER;
  total_view_erp INTEGER;
  total_tab_public_erp INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_tab_erp FROM pg_tables WHERE schemaname = 'erp';
  SELECT COUNT(*) INTO total_view_erp FROM pg_views WHERE schemaname = 'erp';
  SELECT COUNT(*) INTO total_tab_public_erp FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'erp_%';

  RAISE NOTICE '=== VERIFICACAO ===';
  RAISE NOTICE 'Tabelas em erp: %', total_tab_erp;
  RAISE NOTICE 'Views em erp: %', total_view_erp;
  RAISE NOTICE 'Tabelas erp_* restantes em public: % (deve ser 0)', total_tab_public_erp;
END $$;