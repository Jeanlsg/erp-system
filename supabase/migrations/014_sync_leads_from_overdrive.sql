-- =====================================================
-- ERP System · Sync de leads do Overdrive (apps_supabase)
-- Migration: 014_sync_leads_from_overdrive.sql
--
-- IMPORTANTE: este migration faz COPY ENTRE BANCOS.
-- Ele conecta no apps_supabase-db-1 via postgres_fdw OU
-- dump + restore. Aqui vou usar a abordagem DIRETA via
-- dblink se disponível, ou psql pipe.
--
-- Estratégia:
--   1. Sincroniza leads de apps_supabase.leads (origem)
--      para erp_supabaseerp.erp_pessoas (destino).
--   2. Apenas pessoas (@s.whatsapp.net), ignora grupos (@g.us).
--   3. Upsert por telefone (so digits). Se ja existir com mesmo
--      telefone, atualiza nome/observacoes.
--   4. Telefone salvo sem o @s.whatsapp.net.
--   5. Marca origem em observacoes: '[overdrive:{lead_id}]'.
-- =====================================================

-- NOTA: este script é EXECUTADO NO ERP_SUPABASEERP-DB-1.
-- Para acessar o apps_supabase-db-1 (origem), usamos dblink.
-- Se a extensão não existir, instalamos.

CREATE EXTENSION IF NOT EXISTS dblink;

-- Cria server de conexão com o apps_supabase-db-1 (origem)
-- (Necessário executar APENAS uma vez. Se já existir, ok.)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_foreign_server WHERE srvname = 'overdrive_apps_supabase') THEN
    CREATE SERVER overdrive_apps_supabase
      FOREIGN DATA WRAPPER dblink_fdw
      OPTIONS (
        host 'apps_supabase-db-1',
        port '5432',
        dbname 'postgres'
      );
  END IF;
END $$;

-- Cria mapping para o usuario supabase_admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_user_mappings
    WHERE srvname = 'overdrive_apps_supabase'
      AND umuser = (SELECT oid FROM pg_roles WHERE rolname = 'supabase_admin')
  ) THEN
    CREATE USER MAPPING FOR supabase_admin
      SERVER overdrive_apps_supabase
      OPTIONS (user 'supabase_admin', password '8fVfm60HEYLmaIxAh6olUqawVcWf0Ccb');
  END IF;
END $$;

-- Cria indice UNIQUE parcial em celular para permitir UPSERT idempotente
-- (apenas onde nao-nulo; multiplos NULL sao permitidos)
CREATE UNIQUE INDEX IF NOT EXISTS erp_pessoas_celular_uidx
  ON erp_pessoas (celular)
  WHERE celular IS NOT NULL;

-- =====================================================
-- SYNC: insere/atualiza pessoas vindas do Overdrive
-- =====================================================

-- Dry-run: conta quantos serão migrados
DO $$
DECLARE
  total_leads INTEGER;
  total_pessoas INTEGER;
  ja_existentes INTEGER;
  novos INTEGER;
BEGIN
  -- Conta leads validos (apenas pessoas, nao grupos)
  SELECT COUNT(*) INTO total_leads
  FROM dblink('overdrive_apps_supabase',
    'SELECT id, name, email, remotejid FROM leads WHERE remotejid LIKE ''%@s.whatsapp.net'''
  ) AS t(id text, name text, email text, remotejid text);

  -- Conta pessoas ja existentes com mesmo telefone
  SELECT COUNT(*) INTO ja_existentes
  FROM dblink('overdrive_apps_supabase',
    'SELECT remotejid FROM leads WHERE remotejid LIKE ''%@s.whatsapp.net'''
  ) AS t(remotejid text)
  INNER JOIN erp_pessoas p
    ON regexp_replace(t.remotejid, '@.*$', '') = COALESCE(p.celular, p.telefone);

  novos := total_leads - ja_existentes;

  RAISE NOTICE 'DRY-RUN: % leads no Overdrive, % ja existem no ERP, % serao NOVOS', total_leads, ja_existentes, novos;
END $$;

-- Sync real: UPSERT por telefone
INSERT INTO erp_pessoas (tipo, nome_razao, celular, observacoes, ativo)
SELECT
  'cliente'::erp_pessoa_tipo,
  COALESCE(NULLIF(t.name, ''), 'Sem nome') AS nome_razao,
  regexp_replace(t.remotejid, '@.*$', '') AS celular,
  '[overdrive:' || t.id || '] importado de leads em ' || NOW()::date AS observacoes,
  true
FROM dblink('overdrive_apps_supabase',
  'SELECT id, name, email, remotejid FROM leads WHERE remotejid LIKE ''%@s.whatsapp.net'''
) AS t(id text, name text, email text, remotejid text)
ON CONFLICT (celular) DO UPDATE
  SET nome_razao = COALESCE(EXCLUDED.nome_razao, erp_pessoas.nome_razao),
      observacoes = erp_pessoas.observacoes || E'\n[overdrive-update:' || EXCLUDED.observacoes || ']',
      updated_at = NOW();

-- Relatorio final
SELECT
  'Novos clientes importados do Overdrive' AS info,
  COUNT(*) FILTER (WHERE observacoes LIKE '[overdrive:% importado de leads em %' AND created_at::date = CURRENT_DATE) AS novos,
  COUNT(*) FILTER (WHERE observacoes LIKE '%overdrive-update%') AS atualizados,
  COUNT(*) AS total_erp_pessoas
FROM erp_pessoas;