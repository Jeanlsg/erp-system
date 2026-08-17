-- ============================================================
-- 055: FASE 8 — Crediário próprio e cartão fidelidade
--
-- As tabelas dos dois módulos já existiam, vazias, desde o começo: casca
-- copiada do menu da Excellent sem implementação atrás. O que falta não é
-- estrutura, é a regra.
--
-- Escopo desta migration são os dois módulos que NÃO dependem de contrato
-- com terceiros. Negativação, protesto e consulta de crédito exigem bureau
-- (Serasa/SPC/Boa Vista) — custo recorrente e decisão comercial, não
-- técnica. E-mail marketing e SMS exigem provedor. Ficam de fora até haver
-- contrato, porque tela sem integração é pior que tela ausente: parece que
-- funciona.
--
-- Promoções também ficam de fora por REUSO, não por falta: a tabela de
-- preços da fase 3 já tem vigência de início e fim, então promoção é uma
-- tabela de preços com prazo. Criar um módulo paralelo duplicaria a
-- resolução de preço em dois lugares que iriam divergir.
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '120s';

INSERT INTO erp.erp_configuracoes_sistema (chave, valor, descricao)
SELECT * FROM (VALUES
  ('crediario_juros_mensal',   '2.5',  'Juros mensal padrão do crediário próprio, em %'),
  ('crediario_max_parcelas',   '12',   'Máximo de parcelas permitido no crediário'),
  ('fidelidade_pontos_por_real','1',   'Pontos creditados por real gasto'),
  ('fidelidade_valor_ponto',   '0.05', 'Quanto vale 1 ponto em reais no resgate'),
  ('fidelidade_validade_meses','12',   'Meses de validade do cartão'),
  ('fidelidade_nivel_prata',   '1000', 'Pontos acumulados para o nível prata'),
  ('fidelidade_nivel_ouro',    '5000', 'Pontos acumulados para o nível ouro')
) v(chave, valor, descricao)
WHERE NOT EXISTS (SELECT 1 FROM erp.erp_configuracoes_sistema c WHERE c.chave = v.chave);

-- ============================================================
-- CREDIÁRIO PRÓPRIO
-- ============================================================

-- A parcela precisa apontar para a conta a receber que ela virou. Sem esse
-- vínculo, baixar no crediário e baixar no financeiro viram dois números
-- diferentes para a mesma dívida.
ALTER TABLE erp.erp_crediario_parcela_itens
  ADD COLUMN IF NOT EXISTS conta_id uuid REFERENCES erp.erp_contas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crediario_itens_conta
  ON erp.erp_crediario_parcela_itens (conta_id) WHERE conta_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crediario_itens_parcela_key
  ON erp.erp_crediario_parcela_itens (crediario_id, numero_parcela);
-- Um contrato por venda: reabrir crediário da mesma venda é erro de operação.
CREATE UNIQUE INDEX IF NOT EXISTS crediario_venda_key
  ON erp.erp_crediario_parcelas (venda_id) WHERE venda_id IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS erp.erp_crediario_contrato_seq;

-- ── Saldo devedor do cliente ──
-- Base do limite de crédito. Conta o que está em aberto, não o que já foi pago.
CREATE OR REPLACE FUNCTION erp.saldo_devedor_cliente(p_pessoa_id uuid)
RETURNS TABLE (em_aberto numeric, em_atraso numeric, contratos integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = erp, public
AS $$
  SELECT
    COALESCE(SUM(i.valor - COALESCE(i.valor_pago, 0))
             FILTER (WHERE i.status <> 'pago'), 0)::numeric,
    COALESCE(SUM(i.valor - COALESCE(i.valor_pago, 0))
             FILTER (WHERE i.status <> 'pago' AND i.data_vencimento < CURRENT_DATE), 0)::numeric,
    COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'ativo')::integer
    FROM erp.erp_crediario_parcelas c
    LEFT JOIN erp.erp_crediario_parcela_itens i ON i.crediario_id = c.id
   WHERE c.pessoa_id = p_pessoa_id;
$$;

GRANT EXECUTE ON FUNCTION erp.saldo_devedor_cliente(uuid) TO authenticated, service_role;

