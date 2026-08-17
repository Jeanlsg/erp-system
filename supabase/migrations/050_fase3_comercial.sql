-- ============================================================
-- 050: FASE 3 (parte 2) — Ciclo comercial
--
--   1) Orçamento → Venda: a tabela e a tela existiam desde o início
--      e nunca foram usadas (0 registros). Faltava a conversão, que é
--      o que dá sentido ao orçamento.
--   2) Tabela de preços por cliente e canal: até aqui havia um único
--      preco_venda por produto, sem como praticar preço de atacado,
--      tabela promocional ou preço por cliente.
--
-- GRANT junto da RLS (lição da 045/046).
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '120s';

-- ════════════════════════════════════════════════════════════
-- 1) ORÇAMENTO: campos que faltavam para virar venda
-- ════════════════════════════════════════════════════════════
ALTER TABLE erp.erp_orcamentos
  ADD COLUMN IF NOT EXISTS venda_id   uuid REFERENCES erp.erp_vendas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS usuario_id uuid,
  ADD COLUMN IF NOT EXISTS desconto   numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE erp.erp_orcamento_itens
  ADD COLUMN IF NOT EXISTS produto_id uuid REFERENCES erp.erp_produtos(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_erp_orcamentos_venda ON erp.erp_orcamentos (venda_id) WHERE venda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_orc_itens_produto ON erp.erp_orcamento_itens (produto_id);

-- Um orçamento só pode gerar UMA venda
CREATE UNIQUE INDEX IF NOT EXISTS erp_orcamentos_venda_unica
  ON erp.erp_orcamentos (venda_id) WHERE venda_id IS NOT NULL;

-- Converte orçamento em venda finalizada, baixando estoque pelo kardex.
CREATE OR REPLACE FUNCTION erp.converter_orcamento_em_venda(
  p_orcamento_id    uuid,
  p_forma_pagamento text DEFAULT 'dinheiro',
  p_caixa_id        uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v_orc      RECORD;
  v_venda    uuid;
  v_uid      uuid;
  v_vendedor uuid;
  v_itens    jsonb;
  v_custo    numeric(14,2) := 0;
  v_subtot   numeric(14,2) := 0;
BEGIN
  v_uid := (SELECT erp.current_erp_user_id());
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_orc FROM erp.erp_orcamentos WHERE id = p_orcamento_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado' USING ERRCODE = 'P0001';
  END IF;
  IF v_orc.venda_id IS NOT NULL THEN
    RAISE EXCEPTION 'Orçamento já foi convertido na venda %', v_orc.venda_id USING ERRCODE = 'P0001';
  END IF;
  IF v_orc.validade IS NOT NULL AND v_orc.validade < CURRENT_DATE THEN
    RAISE EXCEPTION 'Orçamento vencido em % — refaça antes de converter', v_orc.validade USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM erp.erp_orcamento_itens WHERE orcamento_id = p_orcamento_id) THEN
    RAISE EXCEPTION 'Orçamento sem itens' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM erp.erp_orcamento_itens WHERE orcamento_id = p_orcamento_id AND produto_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Orçamento tem item sem produto vinculado — não é possível baixar estoque'
      USING ERRCODE = 'P0001';
  END IF;

  -- vendedor_id aponta para erp_funcionarios, não para o usuário do ERP:
  -- resolve pelo vínculo; quem não é funcionário cadastrado fica sem vendedor.
  SELECT f.id INTO v_vendedor FROM erp.erp_funcionarios f WHERE f.usuario_id = v_uid LIMIT 1;

  SELECT COALESCE(sum(i.subtotal), 0),
         COALESCE(sum(i.quantidade * COALESCE(p.preco_custo, 0)), 0)
    INTO v_subtot, v_custo
    FROM erp.erp_orcamento_itens i
    LEFT JOIN erp.erp_produtos p ON p.id = i.produto_id
   WHERE i.orcamento_id = p_orcamento_id;

  INSERT INTO erp.erp_vendas (
    loja_id, cliente_id, usuario_id, vendedor_id, data_venda,
    subtotal, desconto, total, custo_total, lucro_total,
    forma_pagamento, status, tipo_venda, caixa_id, observacoes
  ) VALUES (
    v_orc.loja_id, v_orc.cliente_id, v_uid, v_vendedor, now(),
    v_subtot, COALESCE(v_orc.desconto, 0),
    COALESCE(v_orc.total, v_subtot - COALESCE(v_orc.desconto, 0)),
    v_custo,
    COALESCE(v_orc.total, v_subtot - COALESCE(v_orc.desconto, 0)) - v_custo,
    p_forma_pagamento::erp.erp_forma_pagamento, 'finalizada', 'orcamento',
    p_caixa_id,
    'Convertida do orçamento ' || COALESCE(v_orc.numero::text, p_orcamento_id::text)
  ) RETURNING id INTO v_venda;

  INSERT INTO erp.erp_venda_itens (
    venda_id, produto_id, nome, preco_custo, preco_unitario, quantidade, subtotal, valor_total
  )
  SELECT v_venda, i.produto_id, COALESCE(p.nome, i.descricao),
         COALESCE(p.preco_custo, 0), i.valor_unitario, i.quantidade,
         i.subtotal, i.subtotal
    FROM erp.erp_orcamento_itens i
    LEFT JOIN erp.erp_produtos p ON p.id = i.produto_id
   WHERE i.orcamento_id = p_orcamento_id;

  -- Baixa de estoque pelo caminho oficial: escritura kardex e valida saldo
  SELECT jsonb_agg(jsonb_build_object('produto_id', produto_id, 'quantidade', quantidade::int))
    INTO v_itens
    FROM erp.erp_orcamento_itens WHERE orcamento_id = p_orcamento_id;

  PERFORM erp.baixar_estoque_atomico(v_orc.loja_id, v_itens, 'orcamento', v_venda);

  UPDATE erp.erp_orcamentos
     SET venda_id = v_venda, status = 'convertido', updated_at = now()
   WHERE id = p_orcamento_id;

  RETURN v_venda;
END;
$$;

REVOKE ALL ON FUNCTION erp.converter_orcamento_em_venda(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erp.converter_orcamento_em_venda(uuid, text, uuid) TO authenticated, service_role;

-- ════════════════════════════════════════════════════════════
-- 2) TABELA DE PREÇOS
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS erp.erp_tabelas_preco (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id     uuid REFERENCES erp.erp_lojas(id) ON DELETE CASCADE,
  nome        varchar(80) NOT NULL,
  tipo        text NOT NULL DEFAULT 'varejo' CHECK (tipo IN ('varejo','atacado','promocional','cliente')),
  -- Desconto/acréscimo geral aplicado sobre o preço do produto quando o
  -- item não tem preço próprio nesta tabela. Negativo = desconto.
  ajuste_percentual numeric(6,2) NOT NULL DEFAULT 0,
  vigencia_inicio date,
  vigencia_fim    date,
  prioridade  integer NOT NULL DEFAULT 0,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (vigencia_fim IS NULL OR vigencia_inicio IS NULL OR vigencia_fim >= vigencia_inicio)
);

CREATE TABLE IF NOT EXISTS erp.erp_tabela_preco_itens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela_id   uuid NOT NULL REFERENCES erp.erp_tabelas_preco(id) ON DELETE CASCADE,
  produto_id  uuid NOT NULL REFERENCES erp.erp_produtos(id) ON DELETE CASCADE,
  preco       numeric(14,2) NOT NULL CHECK (preco >= 0),
  quantidade_minima integer NOT NULL DEFAULT 1 CHECK (quantidade_minima >= 1),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tabela_id, produto_id, quantidade_minima)
);

