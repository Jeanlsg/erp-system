-- ============================================================
-- 045: FASE 1 — Fundação dos módulos
--
-- Fecha as lacunas estruturais que impediam os módulos de serem
-- confiáveis (ver comparativo de 16/08/2026):
--   1) Kardex de estoque + custo médio móvel (não havia histórico)
--   2) Inventário / balanço
--   3) Trilha de auditoria
--   4) Plano de contas e centro de custo como tabelas mestras
--   5) Contas a receber geradas automaticamente pela venda
--
-- Aplicar SEM --single-transaction? Não é necessário: não há
-- ALTER TYPE aqui. Tudo é idempotente e reaplicável.
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '120s';

-- ════════════════════════════════════════════════════════════
-- 1) KARDEX — livro de movimentação de estoque
-- ════════════════════════════════════════════════════════════
ALTER TABLE erp.erp_estoque
  ADD COLUMN IF NOT EXISTS custo_medio numeric(14,4) NOT NULL DEFAULT 0;

-- Semeia o custo médio com o custo cadastrado no produto
UPDATE erp.erp_estoque e
   SET custo_medio = COALESCE(p.preco_custo, 0)
  FROM erp.erp_produtos p
 WHERE p.id = e.produto_id AND e.custo_medio = 0;

CREATE TABLE IF NOT EXISTS erp.erp_estoque_movimentacoes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id            uuid NOT NULL REFERENCES erp.erp_produtos(id) ON DELETE RESTRICT,
  loja_id               uuid NOT NULL REFERENCES erp.erp_lojas(id) ON DELETE RESTRICT,
  tipo                  text NOT NULL CHECK (tipo IN ('entrada','saida','ajuste','inventario','saldo_inicial')),
  origem                text NOT NULL DEFAULT 'manual',
  documento_id          uuid,
  quantidade            integer NOT NULL,
  saldo_anterior        integer NOT NULL,
  saldo_posterior       integer NOT NULL,
  custo_unitario        numeric(14,4),
  custo_medio_anterior  numeric(14,4),
  custo_medio_posterior numeric(14,4),
  valor_total           numeric(14,2),
  lote_id               uuid,
  usuario_id            uuid,
  observacao            text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erp_estoq_mov_produto_loja
  ON erp.erp_estoque_movimentacoes (produto_id, loja_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_erp_estoq_mov_documento
  ON erp.erp_estoque_movimentacoes (documento_id) WHERE documento_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_estoq_mov_created
  ON erp.erp_estoque_movimentacoes (created_at DESC);

ALTER TABLE erp.erp_estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_user_select ON erp.erp_estoque_movimentacoes;
DROP POLICY IF EXISTS erp_user_insert ON erp.erp_estoque_movimentacoes;
CREATE POLICY erp_user_select ON erp.erp_estoque_movimentacoes
  FOR SELECT TO authenticated USING ((SELECT erp.current_erp_user_id()) IS NOT NULL);
-- Escrita só pelas RPCs (SECURITY DEFINER). O kardex não é editável:
-- correção se faz com movimento de ajuste, nunca alterando o histórico.
CREATE POLICY erp_user_insert ON erp.erp_estoque_movimentacoes
  FOR INSERT TO authenticated WITH CHECK (false);

-- Saldo de abertura: transforma a posição atual no primeiro movimento,
-- para o livro nascer coerente com o saldo que já existe.
INSERT INTO erp.erp_estoque_movimentacoes (
  produto_id, loja_id, tipo, origem, quantidade,
  saldo_anterior, saldo_posterior, custo_unitario,
  custo_medio_anterior, custo_medio_posterior, valor_total, observacao
)
SELECT e.produto_id, e.loja_id, 'saldo_inicial', 'migracao', e.quantidade,
       0, e.quantidade, e.custo_medio, 0, e.custo_medio,
       e.quantidade * e.custo_medio,
       'Saldo de abertura registrado pela migration 045'
  FROM erp.erp_estoque e
 WHERE NOT EXISTS (
   SELECT 1 FROM erp.erp_estoque_movimentacoes m
    WHERE m.produto_id = e.produto_id AND m.loja_id = e.loja_id
 );

-- ── RPCs de estoque, agora escriturando o kardex ──
-- Assinatura antiga (2 args) continua válida via defaults.
DROP FUNCTION IF EXISTS erp.baixar_estoque_atomico(uuid, jsonb);
CREATE FUNCTION erp.baixar_estoque_atomico(
  p_loja_id     uuid,
  p_itens       jsonb,
  p_origem      text DEFAULT 'venda',
  p_documento_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  item RECORD;
  v_saldo integer;
  v_cm numeric(14,4);
BEGIN
  IF (SELECT erp.current_erp_user_id()) IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;

  FOR item IN
    SELECT (e->>'produto_id')::uuid AS pid, (e->>'quantidade')::int AS qtd
      FROM jsonb_array_elements(p_itens) e
  LOOP
    IF item.qtd IS NULL OR item.qtd <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida (%) para o produto %', item.qtd, item.pid USING ERRCODE = 'P0001';
    END IF;

    SELECT quantidade, custo_medio INTO v_saldo, v_cm
      FROM erp.erp_estoque
     WHERE produto_id = item.pid AND loja_id = p_loja_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto % sem posição de estoque na loja %', item.pid, p_loja_id USING ERRCODE = 'P0001';
    END IF;
    IF v_saldo < item.qtd THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto %: saldo %, pedido %', item.pid, v_saldo, item.qtd USING ERRCODE = 'P0001';
    END IF;

    UPDATE erp.erp_estoque
       SET quantidade = v_saldo - item.qtd, updated_at = now()
     WHERE produto_id = item.pid AND loja_id = p_loja_id;

    INSERT INTO erp.erp_estoque_movimentacoes (
      produto_id, loja_id, tipo, origem, documento_id, quantidade,
      saldo_anterior, saldo_posterior, custo_unitario,
      custo_medio_anterior, custo_medio_posterior, valor_total, usuario_id
    ) VALUES (
      item.pid, p_loja_id, 'saida', p_origem, p_documento_id, item.qtd,
      v_saldo, v_saldo - item.qtd, v_cm, v_cm, v_cm,
      item.qtd * v_cm, (SELECT erp.current_erp_user_id())
    );
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS erp.creditar_estoque_atomico(uuid, jsonb);
CREATE FUNCTION erp.creditar_estoque_atomico(
  p_loja_id     uuid,
  p_itens       jsonb,
  p_origem      text DEFAULT 'entrada',
  p_documento_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  item RECORD;
  v_saldo integer;
  v_cm numeric(14,4);
  v_novo_cm numeric(14,4);
BEGIN
  IF (SELECT erp.current_erp_user_id()) IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;

  FOR item IN
    SELECT (e->>'produto_id')::uuid AS pid,
           (e->>'quantidade')::int AS qtd,
           NULLIF(e->>'custo_unitario','')::numeric AS custo
      FROM jsonb_array_elements(p_itens) e
  LOOP
    IF item.qtd IS NULL OR item.qtd <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida (%) para o produto %', item.qtd, item.pid USING ERRCODE = 'P0001';
    END IF;

    SELECT quantidade, custo_medio INTO v_saldo, v_cm
      FROM erp.erp_estoque
     WHERE produto_id = item.pid AND loja_id = p_loja_id
       FOR UPDATE;

    IF NOT FOUND THEN
      v_saldo := 0;
      v_cm := COALESCE(item.custo, (SELECT preco_custo FROM erp.erp_produtos WHERE id = item.pid), 0);
      v_novo_cm := v_cm;
      INSERT INTO erp.erp_estoque (produto_id, loja_id, quantidade, custo_medio, updated_at)
      VALUES (item.pid, p_loja_id, item.qtd, v_novo_cm, now());
    ELSE
      -- Custo médio móvel: só se move quando a entrada traz custo.
      v_novo_cm := CASE
        WHEN item.custo IS NULL THEN v_cm
        WHEN (v_saldo + item.qtd) = 0 THEN v_cm
        ELSE ((v_saldo * v_cm) + (item.qtd * item.custo)) / (v_saldo + item.qtd)
      END;
      UPDATE erp.erp_estoque
         SET quantidade = v_saldo + item.qtd, custo_medio = v_novo_cm, updated_at = now()
       WHERE produto_id = item.pid AND loja_id = p_loja_id;
    END IF;

    INSERT INTO erp.erp_estoque_movimentacoes (
      produto_id, loja_id, tipo, origem, documento_id, quantidade,
      saldo_anterior, saldo_posterior, custo_unitario,
      custo_medio_anterior, custo_medio_posterior, valor_total, usuario_id
    ) VALUES (
      item.pid, p_loja_id, 'entrada', p_origem, p_documento_id, item.qtd,
      v_saldo, v_saldo + item.qtd, COALESCE(item.custo, v_novo_cm), v_cm, v_novo_cm,
      item.qtd * COALESCE(item.custo, v_novo_cm), (SELECT erp.current_erp_user_id())
    );
  END LOOP;
END;
$$;

-- Ajuste manual de saldo (com rastro obrigatório)
CREATE OR REPLACE FUNCTION erp.ajustar_estoque_atomico(
  p_loja_id         uuid,
  p_produto_id      uuid,
  p_nova_quantidade integer,
  p_observacao      text DEFAULT NULL,
  p_tipo            text DEFAULT 'ajuste'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v_saldo integer;
  v_cm numeric(14,4);
BEGIN
  IF (SELECT erp.current_erp_user_id()) IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;
  IF p_nova_quantidade IS NULL OR p_nova_quantidade < 0 THEN
    RAISE EXCEPTION 'Quantidade final inválida (%)', p_nova_quantidade USING ERRCODE = 'P0001';
  END IF;

  SELECT quantidade, custo_medio INTO v_saldo, v_cm
    FROM erp.erp_estoque
   WHERE produto_id = p_produto_id AND loja_id = p_loja_id
     FOR UPDATE;

  IF NOT FOUND THEN
    v_saldo := 0;
    v_cm := COALESCE((SELECT preco_custo FROM erp.erp_produtos WHERE id = p_produto_id), 0);
    INSERT INTO erp.erp_estoque (produto_id, loja_id, quantidade, custo_medio, updated_at)
    VALUES (p_produto_id, p_loja_id, p_nova_quantidade, v_cm, now());
  ELSE
    UPDATE erp.erp_estoque
       SET quantidade = p_nova_quantidade, updated_at = now()
     WHERE produto_id = p_produto_id AND loja_id = p_loja_id;
  END IF;

  IF p_nova_quantidade <> v_saldo THEN
    INSERT INTO erp.erp_estoque_movimentacoes (
      produto_id, loja_id, tipo, origem, quantidade,
      saldo_anterior, saldo_posterior, custo_unitario,
      custo_medio_anterior, custo_medio_posterior, valor_total, usuario_id, observacao
    ) VALUES (
      p_produto_id, p_loja_id, p_tipo, 'manual', abs(p_nova_quantidade - v_saldo),
      v_saldo, p_nova_quantidade, v_cm, v_cm, v_cm,
      abs(p_nova_quantidade - v_saldo) * v_cm, (SELECT erp.current_erp_user_id()), p_observacao
    );
  END IF;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 2) INVENTÁRIO / BALANÇO
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS erp.erp_inventarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id     uuid NOT NULL REFERENCES erp.erp_lojas(id) ON DELETE RESTRICT,
  status      text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','finalizado','cancelado')),
  data_inicio timestamptz NOT NULL DEFAULT now(),
  data_fim    timestamptz,
  usuario_id  uuid,
  observacoes text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp.erp_inventario_itens (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventario_id      uuid NOT NULL REFERENCES erp.erp_inventarios(id) ON DELETE CASCADE,
  produto_id         uuid NOT NULL REFERENCES erp.erp_produtos(id) ON DELETE RESTRICT,
  quantidade_sistema integer NOT NULL DEFAULT 0,
  quantidade_contada integer,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inventario_id, produto_id)
);

CREATE INDEX IF NOT EXISTS idx_erp_inv_itens_inv ON erp.erp_inventario_itens (inventario_id);
CREATE INDEX IF NOT EXISTS idx_erp_inventarios_loja ON erp.erp_inventarios (loja_id, status);

ALTER TABLE erp.erp_inventarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_inventario_itens ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['erp_inventarios','erp_inventario_itens'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS erp_user_select ON erp.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS erp_user_insert ON erp.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS erp_user_update ON erp.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS erp_admin_delete ON erp.%I', t);
    EXECUTE format('CREATE POLICY erp_user_select ON erp.%I FOR SELECT TO authenticated USING ((SELECT erp.current_erp_user_id()) IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY erp_user_insert ON erp.%I FOR INSERT TO authenticated WITH CHECK ((SELECT erp.current_erp_user_id()) IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY erp_user_update ON erp.%I FOR UPDATE TO authenticated USING ((SELECT erp.current_erp_user_id()) IS NOT NULL) WITH CHECK ((SELECT erp.current_erp_user_id()) IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY erp_admin_delete ON erp.%I FOR DELETE TO authenticated USING ((SELECT erp.is_erp_admin()))', t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_erp_inventarios_updated_at ON erp.erp_inventarios;
CREATE TRIGGER trg_erp_inventarios_updated_at
  BEFORE UPDATE ON erp.erp_inventarios
  FOR EACH ROW EXECUTE FUNCTION erp.erp_set_updated_at();

-- Abre um inventário já com a fotografia do saldo do sistema
CREATE OR REPLACE FUNCTION erp.abrir_inventario(p_loja_id uuid, p_observacoes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE v_id uuid;
BEGIN
  IF (SELECT erp.current_erp_user_id()) IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM erp.erp_inventarios WHERE loja_id = p_loja_id AND status = 'aberto') THEN
    RAISE EXCEPTION 'Já existe inventário aberto para esta loja' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO erp.erp_inventarios (loja_id, usuario_id, observacoes)
  VALUES (p_loja_id, (SELECT erp.current_erp_user_id()), p_observacoes)
  RETURNING id INTO v_id;

  INSERT INTO erp.erp_inventario_itens (inventario_id, produto_id, quantidade_sistema)
  SELECT v_id, e.produto_id, e.quantidade
    FROM erp.erp_estoque e
   WHERE e.loja_id = p_loja_id;

  RETURN v_id;
END;
$$;

-- Aplica as contagens: gera movimento de ajuste para cada divergência
CREATE OR REPLACE FUNCTION erp.aplicar_inventario(p_inventario_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v_loja uuid;
  v_status text;
  v_ajustados integer := 0;
  item RECORD;
BEGIN
  IF (SELECT erp.current_erp_user_id()) IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;

  SELECT loja_id, status INTO v_loja, v_status
    FROM erp.erp_inventarios WHERE id = p_inventario_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventário não encontrado' USING ERRCODE = 'P0001';
  END IF;
  IF v_status <> 'aberto' THEN
    RAISE EXCEPTION 'Inventário já está %', v_status USING ERRCODE = 'P0001';
  END IF;

  FOR item IN
    SELECT produto_id, quantidade_contada
      FROM erp.erp_inventario_itens
     WHERE inventario_id = p_inventario_id
       AND quantidade_contada IS NOT NULL
       AND quantidade_contada <> quantidade_sistema
  LOOP
    PERFORM erp.ajustar_estoque_atomico(
      v_loja, item.produto_id, item.quantidade_contada,
      'Inventário ' || p_inventario_id::text, 'inventario'
    );
    v_ajustados := v_ajustados + 1;
  END LOOP;

  UPDATE erp.erp_inventarios
     SET status = 'finalizado', data_fim = now()
   WHERE id = p_inventario_id;

  RETURN jsonb_build_object('inventario_id', p_inventario_id, 'itens_ajustados', v_ajustados);
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 3) AUDITORIA
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS erp.erp_auditoria (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabela       text NOT NULL,
  operacao     text NOT NULL,
  registro_id  text,
  usuario_id   uuid,
  dados_antes  jsonb,
  dados_depois jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_erp_auditoria_tabela ON erp.erp_auditoria (tabela, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_erp_auditoria_registro ON erp.erp_auditoria (registro_id);
CREATE INDEX IF NOT EXISTS idx_erp_auditoria_created ON erp.erp_auditoria (created_at DESC);

ALTER TABLE erp.erp_auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_admin_select ON erp.erp_auditoria;
CREATE POLICY erp_admin_select ON erp.erp_auditoria
  FOR SELECT TO authenticated USING ((SELECT erp.is_erp_admin()));

CREATE OR REPLACE FUNCTION erp.fn_auditoria() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v_antes jsonb;
  v_depois jsonb;
  v_id text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_depois := to_jsonb(NEW); v_id := v_depois->>'id';
  ELSIF TG_OP = 'UPDATE' THEN
    v_antes := to_jsonb(OLD); v_depois := to_jsonb(NEW); v_id := v_depois->>'id';
    IF v_antes = v_depois THEN RETURN NEW; END IF;
  ELSE
    v_antes := to_jsonb(OLD); v_id := v_antes->>'id';
  END IF;

  INSERT INTO erp.erp_auditoria (tabela, operacao, registro_id, usuario_id, dados_antes, dados_depois)
  VALUES (TG_TABLE_NAME, TG_OP, v_id, (SELECT erp.current_erp_user_id()), v_antes, v_depois);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Tabelas sensíveis (estoque fica fora: o kardex já é o histórico dele)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'erp_vendas','erp_produtos','erp_caixa','erp_usuarios','erp_notas_fiscais',
    'erp_contas','erp_remessas','erp_configuracoes_sefaz','erp_certificados_digitais','erp_lojas'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auditoria ON erp.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON erp.%I
         FOR EACH ROW EXECUTE FUNCTION erp.fn_auditoria()', t);
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════
-- 4) PLANO DE CONTAS E CENTRO DE CUSTO
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS erp.erp_plano_contas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo     varchar(20) NOT NULL UNIQUE,
  nome       varchar(120) NOT NULL,
  tipo       text NOT NULL CHECK (tipo IN ('receita','despesa','ativo','passivo')),
  pai_id     uuid REFERENCES erp.erp_plano_contas(id) ON DELETE RESTRICT,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp.erp_centros_custo (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo     varchar(20) NOT NULL UNIQUE,
  nome       varchar(120) NOT NULL,
  loja_id    uuid REFERENCES erp.erp_lojas(id) ON DELETE SET NULL,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE erp.erp_contas
  ADD COLUMN IF NOT EXISTS plano_conta_id  uuid REFERENCES erp.erp_plano_contas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES erp.erp_centros_custo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_erp_contas_plano  ON erp.erp_contas (plano_conta_id);
CREATE INDEX IF NOT EXISTS idx_erp_contas_centro ON erp.erp_contas (centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_erp_contas_venc   ON erp.erp_contas (tipo, status, data_vencimento);

ALTER TABLE erp.erp_plano_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_centros_custo ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['erp_plano_contas','erp_centros_custo'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS erp_user_select ON erp.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS erp_admin_insert ON erp.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS erp_admin_update ON erp.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS erp_admin_delete ON erp.%I', t);
    EXECUTE format('CREATE POLICY erp_user_select ON erp.%I FOR SELECT TO authenticated USING ((SELECT erp.current_erp_user_id()) IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY erp_admin_insert ON erp.%I FOR INSERT TO authenticated WITH CHECK ((SELECT erp.is_erp_admin()))', t);
    EXECUTE format('CREATE POLICY erp_admin_update ON erp.%I FOR UPDATE TO authenticated USING ((SELECT erp.is_erp_admin())) WITH CHECK ((SELECT erp.is_erp_admin()))', t);
    EXECUTE format('CREATE POLICY erp_admin_delete ON erp.%I FOR DELETE TO authenticated USING ((SELECT erp.is_erp_admin()))', t);
  END LOOP;
END $$;

-- Plano de contas mínimo, suficiente para uma DRE de varejo
INSERT INTO erp.erp_plano_contas (codigo, nome, tipo) VALUES
  ('3',       'RECEITAS',                       'receita'),
  ('3.1',     'Receita Operacional',            'receita'),
  ('3.1.01',  'Venda de Mercadorias',           'receita'),
  ('3.1.02',  'Prestação de Serviços',          'receita'),
  ('3.9',     'Outras Receitas',                'receita'),
  ('4',       'DESPESAS',                       'despesa'),
  ('4.1',     'Custo das Mercadorias Vendidas', 'despesa'),
  ('4.1.01',  'CMV',                            'despesa'),
  ('4.2',     'Despesas Operacionais',          'despesa'),
  ('4.2.01',  'Fornecedores',                   'despesa'),
  ('4.2.02',  'Folha e Encargos',               'despesa'),
  ('4.2.03',  'Aluguel e Condomínio',           'despesa'),
  ('4.2.04',  'Energia, Água e Telefonia',      'despesa'),
  ('4.2.05',  'Impostos e Taxas',               'despesa'),
  ('4.2.06',  'Taxas de Cartão',                'despesa'),
  ('4.2.07',  'Frete e Logística',              'despesa'),
  ('4.2.99',  'Outras Despesas',                'despesa')
ON CONFLICT (codigo) DO NOTHING;

UPDATE erp.erp_plano_contas c
   SET pai_id = p.id
  FROM erp.erp_plano_contas p
 WHERE c.pai_id IS NULL
   AND position('.' in c.codigo) > 0
   AND p.codigo = left(c.codigo, length(c.codigo) - position('.' in reverse(c.codigo)));

INSERT INTO erp.erp_centros_custo (codigo, nome, loja_id)
SELECT 'L' || row_number() OVER (ORDER BY l.created_at, l.id), l.nome, l.id
  FROM erp.erp_lojas l
 WHERE NOT EXISTS (SELECT 1 FROM erp.erp_centros_custo c WHERE c.loja_id = l.id)
ON CONFLICT (codigo) DO NOTHING;

DROP TRIGGER IF EXISTS trg_erp_plano_contas_updated_at ON erp.erp_plano_contas;
CREATE TRIGGER trg_erp_plano_contas_updated_at
  BEFORE UPDATE ON erp.erp_plano_contas
  FOR EACH ROW EXECUTE FUNCTION erp.erp_set_updated_at();
DROP TRIGGER IF EXISTS trg_erp_centros_custo_updated_at ON erp.erp_centros_custo;
CREATE TRIGGER trg_erp_centros_custo_updated_at
  BEFORE UPDATE ON erp.erp_centros_custo
  FOR EACH ROW EXECUTE FUNCTION erp.erp_set_updated_at();

-- ════════════════════════════════════════════════════════════
-- 5) CONTAS A RECEBER GERADAS PELA VENDA
--    (o ciclo financeiro passa a fechar sozinho)
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION erp.fn_gerar_conta_receber_venda() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v_avista boolean;
  v_plano uuid;
  v_centro uuid;
BEGIN
  IF NEW.status::text <> 'finalizada' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status::text = 'finalizada' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM erp.erp_contas WHERE venda_id = NEW.id AND tipo = 'receber') THEN
    RETURN NEW;
  END IF;

  v_avista := NEW.forma_pagamento::text IN ('dinheiro','pix','cartao_debito');
  SELECT id INTO v_plano  FROM erp.erp_plano_contas  WHERE codigo = '3.1.01';
  SELECT id INTO v_centro FROM erp.erp_centros_custo WHERE loja_id = NEW.loja_id LIMIT 1;

  INSERT INTO erp.erp_contas (
    loja_id, tipo, pessoa_id, venda_id, descricao, categoria, valor,
    data_vencimento, data_pagamento, valor_pago, forma_pagamento, status,
    plano_conta_id, centro_custo_id, observacoes
  ) VALUES (
    NEW.loja_id, 'receber', NEW.cliente_id, NEW.id,
    'Venda ' || COALESCE(NEW.numero_pedido::text, NEW.id::text),
    'venda', NEW.total,
    COALESCE(NEW.data_venda::date, CURRENT_DATE),
    CASE WHEN v_avista THEN COALESCE(NEW.data_venda::date, CURRENT_DATE) END,
    CASE WHEN v_avista THEN NEW.total END,
    NEW.forma_pagamento,
    (CASE WHEN v_avista THEN 'pago' ELSE 'pendente' END)::erp.erp_conta_status,
    v_plano, v_centro,
    'Lançamento automático da venda'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_erp_venda_conta_receber ON erp.erp_vendas;
CREATE TRIGGER trg_erp_venda_conta_receber
  AFTER INSERT OR UPDATE OF status ON erp.erp_vendas
  FOR EACH ROW EXECUTE FUNCTION erp.fn_gerar_conta_receber_venda();

-- Recupera o histórico: gera as contas das vendas já finalizadas
INSERT INTO erp.erp_contas (
  loja_id, tipo, pessoa_id, venda_id, descricao, categoria, valor,
  data_vencimento, data_pagamento, valor_pago, forma_pagamento, status,
  plano_conta_id, centro_custo_id, observacoes
)
SELECT v.loja_id, 'receber', v.cliente_id, v.id,
       'Venda ' || COALESCE(v.numero_pedido::text, v.id::text), 'venda', v.total,
       COALESCE(v.data_venda::date, CURRENT_DATE),
       CASE WHEN v.forma_pagamento::text IN ('dinheiro','pix','cartao_debito') THEN COALESCE(v.data_venda::date, CURRENT_DATE) END,
       CASE WHEN v.forma_pagamento::text IN ('dinheiro','pix','cartao_debito') THEN v.total END,
       v.forma_pagamento,
       (CASE WHEN v.forma_pagamento::text IN ('dinheiro','pix','cartao_debito') THEN 'pago' ELSE 'pendente' END)::erp.erp_conta_status,
       (SELECT id FROM erp.erp_plano_contas WHERE codigo = '3.1.01'),
       (SELECT id FROM erp.erp_centros_custo WHERE loja_id = v.loja_id LIMIT 1),
       'Lançamento retroativo (migration 045)'
  FROM erp.erp_vendas v
 WHERE v.status::text = 'finalizada'
   AND NOT EXISTS (SELECT 1 FROM erp.erp_contas c WHERE c.venda_id = v.id AND c.tipo = 'receber');

-- ════════════════════════════════════════════════════════════
-- 6) VISÃO DE DRE (base para o BI)
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW erp.vw_dre_mensal
WITH (security_invoker = true) AS
SELECT c.loja_id,
       date_trunc('month', COALESCE(c.data_pagamento, c.data_vencimento))::date AS competencia,
       pc.tipo   AS natureza,
       pc.codigo AS conta_codigo,
       pc.nome   AS conta_nome,
       sum(CASE WHEN c.status::text = 'pago' THEN COALESCE(c.valor_pago, c.valor) ELSE 0 END) AS realizado,
       sum(c.valor) AS previsto
  FROM erp.erp_contas c
  LEFT JOIN erp.erp_plano_contas pc ON pc.id = c.plano_conta_id
 GROUP BY 1,2,3,4,5;

GRANT SELECT ON erp.vw_dre_mensal TO authenticated;

REVOKE ALL ON FUNCTION erp.baixar_estoque_atomico(uuid, jsonb, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION erp.creditar_estoque_atomico(uuid, jsonb, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION erp.ajustar_estoque_atomico(uuid, uuid, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION erp.abrir_inventario(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION erp.aplicar_inventario(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erp.baixar_estoque_atomico(uuid, jsonb, text, uuid)      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION erp.creditar_estoque_atomico(uuid, jsonb, text, uuid)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION erp.ajustar_estoque_atomico(uuid, uuid, integer, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION erp.abrir_inventario(uuid, text)                         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION erp.aplicar_inventario(uuid)                             TO authenticated, service_role;
