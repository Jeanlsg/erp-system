-- ============================================================
-- 098 — entrega na finalização da venda do PDV
--
-- O sistema anterior da loja perguntava "Precisa de entrega?" ao fechar a
-- venda: transportadora, região (que define a taxa), frete e endereço, e o
-- frete entrava no total a pagar. Aqui a venda do PDV passou a fazer o
-- mesmo, numa transação só:
--
-- * registrar_venda_pdv aceita `entrega` no payload: grava a taxa em
--   erp_vendas.taxa_entrega (já incluída em `total`), cria o pedido no
--   Ciclo de pedidos em Separação com os itens da venda, e guarda o
--   endereço no cadastro do cliente quando pedido. Venda sem `entrega`
--   segue exatamente como antes (corpo = migration 088).
-- * erp_pedidos ganha entrega_futura e a região escolhida;
--   erp_pessoa_enderecos ganha o código IBGE do município, sem o qual a
--   NFC-e não pode sair como entrega a domicílio.
-- * Pontos de fidelidade deixam de contar a taxa de entrega (frete não é
--   compra). A comissão já era calculada pelos itens.
-- * Venda cancelada ou devolvida cancela o pedido de entrega que ainda não
--   foi entregue — senão o entregador sairia com a sacola de uma venda
--   desfeita.
-- * vw_caixa_resumo ganha `taxas_entrega` (informativo no fechamento; o
--   dinheiro da taxa recebido em espécie já está nas vendas em dinheiro).
-- ============================================================

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE erp.erp_pessoa_enderecos
  ADD COLUMN IF NOT EXISTS codigo_municipio_ibge varchar(7);

ALTER TABLE erp.erp_pedidos
  ADD COLUMN IF NOT EXISTS entrega_futura boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regiao_entrega_id uuid REFERENCES erp.erp_regioes_entrega(id) ON DELETE SET NULL;

COMMENT ON COLUMN erp.erp_pedidos.entrega_futura IS
  'Cliente pagou agora e recebe depois (data em previsao_entrega).';