-- Vínculo do cliente com a tabela (preço por cliente)
ALTER TABLE erp.erp_pessoas
  ADD COLUMN IF NOT EXISTS tabela_preco_id uuid REFERENCES erp.erp_tabelas_preco(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_erp_tab_preco_itens_prod ON erp.erp_tabela_preco_itens (produto_id);
CREATE INDEX IF NOT EXISTS idx_erp_tab_preco_loja ON erp.erp_tabelas_preco (loja_id, ativo, prioridade DESC);

ALTER TABLE erp.erp_tabelas_preco      ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_tabela_preco_itens ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['erp_tabelas_preco','erp_tabela_preco_itens'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS erp_user_select ON erp.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS erp_admin_write ON erp.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS erp_admin_update ON erp.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS erp_admin_delete ON erp.%I', t);
    EXECUTE format('CREATE POLICY erp_user_select ON erp.%I FOR SELECT TO authenticated USING ((SELECT erp.current_erp_user_id()) IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY erp_admin_write ON erp.%I FOR INSERT TO authenticated WITH CHECK ((SELECT erp.is_erp_admin()))', t);
    EXECUTE format('CREATE POLICY erp_admin_update ON erp.%I FOR UPDATE TO authenticated USING ((SELECT erp.is_erp_admin())) WITH CHECK ((SELECT erp.is_erp_admin()))', t);
    EXECUTE format('CREATE POLICY erp_admin_delete ON erp.%I FOR DELETE TO authenticated USING ((SELECT erp.is_erp_admin()))', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON erp.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON erp.%I TO service_role', t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_erp_tabelas_preco_updated_at ON erp.erp_tabelas_preco;
CREATE TRIGGER trg_erp_tabelas_preco_updated_at
  BEFORE UPDATE ON erp.erp_tabelas_preco
  FOR EACH ROW EXECUTE FUNCTION erp.erp_set_updated_at();

-- Preço efetivo: item específico > ajuste da tabela > preço do produto.
-- Entre tabelas candidatas, vence a de maior prioridade.
CREATE OR REPLACE FUNCTION erp.preco_efetivo(
  p_produto_id  uuid,
  p_loja_id     uuid DEFAULT NULL,
  p_cliente_id  uuid DEFAULT NULL,
  p_quantidade  integer DEFAULT 1
) RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v_base   numeric(14,2);
  v_tab    RECORD;
  v_item   numeric(14,2);
BEGIN
  SELECT preco_venda INTO v_base FROM erp.erp_produtos WHERE id = p_produto_id;
  IF v_base IS NULL THEN RETURN NULL; END IF;

  SELECT t.* INTO v_tab
    FROM erp.erp_tabelas_preco t
   WHERE t.ativo
     AND (t.loja_id IS NULL OR p_loja_id IS NULL OR t.loja_id = p_loja_id)
     AND (t.vigencia_inicio IS NULL OR t.vigencia_inicio <= CURRENT_DATE)
     AND (t.vigencia_fim    IS NULL OR t.vigencia_fim    >= CURRENT_DATE)
     AND (
       -- tabela do cliente, ou tabela geral (não vinculada a cliente)
       (p_cliente_id IS NOT NULL AND t.id = (SELECT tabela_preco_id FROM erp.erp_pessoas WHERE id = p_cliente_id))
       OR t.tipo <> 'cliente'
     )
   ORDER BY
     (p_cliente_id IS NOT NULL
        AND t.id = (SELECT tabela_preco_id FROM erp.erp_pessoas WHERE id = p_cliente_id)) DESC,
     t.prioridade DESC, t.created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN RETURN v_base; END IF;

  -- Preço específico do produto respeitando a quantidade mínima
  SELECT i.preco INTO v_item
    FROM erp.erp_tabela_preco_itens i
   WHERE i.tabela_id = v_tab.id AND i.produto_id = p_produto_id
     AND i.quantidade_minima <= GREATEST(p_quantidade, 1)
   ORDER BY i.quantidade_minima DESC
   LIMIT 1;

  IF v_item IS NOT NULL THEN RETURN v_item; END IF;

  RETURN round(v_base * (1 + v_tab.ajuste_percentual / 100.0), 2);
END;
$$;

GRANT EXECUTE ON FUNCTION erp.preco_efetivo(uuid, uuid, uuid, integer) TO authenticated, service_role;
