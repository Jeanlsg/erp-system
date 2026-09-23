-- ============================================================
-- 087 — devolução para fornecedor
--
-- Mercadoria que volta para o fornecedor — veio errada, veio com defeito,
-- veio a mais — precisa sair com nota. Hoje não há nada: erp_devolucoes é
-- devolução DE CLIENTE, sobre uma venda.
--
-- Uma devolução nasce de uma ORIGEM: a nota de entrada (quando a compra
-- veio por XML) ou uma compra registrada à mão. A origem é o que dá os
-- números fiscais — e é por isso que ela importa: a legislação manda
-- devolver com os MESMOS valores e impostos da entrada, não recalcular.
-- Por isso não existe aqui tabela de alíquota por estado: o ICMS da
-- devolução é o ICMS que veio na nota de compra.
--
-- O CFOP sai da UF: 5202 quando fornecedor e loja estão no mesmo estado,
-- 6202 quando não. (5201/6201 seriam para produção própria, que a loja
-- não tem.)
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS erp.erp_devolucoes_fornecedor (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id         uuid NOT NULL REFERENCES erp.erp_lojas(id),
  fornecedor_id   uuid NOT NULL REFERENCES erp.erp_pessoas(id),
  -- de onde veio a mercadoria; uma das duas, ou nenhuma (devolução avulsa)
  nfe_entrada_id  uuid REFERENCES erp.erp_nfe_entrada(id) ON DELETE SET NULL,
  compra_id       uuid REFERENCES erp.erp_compras(id) ON DELETE SET NULL,
  numero_nota_origem text,
  chave_nota_origem  text,

  natureza_operacao text NOT NULL DEFAULT 'Devolução de compra',
  motivo          text NOT NULL,
  observacoes     text,

  -- transporte, como pede a NF-e
  modalidade_frete smallint NOT NULL DEFAULT 9
    CHECK (modalidade_frete IN (0,1,2,3,4,9)),
  transportadora_id uuid REFERENCES erp.erp_pessoas(id),
  placa_veiculo   text,
  volumes_qtd     integer,
  volumes_especie text,
  peso_bruto      numeric(14,3),
  peso_liquido    numeric(14,3),
  valor_frete     numeric(14,2) NOT NULL DEFAULT 0,
  valor_seguro    numeric(14,2) NOT NULL DEFAULT 0,
  outras_despesas numeric(14,2) NOT NULL DEFAULT 0,

  valor_produtos  numeric(14,2) NOT NULL DEFAULT 0,
  valor_total     numeric(14,2) NOT NULL DEFAULT 0,

  status          text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','confirmada','faturada','cancelada')),
  nota_fiscal_id  uuid REFERENCES erp.erp_notas_fiscais(id) ON DELETE SET NULL,

  usuario_id      uuid REFERENCES erp.erp_usuarios(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp.erp_devolucao_fornecedor_itens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucao_id    uuid NOT NULL REFERENCES erp.erp_devolucoes_fornecedor(id) ON DELETE CASCADE,
  produto_id      uuid REFERENCES erp.erp_produtos(id) ON DELETE SET NULL,
  nfe_item_id     uuid REFERENCES erp.erp_nfe_entrada_itens(id) ON DELETE SET NULL,

  nome            text NOT NULL,
  codigo_ean      text,
  ncm             text,
  unidade         text NOT NULL DEFAULT 'UN',
  cfop            text NOT NULL,

  quantidade      numeric(14,3) NOT NULL CHECK (quantidade > 0),
  valor_unitario  numeric(14,4) NOT NULL,
  valor_total     numeric(14,2) NOT NULL,
  valor_desconto  numeric(14,2) NOT NULL DEFAULT 0,

  -- os mesmos impostos da entrada: devolução não recalcula tributo
  icms_origem     text,
  icms_csosn      text,
  icms_cst        text,
  icms_aliquota   numeric(7,4) NOT NULL DEFAULT 0,
  icms_valor      numeric(14,2) NOT NULL DEFAULT 0,
  icms_st_valor   numeric(14,2) NOT NULL DEFAULT 0,
  ipi_aliquota    numeric(7,4) NOT NULL DEFAULT 0,
  ipi_valor       numeric(14,2) NOT NULL DEFAULT 0,
  pis_aliquota    numeric(7,4) NOT NULL DEFAULT 0,
  pis_valor       numeric(14,2) NOT NULL DEFAULT 0,
  cofins_aliquota numeric(7,4) NOT NULL DEFAULT 0,
  cofins_valor    numeric(14,2) NOT NULL DEFAULT 0,

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_devol_forn_loja ON erp.erp_devolucoes_fornecedor(loja_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devol_forn_itens ON erp.erp_devolucao_fornecedor_itens(devolucao_id);

COMMENT ON TABLE erp.erp_devolucoes_fornecedor IS
  'Mercadoria devolvida ao fornecedor. Os impostos dos itens vêm da nota de entrada: a legislação manda devolver com os valores da compra.';
COMMENT ON COLUMN erp.erp_devolucoes_fornecedor.status IS
  'rascunho → confirmada (estoque sai) → faturada (nota emitida). Cancelada não devolve o estoque sozinha.';

-- ---------- CFOP pela UF ----------
CREATE OR REPLACE FUNCTION erp.cfop_devolucao_fornecedor(p_loja_id uuid, p_fornecedor_id uuid)
RETURNS text LANGUAGE sql STABLE
SET search_path TO 'erp', 'public' AS $$
  SELECT CASE
    WHEN coalesce(f.uf, '') = '' OR coalesce(d.uf, '') = '' THEN '5202'
    WHEN f.uf = d.uf THEN '5202'   -- dentro do estado
    ELSE '6202'                    -- fora do estado
  END
    FROM erp.erp_pessoas f
    LEFT JOIN erp.erp_dados_empresariais d ON d.loja_id = p_loja_id
   WHERE f.id = p_fornecedor_id;
$$;

COMMENT ON FUNCTION erp.cfop_devolucao_fornecedor(uuid, uuid) IS
  'Devolução de mercadoria adquirida de terceiros: 5202 no mesmo estado, 6202 fora dele.';

-- ---------- confirmar: a mercadoria sai do estoque ----------
CREATE OR REPLACE FUNCTION erp.confirmar_devolucao_fornecedor(p_devolucao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'erp', 'public'
AS $$
DECLARE
  d        erp.erp_devolucoes_fornecedor%ROWTYPE;
  v_itens  jsonb;
  v_qtd    integer;
BEGIN
  IF erp.current_erp_user_id() IS NULL THEN
    RAISE EXCEPTION 'usuário sem perfil no ERP' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO d FROM erp.erp_devolucoes_fornecedor WHERE id = p_devolucao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'devolução não encontrada'; END IF;
  IF d.status <> 'rascunho' THEN
    RAISE EXCEPTION 'esta devolução já foi confirmada (situação: %)', d.status;
  END IF;

  SELECT count(*) INTO v_qtd FROM erp.erp_devolucao_fornecedor_itens WHERE devolucao_id = p_devolucao_id;
  IF v_qtd = 0 THEN RAISE EXCEPTION 'devolução sem itens'; END IF;

  -- a mercadoria sai do estoque pelo Kardex, com origem própria: no
  -- inventário é preciso distinguir o que foi vendido do que voltou ao
  -- fornecedor
  SELECT jsonb_agg(jsonb_build_object(
           'produto_id', i.produto_id,
           'quantidade', i.quantidade::int))
    INTO v_itens
    FROM erp.erp_devolucao_fornecedor_itens i
   WHERE i.devolucao_id = p_devolucao_id AND i.produto_id IS NOT NULL;

  IF v_itens IS NOT NULL THEN
    PERFORM erp.baixar_estoque_movimento(
      d.loja_id, v_itens, 'devolucao_fornecedor', p_devolucao_id, true);
  END IF;

  UPDATE erp.erp_devolucoes_fornecedor
     SET status = 'confirmada', updated_at = now()
   WHERE id = p_devolucao_id;

  RETURN jsonb_build_object('devolucao_id', p_devolucao_id, 'itens', v_qtd);
END;
$$;

-- ---------- acesso ----------
ALTER TABLE erp.erp_devolucoes_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_devolucao_fornecedor_itens ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_devolucoes_fornecedor TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_devolucao_fornecedor_itens TO authenticated;
GRANT EXECUTE ON FUNCTION erp.confirmar_devolucao_fornecedor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION erp.cfop_devolucao_fornecedor(uuid, uuid) TO authenticated;

-- devolver mercadoria é ato de compras: exige quem cuida de compra
DROP POLICY IF EXISTS erp_devol_forn ON erp.erp_devolucoes_fornecedor;
CREATE POLICY erp_devol_forn ON erp.erp_devolucoes_fornecedor
  FOR ALL TO authenticated
  USING ((SELECT erp.is_erp_admin()))
  WITH CHECK ((SELECT erp.is_erp_admin()));

DROP POLICY IF EXISTS erp_devol_forn_itens ON erp.erp_devolucao_fornecedor_itens;
CREATE POLICY erp_devol_forn_itens ON erp.erp_devolucao_fornecedor_itens
  FOR ALL TO authenticated
  USING ((SELECT erp.is_erp_admin()))
  WITH CHECK ((SELECT erp.is_erp_admin()));

SELECT 'devoluções a fornecedor: tabela criada' AS resultado;

COMMIT;
