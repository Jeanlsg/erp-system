-- ============================================================
-- 093 — Frente 5: ficha completa do funcionário, metas e comissão em conta
--
-- Três lacunas que o sistema anterior cobria:
--
--   1. A ficha tinha cargo, salário, CPF, RG, PIS e CTPS. Faltava o que a
--      contabilidade pede na admissão (filiação, naturalidade, estado civil,
--      instrução) e os dados bancários, sem os quais não se paga ninguém.
--
--   2. Não havia meta por funcionário. Comissão sem meta é só percentual;
--      com meta, o vendedor sabe onde está no mês.
--
--   3. A comissão apurada morria na tela. Para virar dinheiro alguém
--      redigitava em Contas a Pagar — e redigitação é onde o valor muda.
--
-- Os campos pessoais e bancários ficam na mesma tabela, que desde a 078 só é
-- legível por admin e gerente. Não há tabela separada para "confidencial"
-- porque a linha inteira já é.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Ficha
-- ------------------------------------------------------------
ALTER TABLE erp.erp_funcionarios
  ADD COLUMN IF NOT EXISTS nome_pai text,
  ADD COLUMN IF NOT EXISTS nome_mae text,
  ADD COLUMN IF NOT EXISTS naturalidade text,
  ADD COLUMN IF NOT EXISTS nacionalidade text DEFAULT 'Brasileira',
  ADD COLUMN IF NOT EXISTS estado_civil text,
  ADD COLUMN IF NOT EXISTS grau_instrucao text,
  ADD COLUMN IF NOT EXISTS quantidade_filhos integer,
  -- bancários: sem eles não se paga ninguém
  ADD COLUMN IF NOT EXISTS banco text,
  ADD COLUMN IF NOT EXISTS agencia text,
  ADD COLUMN IF NOT EXISTS conta text,
  ADD COLUMN IF NOT EXISTS tipo_conta_bancaria text,
  ADD COLUMN IF NOT EXISTS chave_pix text,
  -- serviço comissiona diferente de produto: mão de obra não tem custo de
  -- mercadoria, e o percentual do balcão não serve
  ADD COLUMN IF NOT EXISTS comissao_percentual_servico numeric(5,2);

ALTER TABLE erp.erp_funcionarios
  DROP CONSTRAINT IF EXISTS erp_funcionarios_filhos_nao_negativo;
ALTER TABLE erp.erp_funcionarios
  ADD CONSTRAINT erp_funcionarios_filhos_nao_negativo
  CHECK (quantidade_filhos IS NULL OR quantidade_filhos >= 0);

-- ------------------------------------------------------------
-- 2. Metas
--
-- Período explícito em vez de "mês/ano": campanha de quinzena e meta de
-- semana existem, e um campo de mês obrigaria a inventar datas.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS erp.erp_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES erp.erp_lojas(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES erp.erp_funcionarios(id) ON DELETE CASCADE,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  /** 'valor' = faturamento em reais; 'quantidade' = itens vendidos */
  tipo text NOT NULL DEFAULT 'valor',
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT erp_metas_periodo_valido CHECK (periodo_fim >= periodo_inicio),
  CONSTRAINT erp_metas_tipo_valido CHECK (tipo IN ('valor', 'quantidade'))
);

-- Duas metas do mesmo tipo no mesmo período para a mesma pessoa é engano de
-- digitação, e o acompanhamento passaria a contar em dobro.
CREATE UNIQUE INDEX IF NOT EXISTS uq_erp_metas_periodo
  ON erp.erp_metas (funcionario_id, periodo_inicio, periodo_fim, tipo);

ALTER TABLE erp.erp_metas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS erp_metas_gestao ON erp.erp_metas;
CREATE POLICY erp_metas_gestao ON erp.erp_metas
  FOR ALL USING ((SELECT erp.is_erp_admin())) WITH CHECK ((SELECT erp.is_erp_admin()));

GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_metas TO authenticated, service_role;

-- ------------------------------------------------------------
-- 3. Comissão vira conta a pagar
--
-- A coluna de ligação é o que impede lançar a mesma comissão duas vezes —
-- que é o erro que o botão convida a cometer, com o clique repetido ou duas
-- pessoas conferindo o mesmo período.
-- ------------------------------------------------------------
ALTER TABLE erp.erp_comissoes
  ADD COLUMN IF NOT EXISTS conta_id uuid REFERENCES erp.erp_contas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comissoes_conta ON erp.erp_comissoes(conta_id);

