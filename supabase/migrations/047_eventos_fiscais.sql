-- ============================================================
-- 047: FASE 2b — Eventos fiscais
--
-- Registra o que a SEFAZ chama de "eventos" da NF-e e a
-- inutilização de faixa de numeração. Sem isso, cancelamento e
-- carta de correção não deixavam rastro no ERP, e os buracos de
-- numeração (nota rejeitada consome número) não tinham como ser
-- regularizados perante a SEFAZ.
--
-- GRANT vai junto: RLS filtra linhas, mas o Postgres ainda exige
-- permissão de tabela (lição da 045/046).
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- ── Eventos de nota (cancelamento, carta de correção) ──
CREATE TABLE IF NOT EXISTS erp.erp_nfe_eventos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id       uuid NOT NULL REFERENCES erp.erp_notas_fiscais(id) ON DELETE RESTRICT,
  loja_id       uuid NOT NULL REFERENCES erp.erp_lojas(id) ON DELETE RESTRICT,
  tipo          text NOT NULL CHECK (tipo IN ('cancelamento','carta_correcao')),
  sequencia     integer NOT NULL DEFAULT 1,
  justificativa text NOT NULL,
  aceito        boolean NOT NULL DEFAULT false,
  cstat         varchar(10),
  motivo        text,
  protocolo     varchar(30),
  ambiente      varchar(20),
  usuario_id    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erp_nfe_eventos_nota ON erp.erp_nfe_eventos (nota_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_erp_nfe_eventos_loja ON erp.erp_nfe_eventos (loja_id, tipo);
-- Uma CC-e por sequência; cancelamento aceito é único por nota.
CREATE UNIQUE INDEX IF NOT EXISTS erp_nfe_eventos_cce_seq
  ON erp.erp_nfe_eventos (nota_id, sequencia) WHERE tipo = 'carta_correcao' AND aceito;
CREATE UNIQUE INDEX IF NOT EXISTS erp_nfe_eventos_cancel_unico
  ON erp.erp_nfe_eventos (nota_id) WHERE tipo = 'cancelamento' AND aceito;

-- ── Inutilização de faixa de numeração ──
CREATE TABLE IF NOT EXISTS erp.erp_inutilizacoes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id        uuid NOT NULL REFERENCES erp.erp_lojas(id) ON DELETE RESTRICT,
  modelo         integer NOT NULL DEFAULT 55 CHECK (modelo IN (55, 65)),
  serie          integer NOT NULL,
  numero_inicial integer NOT NULL,
  numero_final   integer NOT NULL,
  justificativa  text NOT NULL,
  inutilizada    boolean NOT NULL DEFAULT false,
  cstat          varchar(10),
  motivo         text,
  protocolo      varchar(30),
  ambiente       varchar(20),
  usuario_id     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (numero_final >= numero_inicial)
);

CREATE INDEX IF NOT EXISTS idx_erp_inutilizacoes_loja ON erp.erp_inutilizacoes (loja_id, created_at DESC);
-- Não deixa inutilizar duas vezes a mesma faixa com sucesso
CREATE UNIQUE INDEX IF NOT EXISTS erp_inutilizacoes_faixa_unica
  ON erp.erp_inutilizacoes (loja_id, modelo, serie, numero_inicial, numero_final)
  WHERE inutilizada;

-- ── RLS: leitura para o ERP, escrita só via edge function (service_role) ──
ALTER TABLE erp.erp_nfe_eventos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_inutilizacoes ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['erp_nfe_eventos','erp_inutilizacoes'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS erp_user_select ON erp.%I', t);
    EXECUTE format('CREATE POLICY erp_user_select ON erp.%I FOR SELECT TO authenticated USING ((SELECT erp.current_erp_user_id()) IS NOT NULL)', t);
  END LOOP;
END $$;

GRANT SELECT ON erp.erp_nfe_eventos   TO authenticated;
GRANT SELECT ON erp.erp_inutilizacoes TO authenticated;
GRANT ALL    ON erp.erp_nfe_eventos   TO service_role;
GRANT ALL    ON erp.erp_inutilizacoes TO service_role;

-- Auditoria também nestes dois
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['erp_nfe_eventos','erp_inutilizacoes'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auditoria ON erp.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON erp.%I
         FOR EACH ROW EXECUTE FUNCTION erp.fn_auditoria()', t);
  END LOOP;
END $$;

-- ── Devolução: a nota de devolução aponta para a original ──
ALTER TABLE erp.erp_notas_fiscais
  ADD COLUMN IF NOT EXISTS nota_referenciada_id uuid REFERENCES erp.erp_notas_fiscais(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS finalidade integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN erp.erp_notas_fiscais.finalidade IS
  '1=normal, 2=complementar, 3=ajuste, 4=devolução (finNFe da SEFAZ)';

CREATE INDEX IF NOT EXISTS idx_erp_notas_referenciada
  ON erp.erp_notas_fiscais (nota_referenciada_id) WHERE nota_referenciada_id IS NOT NULL;
