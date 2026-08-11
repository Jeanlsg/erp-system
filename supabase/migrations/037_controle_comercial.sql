-- ============================================================================
-- 037 · CONTROLE COMERCIAL — Orçamentos, Ordens de Serviço, Consignações,
--       Locações (páginas /controle-comercial/* — PLANO_FUNCIONAL.md Fase 4)
-- RLS já no padrão initplan (SELECT fn()). Sem grants para anon.
-- ============================================================================

-- ---------------------------------------------------------------- ORÇAMENTOS
CREATE TABLE IF NOT EXISTS erp.erp_orcamentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id      UUID NOT NULL REFERENCES erp.erp_lojas(id),
  cliente_id   UUID REFERENCES erp.erp_pessoas(id),
  numero       SERIAL,
  validade     DATE,
  total        NUMERIC(12,2) NOT NULL DEFAULT 0,
  status       VARCHAR(20) NOT NULL DEFAULT 'aberto', -- aberto|aprovado|recusado|expirado|convertido
  observacoes  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS erp.erp_orcamento_itens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id   UUID NOT NULL REFERENCES erp.erp_orcamentos(id) ON DELETE CASCADE,
  descricao      VARCHAR(255) NOT NULL,
  quantidade     NUMERIC(12,3) NOT NULL DEFAULT 1,
  valor_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal       NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- --------------------------------------------------------- ORDENS DE SERVIÇO
CREATE TABLE IF NOT EXISTS erp.erp_ordens_servico (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id          UUID NOT NULL REFERENCES erp.erp_lojas(id),
  cliente_id       UUID REFERENCES erp.erp_pessoas(id),
  numero           SERIAL,
  descricao        TEXT NOT NULL,
  equipamento      VARCHAR(255),
  defeito_relatado TEXT,
  laudo            TEXT,
  valor_servicos   NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_pecas      NUMERIC(12,2) NOT NULL DEFAULT 0,
  previsao         DATE,
  status           VARCHAR(20) NOT NULL DEFAULT 'aberta', -- aberta|em_andamento|aguardando_peca|concluida|entregue|cancelada
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------- CONSIGNAÇÕES
CREATE TABLE IF NOT EXISTS erp.erp_consignacoes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id              UUID NOT NULL REFERENCES erp.erp_lojas(id),
  cliente_id           UUID NOT NULL REFERENCES erp.erp_pessoas(id),
  numero               SERIAL,
  total                NUMERIC(12,2) NOT NULL DEFAULT 0,
  status               VARCHAR(20) NOT NULL DEFAULT 'aberta', -- aberta|acertada|cancelada
  data_acerto_prevista DATE,
  data_acerto          TIMESTAMPTZ,
  observacoes          TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS erp.erp_consignacao_itens (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consignacao_id       UUID NOT NULL REFERENCES erp.erp_consignacoes(id) ON DELETE CASCADE,
  produto_id           UUID NOT NULL REFERENCES erp.erp_produtos(id),
  quantidade           NUMERIC(12,3) NOT NULL DEFAULT 1,
  valor_unitario       NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantidade_devolvida NUMERIC(12,3) NOT NULL DEFAULT 0,
  quantidade_vendida   NUMERIC(12,3) NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------- LOCAÇÕES
CREATE TABLE IF NOT EXISTS erp.erp_locacoes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id          UUID NOT NULL REFERENCES erp.erp_lojas(id),
  cliente_id       UUID NOT NULL REFERENCES erp.erp_pessoas(id),
  numero           SERIAL,
  descricao_item   TEXT NOT NULL,
  data_inicio      DATE NOT NULL,
  data_fim_prevista DATE,
  data_devolucao   TIMESTAMPTZ,
  valor_periodo    NUMERIC(12,2) NOT NULL DEFAULT 0,
  caucao           NUMERIC(12,2),
  status           VARCHAR(20) NOT NULL DEFAULT 'ativa', -- ativa|devolvida|atrasada|cancelada
  observacoes      TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------ ÍNDICES
CREATE INDEX IF NOT EXISTS idx_erp_orcamentos_loja       ON erp.erp_orcamentos (loja_id);
CREATE INDEX IF NOT EXISTS idx_erp_orcamentos_cliente    ON erp.erp_orcamentos (cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_orcamentos_status     ON erp.erp_orcamentos (status);
CREATE INDEX IF NOT EXISTS idx_erp_orc_itens_orcamento   ON erp.erp_orcamento_itens (orcamento_id);
CREATE INDEX IF NOT EXISTS idx_erp_os_loja               ON erp.erp_ordens_servico (loja_id);
CREATE INDEX IF NOT EXISTS idx_erp_os_cliente            ON erp.erp_ordens_servico (cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_os_status             ON erp.erp_ordens_servico (status);
CREATE INDEX IF NOT EXISTS idx_erp_consig_loja           ON erp.erp_consignacoes (loja_id);
CREATE INDEX IF NOT EXISTS idx_erp_consig_cliente        ON erp.erp_consignacoes (cliente_id);
CREATE INDEX IF NOT EXISTS idx_erp_consig_itens_consig   ON erp.erp_consignacao_itens (consignacao_id);
CREATE INDEX IF NOT EXISTS idx_erp_consig_itens_produto  ON erp.erp_consignacao_itens (produto_id);
CREATE INDEX IF NOT EXISTS idx_erp_locacoes_loja         ON erp.erp_locacoes (loja_id);
CREATE INDEX IF NOT EXISTS idx_erp_locacoes_cliente      ON erp.erp_locacoes (cliente_id);
CREATE INDEX IF NOT EXISTS idx_erp_locacoes_status       ON erp.erp_locacoes (status);

-- ------------------------------------------------------------ RLS + GRANTS
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'erp_orcamentos', 'erp_orcamento_itens', 'erp_ordens_servico',
    'erp_consignacoes', 'erp_consignacao_itens', 'erp_locacoes'
  ] LOOP
    EXECUTE format('ALTER TABLE erp.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON erp.%I TO authenticated', t);

    -- staff operacional: precisa existir em erp_usuarios
    EXECUTE format(
      'CREATE POLICY erp_user_select ON erp.%I FOR SELECT TO authenticated USING ((SELECT erp.current_erp_user_id()) IS NOT NULL)', t);
    EXECUTE format(
      'CREATE POLICY erp_user_insert ON erp.%I FOR INSERT TO authenticated WITH CHECK ((SELECT erp.current_erp_user_id()) IS NOT NULL)', t);
    EXECUTE format(
      'CREATE POLICY erp_user_update ON erp.%I FOR UPDATE TO authenticated USING ((SELECT erp.current_erp_user_id()) IS NOT NULL)', t);
    EXECUTE format(
      'CREATE POLICY erp_admin_delete ON erp.%I FOR DELETE TO authenticated USING ((SELECT erp.is_erp_admin()))', t);
  END LOOP;
END $$;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA erp TO authenticated;

-- updated_at
CREATE TRIGGER trg_erp_orcamentos_updated_at     BEFORE UPDATE ON erp.erp_orcamentos     FOR EACH ROW EXECUTE FUNCTION erp.erp_set_updated_at();
CREATE TRIGGER trg_erp_ordens_servico_updated_at BEFORE UPDATE ON erp.erp_ordens_servico FOR EACH ROW EXECUTE FUNCTION erp.erp_set_updated_at();
CREATE TRIGGER trg_erp_consignacoes_updated_at   BEFORE UPDATE ON erp.erp_consignacoes   FOR EACH ROW EXECUTE FUNCTION erp.erp_set_updated_at();
CREATE TRIGGER trg_erp_locacoes_updated_at       BEFORE UPDATE ON erp.erp_locacoes       FOR EACH ROW EXECUTE FUNCTION erp.erp_set_updated_at();

ANALYZE erp.erp_orcamentos, erp.erp_orcamento_itens, erp.erp_ordens_servico,
        erp.erp_consignacoes, erp.erp_consignacao_itens, erp.erp_locacoes;

NOTIFY pgrst, 'reload schema';
