-- ============================================================
-- 057: Ponte ERP → CRM
--
-- O CRM (Overdrive) é um produto multi-tenant que roda em outras VPSs —
-- ele NÃO pode ganhar código específico do ERP. Por isso o vínculo é feito
-- pelo lado do ERP, falando com o CRM pela mesma porta que qualquer sistema
-- externo usa: a API pública de leads (api-leads), autenticada por chave de
-- workspace. O CRM não sabe que existe um ERP.
--
-- O que a ponte envia:
--   venda finalizada  → upsert do lead (telefone do cliente) + campos
--                       "Última compra", produtos, valor e "Término
--                       estimado" (data_venda + duracao_dias do produto),
--                       movendo para a etapa "Venda Realizada"
--   orçamento criado  → campos "Orçamento aberto em" e valor — sem mexer
--                       no funil; o follow-up é o gatilho campo_data do CRM
--
-- Fila + cron em vez de chamada inline: o PDV não pode esperar o CRM, e
-- CRM fora do ar não pode perder venda. Cada loja fala com o SEU workspace
-- (Petrolina e Juazeiro são workspaces distintos no CRM).
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '120s';

-- ── Ciclo de consumo: quantos dias dura o produto ──
-- É o dado que transforma venda em previsão de recompra.
ALTER TABLE erp.erp_produtos
  ADD COLUMN IF NOT EXISTS duracao_dias integer;

COMMENT ON COLUMN erp.erp_produtos.duracao_dias IS
  'Quantos dias o produto dura em uso típico (pote de whey 900g ≈ 30). Alimenta o "Término estimado" no CRM para o disparo de recompra.';

-- ── Fila de sincronização ──
CREATE TABLE IF NOT EXISTS erp.erp_crm_sync (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  evento        text NOT NULL CHECK (evento IN ('venda','orcamento')),
  referencia_id uuid NOT NULL,
  loja_id       uuid NOT NULL,
  status        text NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('pendente','processado','ignorado','erro')),
  tentativas    integer NOT NULL DEFAULT 0,
  detalhe       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  processado_em timestamptz
);

-- A mesma venda pode voltar à fila (retry manual), mas nunca duplicada pendente
CREATE UNIQUE INDEX IF NOT EXISTS erp_crm_sync_pendente_key
  ON erp.erp_crm_sync (evento, referencia_id) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_erp_crm_sync_status
  ON erp.erp_crm_sync (status, created_at);

ALTER TABLE erp.erp_crm_sync ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_user_select ON erp.erp_crm_sync;
CREATE POLICY erp_user_select ON erp.erp_crm_sync
  FOR SELECT TO authenticated USING ((SELECT erp.current_erp_user_id()) IS NOT NULL);
GRANT SELECT ON erp.erp_crm_sync TO authenticated;
GRANT ALL ON erp.erp_crm_sync TO service_role;

-- ── Gatilhos que alimentam a fila ──
-- AFTER e sem chamadas de rede: enfileirar é uma escrita local e nunca
-- atrasa nem derruba a venda.
CREATE OR REPLACE FUNCTION erp.fn_enfileirar_crm_venda() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
BEGIN
  IF NEW.status::text <> 'finalizada' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status::text = 'finalizada' THEN RETURN NEW; END IF;
  -- Sem cliente não há lead: o id do lead no CRM é o telefone.
  IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO erp.erp_crm_sync (evento, referencia_id, loja_id)
  VALUES ('venda', NEW.id, NEW.loja_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_sync_venda ON erp.erp_vendas;
CREATE TRIGGER trg_crm_sync_venda
  AFTER INSERT OR UPDATE OF status ON erp.erp_vendas
  FOR EACH ROW EXECUTE FUNCTION erp.fn_enfileirar_crm_venda();

CREATE OR REPLACE FUNCTION erp.fn_enfileirar_crm_orcamento() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
BEGIN
  IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO erp.erp_crm_sync (evento, referencia_id, loja_id)
  VALUES ('orcamento', NEW.id, NEW.loja_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_sync_orcamento ON erp.erp_orcamentos;
CREATE TRIGGER trg_crm_sync_orcamento
  AFTER INSERT ON erp.erp_orcamentos
  FOR EACH ROW EXECUTE FUNCTION erp.fn_enfileirar_crm_orcamento();

-- ── Disparo do processador (mesmo padrão da coleta DF-e) ──
INSERT INTO erp.erp_configuracoes_sistema (chave, valor, descricao)
SELECT 'crm_sync_ativo', 'true', 'Liga a sincronização de vendas e orçamentos com o CRM (fila erp_crm_sync)'
WHERE NOT EXISTS (SELECT 1 FROM erp.erp_configuracoes_sistema WHERE chave = 'crm_sync_ativo');

CREATE OR REPLACE FUNCTION erp.disparar_crm_sync() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v_ligado text; v_url text; v_key text; v_n integer;
BEGIN
  SELECT valor INTO v_ligado FROM erp.erp_configuracoes_sistema WHERE chave = 'crm_sync_ativo';
  IF COALESCE(v_ligado, 'false') <> 'true' THEN RETURN 0; END IF;

  SELECT count(*) INTO v_n FROM erp.erp_crm_sync WHERE status = 'pendente';
  IF v_n = 0 THEN RETURN 0; END IF;

  SELECT valor INTO v_url FROM erp.erp_configuracoes_sistema WHERE chave = 'functions_base_url';
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'crm_sync ligado mas falta functions_base_url ou service_role_key';
    RETURN 0;
  END IF;

  PERFORM net.http_post(
    url     := rtrim(v_url, '/') || '/erp-crm-sync',
    headers := jsonb_build_object('Content-Type','application/json',
                                  'Authorization','Bearer ' || v_key),
    body    := '{}'::jsonb
  );
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION erp.disparar_crm_sync() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erp.disparar_crm_sync() TO service_role;

SELECT cron.schedule('erp_crm_sync', '*/5 * * * *', $cron$ SELECT erp.disparar_crm_sync(); $cron$)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'erp_crm_sync');
