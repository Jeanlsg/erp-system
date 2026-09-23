-- ============================================================
-- 096 — Cada filial com os próprios clientes
--
-- Relato: "clientes Petrolina e Juazeiro estão se repetindo". Não eram
-- duplicatas — o cadastro de pessoas é um só na empresa (erp_pessoas não tem
-- loja), e a lista de clientes mostrava todos nas duas filiais.
--
-- Por que um vínculo e não uma coluna de loja no cliente: o CPF é único no
-- cadastro, porque é a identidade fiscal da pessoa. Quem compra nas duas
-- lojas continua sendo UM cadastro, ligado às duas filiais; quem só compra
-- em Petrolina só aparece em Petrolina. Duplicar a pessoa por filial
-- quebraria a trava do CPF e espalharia o mesmo cliente em dois registros.
--
-- Como o vínculo nasce:
--   - no cadastro, pela filial em que ele foi feito (loja_cadastro_id);
--   - no movimento: a primeira venda, pedido, orçamento, OS, consignação,
--     locação, cartão fidelidade, avaliação ou conta a receber numa filial
--     liga o cliente a ela. Sem isso, o cliente cadastrado em Petrolina que
--     compra em Juazeiro nunca apareceria na lista de Juazeiro.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS erp.erp_pessoa_lojas (
  pessoa_id uuid NOT NULL REFERENCES erp.erp_pessoas(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES erp.erp_lojas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pessoa_id, loja_id)
);
CREATE INDEX IF NOT EXISTS idx_pessoa_lojas_loja ON erp.erp_pessoa_lojas(loja_id);

ALTER TABLE erp.erp_pessoa_lojas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS erp_pessoa_lojas_select ON erp.erp_pessoa_lojas;
CREATE POLICY erp_pessoa_lojas_select ON erp.erp_pessoa_lojas
  FOR SELECT USING ((SELECT erp.current_erp_user_id()) IS NOT NULL);