CREATE OR REPLACE FUNCTION erp.lancar_comissoes_em_contas(
  p_comissoes uuid[],
  p_vencimento date,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
DECLARE
  v_grupo record;
  v_conta uuid;
  v_criadas jsonb := '[]'::jsonb;
  v_total numeric := 0;
BEGIN
  IF NOT erp.is_erp_admin() THEN
    RAISE EXCEPTION 'Só administrador ou gerente lança comissão em contas a pagar.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_comissoes IS NULL OR array_length(p_comissoes, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos uma comissão.';
  END IF;

  IF p_vencimento IS NULL THEN
    RAISE EXCEPTION 'Informe a data de vencimento da conta.';
  END IF;

  -- Já lançada não entra de novo: a conta existente é a verdade.
  IF EXISTS (SELECT 1 FROM erp.erp_comissoes
             WHERE id = ANY(p_comissoes) AND conta_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Há comissão já lançada em conta a pagar na seleção. Refaça a seleção.';
  END IF;

  IF EXISTS (SELECT 1 FROM erp.erp_comissoes
             WHERE id = ANY(p_comissoes) AND status = 'cancelada') THEN
    RAISE EXCEPTION 'Comissão cancelada não vira conta a pagar.';
  END IF;

  -- Uma conta por funcionário e por loja: quem recebe é a pessoa, e o
  -- financeiro é por loja.
  FOR v_grupo IN
    SELECT c.funcionario_id, c.loja_id, f.pessoa_id,
           sum(c.valor_comissao) AS total, count(*) AS qtd,
           min(c.data_referencia) AS de, max(c.data_referencia) AS ate
    FROM erp.erp_comissoes c
    JOIN erp.erp_funcionarios f ON f.id = c.funcionario_id
    WHERE c.id = ANY(p_comissoes)
    GROUP BY c.funcionario_id, c.loja_id, f.pessoa_id
  LOOP
    INSERT INTO erp.erp_contas
      (loja_id, tipo, pessoa_id, descricao, categoria, valor, data_vencimento,
       status, observacoes)
    VALUES (
      v_grupo.loja_id, 'pagar', v_grupo.pessoa_id,
      'Comissão ' || to_char(v_grupo.de, 'DD/MM/YYYY') || ' a ' || to_char(v_grupo.ate, 'DD/MM/YYYY'),
      'Comissões', v_grupo.total, p_vencimento, 'pendente',
      COALESCE(p_observacoes, v_grupo.qtd || ' comissão(ões) apurada(s)'))
    RETURNING id INTO v_conta;

    UPDATE erp.erp_comissoes
    SET conta_id = v_conta
    WHERE id = ANY(p_comissoes) AND funcionario_id = v_grupo.funcionario_id
      AND loja_id = v_grupo.loja_id;

    v_total := v_total + v_grupo.total;
    v_criadas := v_criadas || jsonb_build_object(
      'conta_id', v_conta, 'funcionario_id', v_grupo.funcionario_id,
      'valor', v_grupo.total, 'comissoes', v_grupo.qtd);
  END LOOP;

  RETURN jsonb_build_object('contas', v_criadas, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION erp.lancar_comissoes_em_contas(uuid[], date, text) FROM public;
GRANT EXECUTE ON FUNCTION erp.lancar_comissoes_em_contas(uuid[], date, text) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 4. Acompanhamento da meta
--
-- Junta meta e realizado no mesmo lugar. O realizado vem das vendas com
-- vendedor no período — não das comissões, que podem estar canceladas.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW erp.vw_meta_funcionario AS
SELECT
  m.id AS meta_id,
  m.loja_id,
  m.funcionario_id,
  m.periodo_inicio,
  m.periodo_fim,
  m.tipo,
  m.valor AS meta,
  CASE WHEN m.tipo = 'valor' THEN r.valor ELSE r.quantidade END AS realizado,
  GREATEST(m.valor - CASE WHEN m.tipo = 'valor' THEN r.valor ELSE r.quantidade END, 0) AS falta,
  CASE WHEN m.valor > 0
       THEN round(((CASE WHEN m.tipo = 'valor' THEN r.valor ELSE r.quantidade END) / m.valor) * 100, 1)
       ELSE 0 END AS percentual
FROM erp.erp_metas m
LEFT JOIN LATERAL (
  -- Somar itens no mesmo JOIN das vendas multiplicaria o faturamento pelo
  -- número de linhas do cupom. A quantidade vem por venda e só depois soma.
  SELECT
    COALESCE(sum(v.total), 0) AS valor,
    COALESCE(sum((SELECT sum(i.quantidade) FROM erp.erp_venda_itens i WHERE i.venda_id = v.id)), 0) AS quantidade
  FROM erp.erp_vendas v
  WHERE v.status = 'finalizada'
    AND v.loja_id = m.loja_id
    -- erp_vendas.vendedor_id aponta para erp_funcionarios, não para o usuário
    AND v.vendedor_id = m.funcionario_id
    AND v.data_venda::date BETWEEN m.periodo_inicio AND m.periodo_fim
) r ON true;

GRANT SELECT ON erp.vw_meta_funcionario TO authenticated, service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
