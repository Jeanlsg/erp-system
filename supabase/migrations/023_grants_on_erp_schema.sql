-- Garante que anon/authenticated/service_role tem acesso ao schema erp
GRANT USAGE ON SCHEMA erp TO anon, authenticated, service_role;

-- Garante SELECT/INSERT/UPDATE/DELETE em todas as tabelas do schema erp
DO $$
DECLARE r record;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'erp') LOOP
    EXECUTE format('GRANT SELECT ON erp.%I TO anon, authenticated, service_role', r.tablename);
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON erp.%I TO authenticated, service_role', r.tablename);
    EXECUTE format('GRANT ALL ON erp.%I TO service_role', r.tablename);
  END LOOP;
END $$;

-- Garante acesso a sequences (para UUIDs e BIGSERIALs)
DO $$
DECLARE r record;
BEGIN
  FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'erp') LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE erp.%I TO authenticated, service_role', r.sequence_name);
  END LOOP;
END $$;

-- Notifica PostgREST para recarregar
NOTIFY pgrst, 'reload schema';

SELECT 'GRANTs aplicados. Schema cache sera recarregado.' AS status;