-- ── Abertura do contrato ──
-- A venda já gerou UMA conta a receber pelo gatilho da fase 1. Aqui ela é
-- cancelada e substituída por N — cancelada, não apagada, para o rastro da
-- venda continuar existindo.
CREATE OR REPLACE FUNCTION erp.abrir_crediario(
  p_venda_id        uuid,
  p_parcelas        integer,
  p_juros_mensal    numeric DEFAULT NULL,
  p_tipo_juros      text    DEFAULT 'composto',   -- 'simples' | 'composto' (Price)
  p_primeira_data   date    DEFAULT NULL,
  p_entrada         numeric DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v_uid       uuid := erp.current_erp_user_id();
  v_venda     RECORD;
  v_pessoa    RECORD;
  v_max       integer;
  v_juros     numeric;
  v_financiado numeric;
  v_parcela   numeric;
  v_total     numeric;
  v_i         numeric;
  v_venc      date;
  v_cred_id   uuid;
  v_contrato  text;
  v_conta     uuid;
  v_saldo     numeric;
  v_plano     uuid;
  v_centro    uuid;
  k           integer;
  v_soma      numeric := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_venda FROM erp.erp_vendas WHERE id = p_venda_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada' USING ERRCODE = 'P0001';
  END IF;
  IF v_venda.status::text <> 'finalizada' THEN
    RAISE EXCEPTION 'Venda com status "%" não gera crediário', v_venda.status USING ERRCODE = 'P0001';
  END IF;
  IF v_venda.cliente_id IS NULL THEN
    RAISE EXCEPTION 'Crediário exige cliente identificado na venda' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM erp.erp_crediario_parcelas WHERE venda_id = p_venda_id) THEN
    RAISE EXCEPTION 'Esta venda já tem contrato de crediário' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_pessoa FROM erp.erp_pessoas WHERE id = v_venda.cliente_id;
  IF COALESCE(v_pessoa.bloqueado, false) THEN
    RAISE EXCEPTION 'Cliente bloqueado para crediário: %',
      COALESCE(v_pessoa.motivo_bloqueio, 'sem motivo registrado') USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(NULLIF(valor,'')::integer, 12) INTO v_max
    FROM erp.erp_configuracoes_sistema WHERE chave = 'crediario_max_parcelas';
  v_max := COALESCE(v_max, 12);
  IF p_parcelas IS NULL OR p_parcelas < 1 OR p_parcelas > v_max THEN
    RAISE EXCEPTION 'Número de parcelas deve estar entre 1 e %', v_max USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(p_entrada, 0) < 0 OR COALESCE(p_entrada, 0) >= v_venda.total THEN
    RAISE EXCEPTION 'Entrada deve ser menor que o total da venda' USING ERRCODE = 'P0001';
  END IF;
  v_financiado := v_venda.total - COALESCE(p_entrada, 0);

  -- Limite de crédito: 0 ou nulo significa sem limite definido, não limite zero.
  IF COALESCE(v_pessoa.limite_credito, 0) > 0 THEN
    SELECT em_aberto INTO v_saldo FROM erp.saldo_devedor_cliente(v_venda.cliente_id);
    IF v_saldo + v_financiado > v_pessoa.limite_credito THEN
      RAISE EXCEPTION 'Limite de crédito excedido: em aberto R$ %, novo R$ %, limite R$ %',
        round(v_saldo,2), round(v_financiado,2), v_pessoa.limite_credito USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT COALESCE(NULLIF(valor,'')::numeric, 2.5) INTO v_juros
    FROM erp.erp_configuracoes_sistema WHERE chave = 'crediario_juros_mensal';
  v_juros := COALESCE(p_juros_mensal, v_juros, 2.5);

  -- Simples: juros linear sobre o financiado. Composto: Price, a parcela fixa
  -- que o comércio usa. Com juros zero as duas caem no mesmo rateio.
  IF v_juros <= 0 THEN
    v_parcela := round(v_financiado / p_parcelas, 2);
  ELSIF p_tipo_juros = 'simples' THEN
    v_parcela := round(v_financiado * (1 + (v_juros / 100) * p_parcelas) / p_parcelas, 2);
  ELSE
    v_i := v_juros / 100;
    v_parcela := round(v_financiado * v_i / (1 - power(1 + v_i, -p_parcelas)), 2);
  END IF;
  v_total := v_parcela * p_parcelas;

  v_contrato := to_char(CURRENT_DATE, 'YYYY') || '-' ||
                lpad(nextval('erp.erp_crediario_contrato_seq')::text, 6, '0');
  v_venc := COALESCE(p_primeira_data, CURRENT_DATE + 30);

  INSERT INTO erp.erp_crediario_parcelas (
    loja_id, pessoa_id, venda_id, numero_contrato, valor_total,
    juros_mensal, tipo_juros, numero_parcelas, data_primeira_parcela,
    dia_vencimento, status, observacoes
  ) VALUES (
    v_venda.loja_id, v_venda.cliente_id, p_venda_id, v_contrato, v_total,
    v_juros, p_tipo_juros, p_parcelas, v_venc,
    EXTRACT(DAY FROM v_venc)::integer, 'ativo',
    CASE WHEN COALESCE(p_entrada,0) > 0
         THEN 'Entrada de R$ ' || round(p_entrada,2) || ' paga no ato' END
  ) RETURNING id INTO v_cred_id;

  -- A conta gerada pelo gatilho da venda vira as parcelas. Cancelar em vez de
  -- apagar mantém o histórico do que foi lançado primeiro.
  UPDATE erp.erp_contas
     SET status = 'cancelado'::erp.erp_conta_status,
         observacoes = COALESCE(observacoes || ' · ', '') ||
                       'Substituída pelo crediário ' || v_contrato,
         updated_at = now()
   WHERE venda_id = p_venda_id AND tipo = 'receber' AND status = 'pendente';

  SELECT id INTO v_plano  FROM erp.erp_plano_contas  WHERE codigo = '3.1.01';
  SELECT id INTO v_centro FROM erp.erp_centros_custo WHERE loja_id = v_venda.loja_id LIMIT 1;

  FOR k IN 1..p_parcelas LOOP
    -- A última parcela absorve o centavo da divisão: sem isso a soma das
    -- parcelas não bate com o total do contrato.
    DECLARE v_valor numeric := CASE WHEN k = p_parcelas THEN v_total - v_soma ELSE v_parcela END;
    BEGIN
      v_soma := v_soma + v_valor;

      INSERT INTO erp.erp_contas (
        loja_id, tipo, pessoa_id, venda_id, descricao, categoria, valor,
        data_vencimento, status, parcela_numero, parcela_total,
        numero_documento, plano_conta_id, centro_custo_id, observacoes
      ) VALUES (
        v_venda.loja_id, 'receber', v_venda.cliente_id, p_venda_id,
        'Crediário ' || v_contrato || ' — parcela ' || k || '/' || p_parcelas,
        'crediario', v_valor,
        (v_venc + ((k - 1) || ' months')::interval)::date,
        'pendente'::erp.erp_conta_status, k, p_parcelas,
        v_contrato, v_plano, v_centro,
        'Gerado pelo contrato de crediário'
      ) RETURNING id INTO v_conta;

      INSERT INTO erp.erp_crediario_parcela_itens (
        crediario_id, numero_parcela, valor, data_vencimento, status, conta_id
      ) VALUES (
        v_cred_id, k, v_valor,
        (v_venc + ((k - 1) || ' months')::interval)::date, 'pendente', v_conta
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'crediario_id',   v_cred_id,
    'contrato',       v_contrato,
    'parcelas',       p_parcelas,
    'valor_parcela',  v_parcela,
    'valor_total',    v_total,
    'juros_mensal',   v_juros,
    'custo_do_credito', round(v_total - v_financiado, 2)
  );