-- ligar ou desligar cliente de uma filial: só quem trabalha nela
DROP POLICY IF EXISTS erp_pessoa_lojas_escrita ON erp.erp_pessoa_lojas;
CREATE POLICY erp_pessoa_lojas_escrita ON erp.erp_pessoa_lojas
  FOR ALL
  USING (erp.usuario_tem_loja((SELECT erp.current_erp_user_id()), loja_id))
  WITH CHECK (erp.usuario_tem_loja((SELECT erp.current_erp_user_id()), loja_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_pessoa_lojas TO authenticated, service_role;

-- filial em que a pessoa foi cadastrada
ALTER TABLE erp.erp_pessoas
  ADD COLUMN IF NOT EXISTS loja_cadastro_id uuid REFERENCES erp.erp_lojas(id);

CREATE OR REPLACE FUNCTION erp.fn_vincular_pessoa_cadastro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
DECLARE
  v_loja uuid := NEW.loja_cadastro_id;
  v_usuario uuid := erp.current_erp_user_id();
BEGIN
  -- Sem filial informada e o usuário trabalha numa só: é essa. Cobre algum
  -- caminho de cadastro que não passe a filial.
  IF v_loja IS NULL AND v_usuario IS NOT NULL THEN
    SELECT min(x::text)::uuid INTO v_loja FROM erp.lojas_do_usuario(v_usuario) x
    HAVING count(*) = 1;
  END IF;
  IF v_loja IS NOT NULL THEN
    INSERT INTO erp.erp_pessoa_lojas (pessoa_id, loja_id) VALUES (NEW.id, v_loja)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_pessoa_vincular_cadastro ON erp.erp_pessoas;
CREATE TRIGGER tg_pessoa_vincular_cadastro
  AFTER INSERT ON erp.erp_pessoas
  FOR EACH ROW EXECUTE FUNCTION erp.fn_vincular_pessoa_cadastro();

-- Movimento numa filial liga o cliente a ela. Genérico: TG_ARGV[0] é a
-- coluna da pessoa na tabela.
CREATE OR REPLACE FUNCTION erp.fn_vincular_cliente_movimento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
DECLARE
  j jsonb := to_jsonb(NEW);
  v_pessoa uuid := nullif(j ->> TG_ARGV[0], '')::uuid;
  v_loja uuid := nullif(j ->> 'loja_id', '')::uuid;
BEGIN
  -- conta a pagar é de fornecedor, não liga cliente
  IF TG_TABLE_NAME = 'erp_contas' AND coalesce(j ->> 'tipo', '') <> 'receber' THEN
    RETURN NEW;
  END IF;
  IF v_pessoa IS NOT NULL AND v_loja IS NOT NULL THEN
    INSERT INTO erp.erp_pessoa_lojas (pessoa_id, loja_id) VALUES (v_pessoa, v_loja)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('erp_vendas', 'cliente_id'), ('erp_pedidos', 'cliente_id'),
    ('erp_orcamentos', 'cliente_id'), ('erp_ordens_servico', 'cliente_id'),
    ('erp_consignacoes', 'cliente_id'), ('erp_locacoes', 'cliente_id'),
    ('erp_cartao_fidelidade', 'cliente_id'), ('erp_avaliacoes', 'cliente_id'),
    ('erp_contas', 'pessoa_id')
  ) AS x(tabela, coluna)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tg_vincular_cliente_filial ON erp.%I', t.tabela);
    EXECUTE format(
      'CREATE TRIGGER tg_vincular_cliente_filial AFTER INSERT OR UPDATE OF %I, loja_id ON erp.%I
         FOR EACH ROW EXECUTE FUNCTION erp.fn_vincular_cliente_movimento(%L)',
      t.coluna, t.tabela, t.coluna);
  END LOOP;
END $$;

-- Compras do cliente NESTA filial. Mesma regra da resumo_compras_telefone
-- (soma quem tem o mesmo telefone, porque o balcão às vezes cadastra de
-- novo), restrita à loja.
CREATE OR REPLACE FUNCTION erp.resumo_compras_telefone_loja(p_telefone text, p_loja uuid)
RETURNS TABLE(compras integer, total numeric, primeira date, ultima date)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'erp', 'public'
AS $$
  WITH alvo AS (SELECT erp.chave_telefone(p_telefone) AS k),
  pessoas AS (
    SELECT p.id FROM erp.erp_pessoas p, alvo
     WHERE alvo.k IS NOT NULL
       AND erp.chave_telefone(coalesce(nullif(p.celular, ''), p.telefone)) = alvo.k
  )
  SELECT
    count(*)::integer,
    coalesce(sum(v.total), 0)::numeric,
    min(v.data_venda)::date,
    max(v.data_venda)::date
  FROM erp.erp_vendas v
  WHERE v.cliente_id IN (SELECT id FROM pessoas)
    AND v.loja_id = p_loja
    AND v.status::text = 'finalizada';
$$;

GRANT EXECUTE ON FUNCTION erp.resumo_compras_telefone_loja(text, uuid) TO authenticated, service_role;

CREATE OR REPLACE VIEW erp.vw_clientes_compras_loja AS
SELECT
  pl.loja_id,
  p.id, p.nome_razao, p.cpf_cnpj, p.email, p.telefone, p.celular, p.tipo,
  p.ativo, p.eh_cliente, p.eh_fornecedor,
  erp.chave_telefone(coalesce(nullif(p.celular::text, ''), p.telefone::text)) AS chave_telefone,
  coalesce(r.compras, 0) AS compras,
  coalesce(r.total, 0::numeric) AS total_gasto,
  r.primeira AS primeira_compra,
  r.ultima AS ultima_compra
FROM erp.erp_pessoa_lojas pl
JOIN erp.erp_pessoas p ON p.id = pl.pessoa_id
LEFT JOIN LATERAL erp.resumo_compras_telefone_loja(
  coalesce(nullif(p.celular::text, ''), p.telefone::text), pl.loja_id
) r(compras, total, primeira, ultima) ON true;

GRANT SELECT ON erp.vw_clientes_compras_loja TO authenticated, service_role;

-- ---------------- carga inicial ----------------
-- cada cliente fica nas filiais onde já tem movimento
INSERT INTO erp.erp_pessoa_lojas (pessoa_id, loja_id)
SELECT DISTINCT pessoa, loja FROM (
  SELECT cliente_id AS pessoa, loja_id AS loja FROM erp.erp_vendas
  UNION SELECT cliente_id, loja_id FROM erp.erp_pedidos
  UNION SELECT cliente_id, loja_id FROM erp.erp_orcamentos
  UNION SELECT cliente_id, loja_id FROM erp.erp_ordens_servico
  UNION SELECT cliente_id, loja_id FROM erp.erp_consignacoes
  UNION SELECT cliente_id, loja_id FROM erp.erp_locacoes
  UNION SELECT cliente_id, loja_id FROM erp.erp_cartao_fidelidade
  UNION SELECT cliente_id, loja_id FROM erp.erp_avaliacoes
  UNION SELECT pessoa_id, loja_id FROM erp.erp_contas WHERE tipo = 'receber'
) m
WHERE pessoa IS NOT NULL AND loja IS NOT NULL
  AND EXISTS (SELECT 1 FROM erp.erp_pessoas p WHERE p.id = m.pessoa)
ON CONFLICT DO NOTHING;

-- Cliente sem movimento nenhum não tem como dizer de qual filial é. Fica nas
-- duas, para não sumir da lista; a filial dele se acerta no cadastro.
INSERT INTO erp.erp_pessoa_lojas (pessoa_id, loja_id)
SELECT p.id, l.id FROM erp.erp_pessoas p CROSS JOIN erp.erp_lojas l
WHERE p.eh_cliente
  AND NOT EXISTS (SELECT 1 FROM erp.erp_pessoa_lojas x WHERE x.pessoa_id = p.id)
ON CONFLICT DO NOTHING;

SELECT 'cliente '||p.nome_razao||' -> '||string_agg(l.apelido, ', ' ORDER BY l.apelido)
FROM erp.erp_pessoa_lojas pl JOIN erp.erp_pessoas p ON p.id=pl.pessoa_id JOIN erp.erp_lojas l ON l.id=pl.loja_id
WHERE p.eh_cliente GROUP BY p.nome_razao;

COMMIT;
NOTIFY pgrst, 'reload schema';