CREATE OR REPLACE FUNCTION erp.registrar_venda_pdv(p_venda jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
DECLARE
  v_uid        uuid := erp.current_erp_user_id();
  v_uuid_local uuid := NULLIF(p_venda->>'uuid_local','')::uuid;
  v_loja       uuid := (p_venda->>'loja_id')::uuid;
  v_offline    boolean := COALESCE((p_venda->>'origem_offline')::boolean, false);
  v_itens      jsonb := COALESCE(p_venda->'itens', '[]'::jsonb);
  -- formas com que a venda foi paga; vazio = forma única, como antes
  v_pagamentos jsonb := COALESCE(p_venda->'pagamentos', '[]'::jsonb);
  pg           jsonb;
  v_soma_pag   numeric := 0;
  v_venda_id   uuid;
  v_numero     integer;
  v_existente  RECORD;
  it           jsonb;
  v_kit        RECORD;
  v_custo_kit  numeric;
  v_baixa      jsonb := '[]'::jsonb;
  -- entrega (098): presente quando o operador marcou "Precisa de entrega?"
  v_entrega    jsonb := CASE WHEN jsonb_typeof(p_venda->'entrega') = 'object' THEN p_venda->'entrega' END;
  v_end        jsonb;
  v_cliente    uuid := NULLIF(p_venda->>'cliente_id','')::uuid;
  v_taxa       numeric := 0;
  v_pedido_id  uuid;
  v_end_id     uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;
  IF v_loja IS NULL THEN
    RAISE EXCEPTION 'loja_id é obrigatório' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_array_length(v_itens) = 0 THEN
    RAISE EXCEPTION 'Venda sem itens' USING ERRCODE = 'P0001';
  END IF;

  -- Entrega é conferida ANTES de gravar qualquer coisa: venda que sai com
  -- entrega sem endereço vira pedido que o entregador não acha.
  IF v_entrega IS NOT NULL THEN
    v_end  := COALESCE(v_entrega->'endereco', '{}'::jsonb);
    v_taxa := COALESCE(NULLIF(v_entrega->>'taxa','')::numeric, 0);
    IF v_cliente IS NULL THEN
      RAISE EXCEPTION 'Venda com entrega precisa de cliente (nome e telefone para o entregador)' USING ERRCODE = 'P0001';
    END IF;
    IF NULLIF(trim(COALESCE(v_end->>'logradouro','')), '') IS NULL
       OR NULLIF(trim(COALESCE(v_end->>'numero','')), '') IS NULL THEN
      RAISE EXCEPTION 'Endereço de entrega precisa de rua e número' USING ERRCODE = 'P0001';
    END IF;
    IF v_taxa < 0 THEN
      RAISE EXCEPTION 'Taxa de entrega não pode ser negativa' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- CPF na nota: se veio documento do consumidor, ele precisa ser válido —
  -- CPF errado é rejeição da SEFAZ na hora do cupom.
  IF NULLIF(regexp_replace(COALESCE(p_venda->>'consumidor_cpf',''), '\D', '', 'g'), '') IS NOT NULL
     AND NOT erp.documento_valido(p_venda->>'consumidor_cpf') THEN
    RAISE EXCEPTION 'CPF/CNPJ do consumidor inválido — confira os dígitos' USING ERRCODE = 'P0001';
  END IF;

  IF v_uuid_local IS NOT NULL THEN
    SELECT id, numero_pedido INTO v_existente
      FROM erp.erp_vendas WHERE uuid_local = v_uuid_local;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'venda_id', v_existente.id,
        'numero',   v_existente.numero_pedido,
        'duplicada', true
      );
    END IF;
  END IF;

  INSERT INTO erp.erp_vendas (
    loja_id, cliente_id, usuario_id, caixa_id,
    subtotal, desconto, desconto_percentual, acrescimo,
    troco, valor_recebido, total, custo_total, lucro_total,
    forma_pagamento, status, tipo_venda, observacoes, vendedor_id,
    uuid_local, origem_offline, criada_em_local, sincronizada_em,
    consumidor_cpf, consumidor_nome, taxa_entrega
  ) VALUES (
    v_loja,
    NULLIF(p_venda->>'cliente_id','')::uuid,
    v_uid,
    NULLIF(p_venda->>'caixa_id','')::uuid,
    COALESCE((p_venda->>'subtotal')::numeric, 0),
    COALESCE((p_venda->>'desconto')::numeric, 0),
    COALESCE((p_venda->>'desconto_percentual')::numeric, 0),
    COALESCE((p_venda->>'acrescimo')::numeric, 0),
    COALESCE((p_venda->>'troco')::numeric, 0),
    COALESCE((p_venda->>'valor_recebido')::numeric, 0),
    COALESCE((p_venda->>'total')::numeric, 0),
    COALESCE((p_venda->>'custo_total')::numeric, 0),
    COALESCE((p_venda->>'lucro_total')::numeric, 0),
    COALESCE(NULLIF(p_venda->>'forma_pagamento',''), 'dinheiro')::erp.erp_forma_pagamento,
    COALESCE(NULLIF(p_venda->>'status',''), 'finalizada')::erp.erp_venda_status,
    COALESCE(NULLIF(p_venda->>'tipo_venda',''), 'pdv'),
    NULLIF(p_venda->>'observacoes',''),
    -- vendedor informado no PDV; sem ele, o funcionário ligado ao usuário logado
    COALESCE(NULLIF(p_venda->>'vendedor_id','')::uuid,
             (SELECT f.id FROM erp.erp_funcionarios f WHERE f.usuario_id = v_uid LIMIT 1)),
    v_uuid_local, v_offline,
    COALESCE(NULLIF(p_venda->>'criada_em_local','')::timestamptz, now()),
    now(),
    NULLIF(regexp_replace(COALESCE(p_venda->>'consumidor_cpf',''), '\D', '', 'g'), ''),
    NULLIF(trim(COALESCE(p_venda->>'consumidor_nome','')), ''),
    -- já incluída em `total`: é o que o cliente paga além da mercadoria
    v_taxa
  )
  RETURNING id, numero_pedido INTO v_venda_id, v_numero;

  FOR it IN SELECT * FROM jsonb_array_elements(v_itens)
  LOOP
    IF NULLIF(it->>'kit_id','') IS NOT NULL THEN
      -- ── KIT: o item da venda guarda o kit; o estoque desconta os
      --    componentes, cada um com seu próprio movimento no kardex ──
      SELECT k.id, k.nome, k.preco_kit INTO v_kit
        FROM erp.erp_kits k WHERE k.id = (it->>'kit_id')::uuid AND k.ativo;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Kit % não encontrado ou inativo', it->>'kit_id' USING ERRCODE = 'P0001';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM erp.erp_kit_itens WHERE kit_id = v_kit.id) THEN
        RAISE EXCEPTION 'Kit "%" não tem componentes cadastrados', v_kit.nome USING ERRCODE = 'P0001';
      END IF;

      -- custo real do kit = soma do custo médio dos componentes
      SELECT COALESCE(SUM(ki.quantidade * COALESCE(e.custo_medio, p.preco_custo, 0)), 0)
        INTO v_custo_kit
        FROM erp.erp_kit_itens ki
        JOIN erp.erp_produtos p ON p.id = ki.produto_id
        LEFT JOIN erp.erp_estoque e ON e.produto_id = ki.produto_id AND e.loja_id = v_loja
       WHERE ki.kit_id = v_kit.id;

      INSERT INTO erp.erp_venda_itens (
        venda_id, kit_id, nome, preco_unitario, preco_custo, quantidade, subtotal,
        desconto_unitario, valor_total
      ) VALUES (
        v_venda_id, v_kit.id,
        COALESCE(NULLIF(it->>'nome',''), v_kit.nome),
        COALESCE((it->>'preco_unitario')::numeric, v_kit.preco_kit, 0),
        v_custo_kit,
        COALESCE((it->>'quantidade')::integer, 1),
        COALESCE((it->>'subtotal')::numeric, 0),
        -- a coluna é POR UNIDADE; o balcão informa o desconto da linha
        COALESCE((it->>'desconto')::numeric, 0)
          / GREATEST(COALESCE((it->>'quantidade')::integer, 1), 1),
        COALESCE((it->>'subtotal')::numeric, 0)
      );

      -- componentes entram na lista de baixa multiplicados pela qtd do kit
      SELECT v_baixa || COALESCE(jsonb_agg(jsonb_build_object(
               'produto_id', ki.produto_id,
               'quantidade', ki.quantidade * COALESCE((it->>'quantidade')::integer, 1))), '[]'::jsonb)
        INTO v_baixa
        FROM erp.erp_kit_itens ki WHERE ki.kit_id = v_kit.id;
    ELSE
      INSERT INTO erp.erp_venda_itens (
        venda_id, produto_id, nome, preco_unitario, preco_custo, quantidade, subtotal,
        desconto_unitario, valor_total
      ) VALUES (
        v_venda_id,
        NULLIF(it->>'produto_id','')::uuid,
        it->>'nome',
        COALESCE((it->>'preco_unitario')::numeric, 0),
        COALESCE((it->>'preco_custo')::numeric, 0),
        COALESCE((it->>'quantidade')::integer, 1),
        COALESCE((it->>'subtotal')::numeric, 0),
        COALESCE((it->>'desconto')::numeric, 0)
          / GREATEST(COALESCE((it->>'quantidade')::integer, 1), 1),
        COALESCE((it->>'subtotal')::numeric, 0)
      );
      IF NULLIF(it->>'produto_id','') IS NOT NULL THEN
        v_baixa := v_baixa || jsonb_build_object(
          'produto_id', it->>'produto_id', 'quantidade', it->>'quantidade');
      END IF;
    END IF;
  END LOOP;

  -- Um componente pode aparecer em dois kits da mesma venda: consolida
  -- antes de baixar para o kardex ter um movimento por produto.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('produto_id', pid, 'quantidade', qtd)), '[]'::jsonb)
    INTO v_baixa
    FROM (
      SELECT (b->>'produto_id') AS pid, SUM((b->>'quantidade')::int) AS qtd
        FROM jsonb_array_elements(v_baixa) b GROUP BY 1
    ) s;

  IF jsonb_array_length(v_baixa) > 0 THEN
    PERFORM erp.baixar_estoque_movimento(v_loja, v_baixa, 'venda', v_venda_id, v_offline);
  END IF;

  -- ---------- formas de pagamento ----------
  -- A venda mista vive em erp_venda_pagamentos; erp_vendas.forma_pagamento
  -- fica com a de maior valor, porque relatório antigo e histórico contam
  -- com ela. A soma é conferida aqui: pagamento que não fecha o total é
  -- dinheiro que ninguém sabe se entrou.
  IF jsonb_array_length(v_pagamentos) > 0 THEN
    SELECT sum((e->>'valor')::numeric) INTO v_soma_pag
      FROM jsonb_array_elements(v_pagamentos) e;

    IF v_soma_pag < (COALESCE((p_venda->>'total')::numeric, 0) - 0.005) THEN
      RAISE EXCEPTION 'Pagamentos somam % e a venda é de %: falta %',
        v_soma_pag, (p_venda->>'total')::numeric,
        (p_venda->>'total')::numeric - v_soma_pag
        USING ERRCODE = 'P0001';
    END IF;

    FOR pg IN SELECT * FROM jsonb_array_elements(v_pagamentos)
    LOOP
      INSERT INTO erp.erp_venda_pagamentos (
        venda_id, forma, valor, valor_recebido, troco, bandeira, parcelas, autorizacao
      ) VALUES (
        v_venda_id,
        (pg->>'forma')::erp.erp_forma_pagamento,
        (pg->>'valor')::numeric,
        NULLIF(pg->>'valor_recebido','')::numeric,
        COALESCE(NULLIF(pg->>'troco','')::numeric, 0),
        NULLIF(pg->>'bandeira',''),
        COALESCE(NULLIF(pg->>'parcelas','')::integer, 1),
        NULLIF(pg->>'autorizacao','')
      );
    END LOOP;

    -- a forma "principal" passa a ser a de maior valor
    UPDATE erp.erp_vendas SET forma_pagamento = (
      SELECT p.forma FROM erp.erp_venda_pagamentos p
       WHERE p.venda_id = v_venda_id ORDER BY p.valor DESC LIMIT 1
    ) WHERE id = v_venda_id;
  END IF;

  -- ---------- entrega ----------
  -- A venda com entrega vira pedido no Ciclo de pedidos, já em Separação:
  -- foi paga no caixa, então não passa pela coluna Pagamento. Os itens da
  -- venda são a lista de quem monta a sacola.
  IF v_entrega IS NOT NULL THEN
    INSERT INTO erp.erp_pedidos (
      venda_id, loja_id, cliente_id, endereco_entrega, previsao_entrega,
      transportadora_id, taxa_entrega, status, tipo_pedido, forma_pagamento,
      observacoes_entrega, entrega_futura, regiao_entrega_id
    ) VALUES (
      v_venda_id, v_loja, v_cliente, v_end,
      NULLIF(v_entrega->>'previsao_entrega','')::timestamptz,
      NULLIF(v_entrega->>'transportadora_id','')::uuid,
      v_taxa, 'em_preparo', 'pdv',
      (SELECT forma_pagamento FROM erp.erp_vendas WHERE id = v_venda_id),
      NULLIF(trim(COALESCE(v_end->>'referencia','')), ''),
      COALESCE((v_entrega->>'entrega_futura')::boolean, false),
      NULLIF(v_entrega->>'regiao_id','')::uuid
    ) RETURNING id INTO v_pedido_id;

    INSERT INTO erp.erp_pedido_itens (pedido_id, produto_id, nome, quantidade, preco_unitario, subtotal)
    SELECT v_pedido_id, i.produto_id, i.nome, i.quantidade, i.preco_unitario, i.subtotal
      FROM erp.erp_venda_itens i WHERE i.venda_id = v_venda_id;

    -- Guarda o endereço no cadastro para a próxima entrega. Com id de um
    -- endereço DESTE cliente, atualiza; senão cria — id de outro cliente
    -- nunca é regravado (o caso do pedido que mudava o cadastro alheio).
    IF COALESCE((v_entrega->>'salvar_endereco')::boolean, false) THEN
      v_end_id := NULLIF(v_entrega->>'endereco_id','')::uuid;
      IF v_end_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM erp.erp_pessoa_enderecos WHERE id = v_end_id AND pessoa_id = v_cliente
      ) THEN
        UPDATE erp.erp_pessoa_enderecos SET
          cep = NULLIF(v_end->>'cep',''), logradouro = v_end->>'logradouro', numero = v_end->>'numero',
          complemento = NULLIF(v_end->>'complemento',''), bairro = NULLIF(v_end->>'bairro',''),
          cidade = NULLIF(v_end->>'cidade',''), uf = NULLIF(v_end->>'uf',''),
          referencia = NULLIF(v_end->>'referencia',''),
          codigo_municipio_ibge = NULLIF(v_end->>'codigo_municipio',''),
          updated_at = now()
        WHERE id = v_end_id;
      ELSE
        INSERT INTO erp.erp_pessoa_enderecos (
          pessoa_id, apelido, cep, logradouro, numero, complemento, bairro, cidade, uf,
          referencia, codigo_municipio_ibge, padrao
        ) VALUES (
          v_cliente, 'Entrega', NULLIF(v_end->>'cep',''), v_end->>'logradouro', v_end->>'numero',
          NULLIF(v_end->>'complemento',''), NULLIF(v_end->>'bairro',''), NULLIF(v_end->>'cidade',''),
          NULLIF(v_end->>'uf',''), NULLIF(v_end->>'referencia',''), NULLIF(v_end->>'codigo_municipio',''),
          NOT EXISTS (SELECT 1 FROM erp.erp_pessoa_enderecos WHERE pessoa_id = v_cliente)
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('venda_id', v_venda_id, 'numero', v_numero, 'duplicada', false,
                            'pedido_id', v_pedido_id);
END;

$function$;

-- ---------- fidelidade: frete não gera ponto ----------
CREATE OR REPLACE FUNCTION erp.fn_acumular_pontos_venda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
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
  -- a taxa de entrega está dentro do total, mas não é compra (098)
  v_pontos := floor(GREATEST(NEW.total - COALESCE(NEW.taxa_entrega, 0), 0) * COALESCE(v_por_real, 1))::integer;
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
$function$;

-- ---------- venda desfeita cancela a entrega pendente ----------
CREATE OR REPLACE FUNCTION erp.fn_cancelar_pedido_da_venda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
BEGIN
  IF NEW.status::text IN ('cancelada', 'devolvida')
     AND OLD.status::text IS DISTINCT FROM NEW.status::text THEN
    UPDATE erp.erp_pedidos
       SET status = 'cancelado',
           observacoes = concat_ws(' · ', NULLIF(observacoes, ''), 'Venda ' || NEW.status::text)
     WHERE venda_id = NEW.id AND status NOT IN ('entregue', 'cancelado');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cancelar_pedido_da_venda ON erp.erp_vendas;
CREATE TRIGGER trg_cancelar_pedido_da_venda
  AFTER UPDATE OF status ON erp.erp_vendas
  FOR EACH ROW EXECUTE FUNCTION erp.fn_cancelar_pedido_da_venda();

-- ---------- resumo do caixa: taxas de entrega do turno ----------
-- Mesmas colunas, na mesma ordem (CREATE OR REPLACE só aceita acrescentar no
-- fim), mais `taxas_entrega`.
CREATE OR REPLACE VIEW erp.vw_caixa_resumo AS
 SELECT c.id,
    c.loja_id,
    c.usuario_id,
    c.data_abertura,
    c.data_fechamento,
    c.valor_inicial,
    c.valor_final,
    c.total_vendas,
    c.total_sangrias,
    c.total_entradas_extras,
    c.observacoes,
    c.status,
    c.numero_caixa,
    c.valor_troco,
    c.encerrado_por,
    c.updated_at,
    c.ponto_venda_id,
    COALESCE(v.vendas, (0)::numeric) AS total_vendas_real,
    COALESCE(v.troco, (0)::numeric) AS valor_troco_real,
    COALESCE(s.sangrias, (0)::numeric) AS total_sangrias_real,
    COALESCE(e.entradas, (0)::numeric) AS total_entradas_extras_real,
    COALESCE(v.dinheiro, (0)::numeric) AS vendas_dinheiro,
    COALESCE(v.pix, (0)::numeric) AS vendas_pix,
    COALESCE(v.credito, (0)::numeric) AS vendas_cartao_credito,
    COALESCE(v.debito, (0)::numeric) AS vendas_cartao_debito,
    COALESCE(v.outras, (0)::numeric) AS vendas_outras,
    COALESCE(s.sangrias_dinheiro, (0)::numeric) AS sangrias_dinheiro,
    COALESCE(e.entradas_dinheiro, (0)::numeric) AS entradas_dinheiro,
    (((c.valor_inicial + COALESCE(v.dinheiro, (0)::numeric)) - COALESCE(s.sangrias_dinheiro, (0)::numeric)) + COALESCE(e.entradas_dinheiro, (0)::numeric)) AS valor_esperado_gaveta,
    COALESCE(v.taxas_entrega, (0)::numeric) AS taxas_entrega
   FROM (((erp.erp_caixa c
     LEFT JOIN LATERAL ( SELECT sum(x.total) AS vendas,
            sum(x.troco) AS troco,
            sum(erp.venda_valor_na_forma(x.*, 'dinheiro'::erp.erp_forma_pagamento)) AS dinheiro,
            sum(erp.venda_valor_na_forma(x.*, 'pix'::erp.erp_forma_pagamento)) AS pix,
            sum(erp.venda_valor_na_forma(x.*, 'cartao_credito'::erp.erp_forma_pagamento)) AS credito,
            sum(erp.venda_valor_na_forma(x.*, 'cartao_debito'::erp.erp_forma_pagamento)) AS debito,
            sum(((((x.total - erp.venda_valor_na_forma(x.*, 'dinheiro'::erp.erp_forma_pagamento)) - erp.venda_valor_na_forma(x.*, 'pix'::erp.erp_forma_pagamento)) - erp.venda_valor_na_forma(x.*, 'cartao_credito'::erp.erp_forma_pagamento)) - erp.venda_valor_na_forma(x.*, 'cartao_debito'::erp.erp_forma_pagamento))) AS outras,
            sum(COALESCE(x.taxa_entrega, 0)) AS taxas_entrega
           FROM erp.erp_vendas x
          WHERE ((x.caixa_id = c.id) AND ((x.status)::text = 'finalizada'::text))) v ON (true))
     LEFT JOIN LATERAL ( SELECT sum(x.valor) AS sangrias,
            sum(x.valor) FILTER (WHERE (x.forma_pagamento = 'dinheiro'::erp.erp_forma_pagamento)) AS sangrias_dinheiro
           FROM erp.erp_sangrias x
          WHERE (x.caixa_id = c.id)) s ON (true))
     LEFT JOIN LATERAL ( SELECT sum(x.valor) AS entradas,
            sum(x.valor) FILTER (WHERE (x.forma_pagamento = 'dinheiro'::erp.erp_forma_pagamento)) AS entradas_dinheiro
           FROM erp.erp_entradas_extras x
          WHERE (x.caixa_id = c.id)) e ON (true));

NOTIFY pgrst, 'reload schema';

COMMIT;