END;
$$;

REVOKE ALL ON FUNCTION erp.abrir_crediario(uuid, integer, numeric, text, date, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erp.abrir_crediario(uuid, integer, numeric, text, date, numeric) TO authenticated, service_role;

-- ── Baixa da parcela ──
-- Baixa nos dois lugares de uma vez. Deixar o operador baixar em um e
-- esquecer o outro é como o crediário e o financeiro passam a divergir.
CREATE OR REPLACE FUNCTION erp.baixar_parcela_crediario(
  p_item_id uuid,
  p_valor   numeric DEFAULT NULL,
  p_data    date    DEFAULT NULL,
  p_forma   text    DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v_item   RECORD;
  v_pagar  numeric;
  v_restam integer;
BEGIN
  IF (SELECT erp.current_erp_user_id()) IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_item FROM erp.erp_crediario_parcela_itens WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada' USING ERRCODE = 'P0001';
  END IF;
  IF v_item.status = 'pago' THEN
    RAISE EXCEPTION 'Parcela já está paga' USING ERRCODE = 'P0001';
  END IF;

  v_pagar := COALESCE(p_valor, v_item.valor);

  UPDATE erp.erp_crediario_parcela_itens
     SET status = 'pago', valor_pago = v_pagar,
         data_pagamento = COALESCE(p_data, CURRENT_DATE)
   WHERE id = p_item_id;

  IF v_item.conta_id IS NOT NULL THEN
    PERFORM erp.baixar_conta(v_item.conta_id, v_pagar, COALESCE(p_data, CURRENT_DATE), p_forma);
  END IF;

  SELECT count(*) INTO v_restam
    FROM erp.erp_crediario_parcela_itens
   WHERE crediario_id = v_item.crediario_id AND status <> 'pago';

  IF v_restam = 0 THEN
    UPDATE erp.erp_crediario_parcelas
       SET status = 'quitado', updated_at = now()
     WHERE id = v_item.crediario_id;
  END IF;

  RETURN jsonb_build_object('pago', v_pagar, 'parcelas_restantes', v_restam,
                            'quitado', v_restam = 0);
END;
$$;

REVOKE ALL ON FUNCTION erp.baixar_parcela_crediario(uuid, numeric, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erp.baixar_parcela_crediario(uuid, numeric, date, text) TO authenticated, service_role;

-- Marca parcelas vencidas junto com as contas, no mesmo cron das 5h.
CREATE OR REPLACE FUNCTION erp.marcar_parcelas_vencidas() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE v_n integer;
BEGIN
  UPDATE erp.erp_crediario_parcela_itens
     SET status = 'vencido'
   WHERE status = 'pendente' AND data_vencimento < CURRENT_DATE;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  UPDATE erp.erp_crediario_parcelas c
     SET status = 'inadimplente', updated_at = now()
   WHERE c.status = 'ativo'
     AND EXISTS (SELECT 1 FROM erp.erp_crediario_parcela_itens i
                  WHERE i.crediario_id = c.id AND i.status = 'vencido');
  RETURN v_n;
END;
$$;

GRANT EXECUTE ON FUNCTION erp.marcar_parcelas_vencidas() TO authenticated, service_role;

SELECT cron.schedule('erp_marcar_parcelas_vencidas', '10 5 * * *',
  $cron$ SELECT erp.marcar_parcelas_vencidas(); $cron$)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'erp_marcar_parcelas_vencidas');

CREATE OR REPLACE VIEW erp.vw_crediario_clientes AS
SELECT p.id AS pessoa_id, p.nome_razao, p.cpf_cnpj, p.telefone,
       p.limite_credito, COALESCE(p.bloqueado, false) AS bloqueado,
       s.em_aberto, s.em_atraso, s.contratos,
       CASE WHEN COALESCE(p.limite_credito, 0) > 0
            THEN GREATEST(p.limite_credito - s.em_aberto, 0) END AS limite_disponivel,
       (SELECT min(i.data_vencimento)
          FROM erp.erp_crediario_parcelas c
          JOIN erp.erp_crediario_parcela_itens i ON i.crediario_id = c.id
         WHERE c.pessoa_id = p.id AND i.status <> 'pago') AS proximo_vencimento
  FROM erp.erp_pessoas p
  CROSS JOIN LATERAL erp.saldo_devedor_cliente(p.id) s
 WHERE s.contratos > 0 OR s.em_aberto > 0;

GRANT SELECT ON erp.vw_crediario_clientes TO authenticated, service_role;

-- ============================================================
-- CARTÃO FIDELIDADE
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS erp.erp_cartao_fidelidade_seq;

CREATE UNIQUE INDEX IF NOT EXISTS erp_cartao_fidelidade_cliente_key
  ON erp.erp_cartao_fidelidade (cliente_id) WHERE ativo;

CREATE OR REPLACE FUNCTION erp.emitir_cartao_fidelidade(
  p_cliente_id uuid,
  p_loja_id    uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v_id      uuid;
  v_numero  text;
  v_meses   integer;
BEGIN
  IF (SELECT erp.current_erp_user_id()) IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM erp.erp_pessoas WHERE id = p_cliente_id) THEN
    RAISE EXCEPTION 'Cliente não encontrado' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, numero_cartao INTO v_id, v_numero
    FROM erp.erp_cartao_fidelidade WHERE cliente_id = p_cliente_id AND ativo;
  IF FOUND THEN
    RETURN jsonb_build_object('cartao_id', v_id, 'numero', v_numero, 'ja_existia', true);
  END IF;

  SELECT COALESCE(NULLIF(valor,'')::integer, 12) INTO v_meses
    FROM erp.erp_configuracoes_sistema WHERE chave = 'fidelidade_validade_meses';

  v_numero := lpad(nextval('erp.erp_cartao_fidelidade_seq')::text, 10, '0');

  INSERT INTO erp.erp_cartao_fidelidade (
    loja_id, cliente_id, numero_cartao, data_emissao, data_validade,
    saldo_pontos, total_pontos_acumulados, nivel, ativo
  ) VALUES (
    p_loja_id, p_cliente_id, v_numero, CURRENT_DATE,
    CURRENT_DATE + (COALESCE(v_meses,12) || ' months')::interval,
    0, 0, 'bronze', true
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('cartao_id', v_id, 'numero', v_numero, 'ja_existia', false);
END;
$$;

REVOKE ALL ON FUNCTION erp.emitir_cartao_fidelidade(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erp.emitir_cartao_fidelidade(uuid, uuid) TO authenticated, service_role;

-- ── Acúmulo automático na venda ──
-- Ponto é um passivo: só pode nascer de venda finalizada, e uma vez por venda.
CREATE OR REPLACE FUNCTION erp.fn_acumular_pontos_venda() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v_cartao   RECORD;
  v_por_real numeric;
  v_pontos   integer;
  v_prata    integer;
  v_ouro     integer;
  v_total    integer;
BEGIN
  IF NEW.status::text <> 'finalizada' OR NEW.cliente_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status::text = 'finalizada' THEN RETURN NEW; END IF;

  SELECT * INTO v_cartao FROM erp.erp_cartao_fidelidade
   WHERE cliente_id = NEW.cliente_id AND ativo;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF v_cartao.data_validade IS NOT NULL AND v_cartao.data_validade < CURRENT_DATE THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM erp.erp_cartao_fidelidade_movimentacoes
              WHERE venda_id = NEW.id AND tipo = 'acumulo') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(valor,'')::numeric, 1) INTO v_por_real
    FROM erp.erp_configuracoes_sistema WHERE chave = 'fidelidade_pontos_por_real';
  v_pontos := floor(NEW.total * COALESCE(v_por_real, 1))::integer;
  IF v_pontos <= 0 THEN RETURN NEW; END IF;

  INSERT INTO erp.erp_cartao_fidelidade_movimentacoes (
    cartao_id, venda_id, tipo, pontos, motivo, data_movimentacao
  ) VALUES (
    v_cartao.id, NEW.id, 'acumulo', v_pontos,
    'Venda ' || COALESCE(NEW.numero_pedido::text, NEW.id::text), now()
  );

  v_total := COALESCE(v_cartao.total_pontos_acumulados, 0) + v_pontos;

  SELECT COALESCE(NULLIF(valor,'')::integer, 1000) INTO v_prata
    FROM erp.erp_configuracoes_sistema WHERE chave = 'fidelidade_nivel_prata';
  SELECT COALESCE(NULLIF(valor,'')::integer, 5000) INTO v_ouro
    FROM erp.erp_configuracoes_sistema WHERE chave = 'fidelidade_nivel_ouro';

  UPDATE erp.erp_cartao_fidelidade
     SET saldo_pontos = COALESCE(saldo_pontos, 0) + v_pontos,
         total_pontos_acumulados = v_total,
         -- Nível sai do ACUMULADO, não do saldo: resgatar não rebaixa o cliente.
         nivel = CASE WHEN v_total >= COALESCE(v_ouro, 5000) THEN 'ouro'
                      WHEN v_total >= COALESCE(v_prata, 1000) THEN 'prata'
                      ELSE 'bronze' END
   WHERE id = v_cartao.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_acumular_pontos_venda ON erp.erp_vendas;
CREATE TRIGGER trg_acumular_pontos_venda
  AFTER INSERT OR UPDATE OF status ON erp.erp_vendas
  FOR EACH ROW EXECUTE FUNCTION erp.fn_acumular_pontos_venda();

-- ── Resgate ──
CREATE OR REPLACE FUNCTION erp.resgatar_pontos(
  p_cartao_id uuid,
  p_pontos    integer,
  p_venda_id  uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v_cartao RECORD;
  v_valor_ponto numeric;
  v_desconto numeric;
BEGIN
  IF (SELECT erp.current_erp_user_id()) IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;
  IF p_pontos IS NULL OR p_pontos <= 0 THEN
    RAISE EXCEPTION 'Informe uma quantidade de pontos maior que zero' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_cartao FROM erp.erp_cartao_fidelidade WHERE id = p_cartao_id FOR UPDATE;
  IF NOT FOUND OR NOT v_cartao.ativo THEN
    RAISE EXCEPTION 'Cartão não encontrado ou inativo' USING ERRCODE = 'P0001';
  END IF;
  IF v_cartao.data_validade IS NOT NULL AND v_cartao.data_validade < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cartão vencido em %', v_cartao.data_validade USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(v_cartao.saldo_pontos, 0) < p_pontos THEN
    RAISE EXCEPTION 'Saldo insuficiente: % ponto(s) disponíveis', COALESCE(v_cartao.saldo_pontos,0)
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(NULLIF(valor,'')::numeric, 0.05) INTO v_valor_ponto
    FROM erp.erp_configuracoes_sistema WHERE chave = 'fidelidade_valor_ponto';
  v_desconto := round(p_pontos * COALESCE(v_valor_ponto, 0.05), 2);

  INSERT INTO erp.erp_cartao_fidelidade_movimentacoes (
    cartao_id, venda_id, tipo, pontos, motivo, data_movimentacao
  ) VALUES (
    p_cartao_id, p_venda_id, 'resgate', -p_pontos,
    'Resgate de R$ ' || v_desconto, now()
  );

  UPDATE erp.erp_cartao_fidelidade
     SET saldo_pontos = saldo_pontos - p_pontos
   WHERE id = p_cartao_id;

  RETURN jsonb_build_object('pontos', p_pontos, 'desconto', v_desconto,
                            'saldo_restante', v_cartao.saldo_pontos - p_pontos);
END;
$$;

REVOKE ALL ON FUNCTION erp.resgatar_pontos(uuid, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erp.resgatar_pontos(uuid, integer, uuid) TO authenticated, service_role;

-- ── RLS e grants das tabelas que estavam dormentes ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'erp_crediario_parcelas','erp_crediario_parcela_itens',
    'erp_cartao_fidelidade','erp_cartao_fidelidade_movimentacoes'
  ] LOOP
    EXECUTE format('ALTER TABLE erp.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS erp_user_select ON erp.%I', t);
    EXECUTE format(
      'CREATE POLICY erp_user_select ON erp.%I FOR SELECT TO authenticated '
      'USING ((SELECT erp.current_erp_user_id()) IS NOT NULL)', t);
    -- Escrita só pelas funções acima: alterar parcela ou saldo de pontos
    -- direto pela tabela contornaria o vínculo com a conta a receber.
    EXECUTE format('GRANT SELECT ON erp.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON erp.%I TO service_role', t);
  END LOOP;
END $$;
