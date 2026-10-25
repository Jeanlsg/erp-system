-- ============================================================
-- 113 — vendedor vende no caixa aberto por ele ou por quem está acima
--
-- Pedido da loja (outubro/2026): o vendedor (função criada na 111) "vê
-- somente o PDV aberto por ele ou por alguém acima dele; o usuário master
-- decide". O master escolhe, por vendedor, quais caixas (pontos de venda)
-- ele usa — erp_usuario_pontos_venda (092), lista vazia = todos. Nesses
-- caixas, na filial dele, o vendedor vende no turno ABERTO por ele mesmo ou
-- por alguém de função acima (operador de caixa, estoquista, gerente,
-- master). As outras funções seguem como antes: só o próprio caixa.
--
-- O que impedia, e o buraco que isso abriria:
--
--   (a) A tela não tem como saber quem está acima: a RLS de erp_usuarios só
--       deixa cada um ler a própria linha, e o vendedor não lê o papel de
--       quem abriu. A regra mora aqui (pode_operar_caixa, SECURITY DEFINER)
--       e a lista para a tela vem de caixas_operaveis.
--
--   (b) registrar_venda_pdv gravava o caixa_id do payload SEM conferir nada:
--       caixa fechado, de outra filial ou de outra pessoa. Era teórico
--       enquanto a tela só oferecia o próprio caixa; com o vendedor vendendo
--       no caixa alheio, uma venda mal endereçada cai na gaveta de quem não
--       autorizou. Agora o caixa tem de existir, ser da filial da venda, e
--       quem vende tem de poder operá-lo.
--
-- Venda da fila offline: o caixa pode ter fechado enquanto a venda esperava
-- a internet, e a fila sobe com a sessão de quem entrar depois no aparelho
-- (não necessariamente quem vendeu). A mercadoria já saiu; recusar a venda
-- por isso apagaria o registro de um fato. Para ela a trava é: o caixa
-- existe, é da filial da venda, e quem envia trabalha nessa filial (ou
-- abriu o caixa). "Aberto" e "liberado para quem vende" só valem online.
--
-- O papel é comparado como TEXTO (role::text = 'vendedor'): o valor do enum
-- nasce na 111 e só pode ser usado depois do COMMIT dela; assim esta
-- migration compila em qualquer ordem. Ordem de publicação, mesmo assim:
-- 111 → 112 → 113 → front.
--
-- registrar_venda_pdv abaixo = corpo da 098 (última versão), com a trava do
-- caixa acrescentada logo depois da checagem de idempotência — reenviar uma
-- venda já gravada continua devolvendo a mesma venda, mesmo com o caixa
-- fechado depois. Assinatura e retorno iguais.
-- ============================================================

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ------------------------------------------------------------
-- A regra, com o usuário e a exigência de caixa aberto explícitos.
-- Interna: a API só enxerga pode_operar_caixa(p_caixa), que usa a sessão.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION erp.usuario_opera_caixa(p_usuario uuid, p_caixa uuid, p_exigir_aberto boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = erp, public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM erp.erp_caixa c
      JOIN erp.erp_usuarios eu ON eu.id = p_usuario AND eu.ativo
     WHERE c.id = p_caixa
       AND (NOT p_exigir_aberto OR (c.status = 'aberto' AND c.data_fechamento IS NULL))
       AND (
         -- quem abriu opera o próprio caixa (toda função, como sempre foi)
         c.usuario_id = p_usuario
         OR (
           -- vendedor (papel PRINCIPAL, o mesmo que a RLS olha)...
           eu.role::text = 'vendedor'
           -- ...na filial em que trabalha (095)...
           AND erp.usuario_tem_loja(p_usuario, c.loja_id)
           -- ...num caixa que o master liberou para ele (092; sem lista = todos)...
           AND erp.pode_abrir_ponto_venda(p_usuario, c.ponto_venda_id)
           -- ...aberto por alguém acima dele: qualquer função que não seja
           -- vendedor, ou o dono. Vendedor no caixa de outro vendedor, não.
           AND EXISTS (
             SELECT 1 FROM erp.erp_usuarios dono
              WHERE dono.id = c.usuario_id
                AND dono.ativo
                AND (dono.admin_principal OR dono.role::text <> 'vendedor')
           )
         )
       )
  );
$$;

COMMENT ON FUNCTION erp.usuario_opera_caixa(uuid, uuid, boolean) IS
  'Quem pode vender no caixa: quem abriu, ou o vendedor no turno de alguém acima dele, na filial dele e num caixa liberado para ele (113). Interna.';

