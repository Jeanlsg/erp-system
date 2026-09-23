-- ============================================================
-- 081 — o que vai no pedido, e para onde vai
--
-- O Ciclo de pedidos registrava cliente, endereço e taxa — mas não O QUE
-- está sendo entregue. Quem separa a sacola não tinha lista de conferência,
-- e o cartão do pedido mostrava valor sem dizer de quê.
--
-- E o endereço era digitado inteiro a cada pedido: erp_pessoas.endereco é
-- um jsonb que nenhuma tela preenche (está vazio em todos os cadastros), e
-- cliente que compra toda semana ditava a rua toda vez.
--
-- Duas tabelas:
--   · erp_pedido_itens — produto, quantidade e preço do momento. O preço
--     fica gravado: mudança de tabela depois não reescreve o pedido antigo.
--   · erp_pessoa_enderecos — os endereços de cada cliente, com apelido
--     ("casa", "trabalho") e um marcado como padrão.
-- ============================================================

BEGIN;

-- ---------- itens do pedido ----------
CREATE TABLE IF NOT EXISTS erp.erp_pedido_itens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id    uuid NOT NULL REFERENCES erp.erp_pedidos(id) ON DELETE CASCADE,
  produto_id   uuid REFERENCES erp.erp_produtos(id) ON DELETE SET NULL,
  nome         text NOT NULL,
  quantidade   numeric(14,3) NOT NULL CHECK (quantidade > 0),
  preco_unitario numeric(14,2) NOT NULL DEFAULT 0,
  subtotal     numeric(14,2) NOT NULL DEFAULT 0,
  observacao   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON erp.erp_pedido_itens(pedido_id);

COMMENT ON TABLE erp.erp_pedido_itens IS
  'O que vai na entrega. Serve de lista de separação e de composição do valor.';
COMMENT ON COLUMN erp.erp_pedido_itens.nome IS
  'Nome no momento do pedido. Produto renomeado ou excluído depois não reescreve o histórico.';
COMMENT ON COLUMN erp.erp_pedido_itens.preco_unitario IS
  'Preço cobrado neste pedido, não o preço atual do produto.';

-- ---------- endereços do cliente ----------
CREATE TABLE IF NOT EXISTS erp.erp_pessoa_enderecos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id    uuid NOT NULL REFERENCES erp.erp_pessoas(id) ON DELETE CASCADE,
  apelido      text,
  cep          text,
  logradouro   text NOT NULL,
  numero       text NOT NULL,
  complemento  text,
  bairro       text,
  cidade       text,
  uf           text,
  referencia   text,
  padrao       boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pessoa_enderecos_pessoa ON erp.erp_pessoa_enderecos(pessoa_id);

-- Um padrão por pessoa. Índice parcial em vez de constraint: permite zero
-- padrões (cliente novo) e impede dois.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pessoa_endereco_padrao
  ON erp.erp_pessoa_enderecos(pessoa_id) WHERE padrao;

COMMENT ON TABLE erp.erp_pessoa_enderecos IS
  'Endereços de entrega do cliente. O pedido copia o escolhido para endereco_entrega — mudar o cadastro depois não muda entrega já feita.';

-- marcar um endereço como padrão tira o padrão do anterior, sem o usuário
-- precisar desmarcar na mão (e sem esbarrar no índice único)
CREATE OR REPLACE FUNCTION erp.endereco_padrao_unico()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.padrao THEN
    UPDATE erp.erp_pessoa_enderecos
       SET padrao = false, updated_at = now()
     WHERE pessoa_id = NEW.pessoa_id AND id <> NEW.id AND padrao;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_endereco_padrao_unico ON erp.erp_pessoa_enderecos;
CREATE TRIGGER trg_endereco_padrao_unico
  BEFORE INSERT OR UPDATE OF padrao ON erp.erp_pessoa_enderecos
  FOR EACH ROW WHEN (NEW.padrao) EXECUTE FUNCTION erp.endereco_padrao_unico();

-- ---------- acesso ----------
ALTER TABLE erp.erp_pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_pessoa_enderecos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_pedido_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_pessoa_enderecos TO authenticated;

DROP POLICY IF EXISTS erp_pedido_itens_operacao ON erp.erp_pedido_itens;
CREATE POLICY erp_pedido_itens_operacao ON erp.erp_pedido_itens
  FOR ALL TO authenticated
  USING ((SELECT erp.current_erp_user_id()) IS NOT NULL)
  WITH CHECK ((SELECT erp.current_erp_user_id()) IS NOT NULL);

DROP POLICY IF EXISTS erp_pessoa_enderecos_operacao ON erp.erp_pessoa_enderecos;
CREATE POLICY erp_pessoa_enderecos_operacao ON erp.erp_pessoa_enderecos
  FOR ALL TO authenticated
  USING ((SELECT erp.current_erp_user_id()) IS NOT NULL)
  WITH CHECK ((SELECT erp.current_erp_user_id()) IS NOT NULL);

SELECT 'itens de pedido: ' || (SELECT count(*) FROM erp.erp_pedido_itens)
    || ' | endereços: ' || (SELECT count(*) FROM erp.erp_pessoa_enderecos) AS resultado;

COMMIT;
