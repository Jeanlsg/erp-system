-- ============================================================
-- 059: Registro de envio de nota fiscal ao cliente
--
-- O contrato pede envio automático da nota via mensageria. O envio em si
-- é a edge function erp-enviar-nota (e-mail via Resend; WhatsApp quando um
-- canal for configurado). Aqui fica o RASTRO: "enviei" sem registro vira
-- discussão com cliente — com registro vira consulta.
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS erp.erp_nota_envios (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nota_id    uuid NOT NULL REFERENCES erp.erp_notas_fiscais(id) ON DELETE CASCADE,
  canal      text NOT NULL CHECK (canal IN ('email','whatsapp')),
  destino    text NOT NULL,
  sucesso    boolean NOT NULL,
  detalhe    text,
  automatico boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erp_nota_envios_nota ON erp.erp_nota_envios (nota_id, created_at DESC);

ALTER TABLE erp.erp_nota_envios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_user_select ON erp.erp_nota_envios;
CREATE POLICY erp_user_select ON erp.erp_nota_envios
  FOR SELECT TO authenticated USING ((SELECT erp.current_erp_user_id()) IS NOT NULL);
GRANT SELECT ON erp.erp_nota_envios TO authenticated;
GRANT ALL ON erp.erp_nota_envios TO service_role;