REVOKE ALL ON FUNCTION erp.usuario_opera_caixa(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION erp.usuario_opera_caixa(uuid, uuid, boolean) TO service_role;

-- ------------------------------------------------------------
-- Quem está logado pode vender neste caixa AGORA (turno aberto)?
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION erp.pode_operar_caixa(p_caixa uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = erp, public
AS $$
  SELECT erp.usuario_opera_caixa(erp.current_erp_user_id(), p_caixa, true);
$$;

COMMENT ON FUNCTION erp.pode_operar_caixa(uuid) IS
  'O usuário logado pode vender neste caixa aberto? Quem abriu, ou o vendedor no turno de alguém acima (113).';

REVOKE ALL ON FUNCTION erp.pode_operar_caixa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION erp.pode_operar_caixa(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- Turnos abertos desta filial que quem está logado pode operar, com o
-- resumo que o PDV usa (vw_caixa_resumo: esperado na gaveta, vendas por
-- forma…) e o nome de quem abriu, que o vendedor não consegue ler sozinho.
--
-- Devolve um array JSON (um objeto por caixa, o mais recente primeiro):
-- todas as colunas de vw_caixa_resumo + operador_nome + ponto_nome. Array em
-- vez de RETURNS TABLE para a view poder ganhar coluna sem quebrar isto.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION erp.caixas_operaveis(p_loja uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = erp, public
AS $$
  SELECT COALESCE(
           jsonb_agg(
             to_jsonb(r) || jsonb_build_object('operador_nome', u.nome, 'ponto_nome', pv.nome)
             ORDER BY r.data_abertura DESC),
           '[]'::jsonb)
    FROM erp.vw_caixa_resumo r
    LEFT JOIN erp.erp_usuarios u ON u.id = r.usuario_id
    LEFT JOIN erp.erp_pontos_venda pv ON pv.id = r.ponto_venda_id
   WHERE erp.current_erp_user_id() IS NOT NULL
     AND r.loja_id = p_loja
     AND r.status = 'aberto'
     AND r.data_fechamento IS NULL
     AND erp.pode_operar_caixa(r.id);
$$;

COMMENT ON FUNCTION erp.caixas_operaveis(uuid) IS
  'Caixas abertos da filial que o usuário logado pode operar (os dele e, para o vendedor, os de quem está acima), com o resumo de vw_caixa_resumo e o nome de quem abriu (113).';

REVOKE ALL ON FUNCTION erp.caixas_operaveis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION erp.caixas_operaveis(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- registrar_venda_pdv: corpo da 098 + trava do caixa (113)
-- ------------------------------------------------------------
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
  -- caixa da venda (113): conferido antes de gravar
  v_caixa      uuid;
  v_cx         RECORD;
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

  -- ---------- caixa da venda (113) ----------
  -- Até a 098 o caixa_id do payload era gravado sem conferência. Com o
  -- vendedor vendendo no turno de quem está acima, a venda entra na gaveta de
  -- outra pessoa — e só pode entrar se essa pessoa liberou (pode_operar_caixa).
  -- Vem DEPOIS da idempotência: reenviar uma venda já gravada devolve a mesma
  -- venda, mesmo que o caixa tenha fechado depois.
  v_caixa := NULLIF(p_venda->>'caixa_id','')::uuid;
  -- Venda online sem caixa não entra em gaveta nenhuma: o turno fechado com
  -- o pagamento aberto mandava caixa_id vazio e a venda passava ao largo da
  -- trava (revisão de 25/10/2026). A fila offline segue aceita como antes.
  IF v_caixa IS NULL AND NOT v_offline THEN
    RAISE EXCEPTION 'Venda sem caixa: abra (ou escolha) um caixa e confirme a venda de novo.'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_caixa IS NOT NULL THEN
    SELECT c.loja_id, c.usuario_id, c.status, c.data_fechamento INTO v_cx
      FROM erp.erp_caixa c WHERE c.id = v_caixa;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'O caixa desta venda não existe. Abra um caixa e confirme a venda de novo.'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_cx.loja_id IS DISTINCT FROM v_loja THEN
      RAISE EXCEPTION 'O caixa desta venda é de outra filial: a venda e o caixa precisam ser da mesma loja.'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_offline THEN
      -- Fila offline: o caixa pode ter fechado enquanto a venda esperava a
      -- internet, e a fila sobe com a sessão de quem entrar depois. A
      -- mercadoria já saiu — recusar apagaria o registro de um fato. Basta
      -- que quem envia trabalhe nesta filial (ou tenha aberto o caixa).
      IF v_cx.usuario_id IS DISTINCT FROM v_uid
         AND NOT erp.usuario_tem_loja(v_uid, v_loja) THEN
        RAISE EXCEPTION 'Esta venda feita sem internet é de uma filial em que o seu usuário não trabalha. Entre com um usuário dessa filial para enviá-la.'
          USING ERRCODE = '42501';
      END IF;
    ELSE
      IF v_cx.status IS DISTINCT FROM 'aberto' OR v_cx.data_fechamento IS NOT NULL THEN
        RAISE EXCEPTION 'Este caixa já foi fechado. Abra um caixa (ou escolha outro aberto) e confirme a venda de novo.'
          USING ERRCODE = 'P0001';
      END IF;
      IF v_cx.usuario_id IS DISTINCT FROM v_uid AND NOT erp.pode_operar_caixa(v_caixa) THEN
        RAISE EXCEPTION 'Você não pode vender neste caixa: ele foi aberto por outra pessoa e não está liberado para o seu usuário. Fale com o usuário master.'
          USING ERRCODE = '42501';
      END IF;
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

NOTIFY pgrst, 'reload schema';

COMMIT;
