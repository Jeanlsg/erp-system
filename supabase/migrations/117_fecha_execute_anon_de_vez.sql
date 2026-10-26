-- ============================================================
-- 117: Fecha de novo o EXECUTE do anon nas funções do erp — agora de vez
--
-- A 056 fechou as funções que existiam e tentou mudar o default com
-- ALTER DEFAULT PRIVILEGES ... IN SCHEMA erp REVOKE EXECUTE ... FROM PUBLIC.
-- Isso não tem efeito: default por schema só SOMA ao default global, não tira
-- o EXECUTE que o Postgres dá a PUBLIC em toda função nova. Conferido em
-- produção em 26/10/2026: pg_default_acl não tem linha nenhuma para o schema
-- erp, e 39 funções criadas depois da 056 estavam executáveis pelo anon.
-- A pior: resumo_compras_telefone_loja(telefone, loja) devolvia, para
-- qualquer um com a chave pública do site, quantas compras aquele telefone
-- fez, o total gasto e as datas. recalcular_comissao_venda chegava a gravar.
--
-- O mesmo buraco abriu em public.v_erp_nfe_entrada_dashboard (027): a view
-- foi criada sem schema e caiu no public, é do supabase_admin (superusuário,
-- ignora RLS) e o default do public a liberou para o anon. Nenhuma tela a
-- usa. Não vazava só porque erp_nfe_entrada ainda está vazia; vazaria toda
-- nota de entrada assim que a primeira fosse importada.
--
-- Correção:
-- 1. Varredura: toda função do erp que o anon executa perde o EXECUTE de
--    PUBLIC e de anon. Onde o acesso vinha de PUBLIC, authenticated e
--    service_role recebem o EXECUTE explícito — o app continua chamando
--    como antes; a trava fina segue sendo current_erp_user_id()/RLS.
-- 2. Trava permanente: event trigger que faz o mesmo em toda função NOVA do
--    schema erp (ACL nula = acabou de nascer). CREATE OR REPLACE mantém a ACL
--    que a função já tinha, então as que são só do service_role continuam só
--    do service_role. Ele também fecha as funções que um pg_restore --no-acl
--    recria.
-- 3. A view do public sai.
-- Volta: docs/ajustes/2026-10-26-volta-migration-117.sql
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- 1. Varredura.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS f,
           (p.proacl IS NULL OR EXISTS (
              SELECT 1 FROM aclexplode(p.proacl) a
              WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')) AS vinha_de_public
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'erp'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE ALL ON ROUTINE %s FROM PUBLIC, anon', r.f);
    IF r.vinha_de_public THEN
      EXECUTE format('GRANT EXECUTE ON ROUTINE %s TO authenticated, service_role', r.f);
    END IF;
  END LOOP;
END $$;

-- 2. Função nova do erp nasce fechada para o anon.
CREATE OR REPLACE FUNCTION erp.fecha_execute_funcao_nova()
RETURNS event_trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.objid
    FROM pg_event_trigger_ddl_commands() c
    JOIN pg_proc p ON p.oid = c.objid
    WHERE c.object_type IN ('function', 'procedure')
      AND c.schema_name = 'erp'
      AND p.proacl IS NULL
  LOOP
    EXECUTE format('REVOKE ALL ON ROUTINE %s FROM PUBLIC, anon', r.objid::regprocedure);
    EXECUTE format('GRANT EXECUTE ON ROUTINE %s TO authenticated, service_role', r.objid::regprocedure);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION erp.fecha_execute_funcao_nova() FROM PUBLIC, anon, authenticated;

DROP EVENT TRIGGER IF EXISTS erp_fecha_execute_funcao_nova;
CREATE EVENT TRIGGER erp_fecha_execute_funcao_nova
  ON ddl_command_end
  WHEN TAG IN ('CREATE FUNCTION', 'CREATE PROCEDURE')
  EXECUTE FUNCTION erp.fecha_execute_funcao_nova();

-- 3. View sem uso que expunha erp_nfe_entrada no public.
DROP VIEW IF EXISTS public.v_erp_nfe_entrada_dashboard;

-- Confere antes de gravar: nada do erp executável pelo anon.
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'erp' AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF n > 0 THEN
    RAISE EXCEPTION '117: ainda há % função(ões) do erp executáveis pelo anon', n;
  END IF;
END $$;

COMMIT;
