-- ============================================================
-- Volta da migration 122 (limite de tentativas no login por CPF).
--
-- A edge erp-login aguenta a falta das funções: entra sem limite e registra
-- o erro no log a cada tentativa. Para não encher o log, volte também a
-- erp-login e a erp-reset-password para antes da 122 (commit 3324cb1).
--
-- ssh "$ERP_SSH_HOST" "docker exec -i $ERP_DB_CONTAINER psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1" < docs/ajustes/2026-11-03-volta-migration-122.sql
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

DROP FUNCTION IF EXISTS erp.liberar_login(text[]);
DROP FUNCTION IF EXISTS erp.registrar_falha_login(text[]);
DROP FUNCTION IF EXISTS erp.login_bloqueado(text[]);
DROP TABLE IF EXISTS erp.erp_tentativas_login;

COMMIT;
