-- ============================================================
-- 118: Login só do CRM não lê nem chama nada do ERP
--
-- O auth.users é o mesmo do CRM: quem tem login lá recebe um JWT
-- `authenticated` válido aqui. A tela de login do ERP barra quem não tem
-- perfil (signOut) e as edges conferem erp_usuarios, mas a API do banco
-- não passa pela tela. As tabelas estão protegidas (RLS com
-- current_erp_user_id()), e o furo estava em volta delas. Simulado em
-- produção em 26/10/2026 com um JWT sem perfil no ERP:
--
-- 1. 15 views do erp sem security_invoker: o dono é o supabase_admin
--    (superusuário, ignora RLS), então a view entregava tudo — clientes com
--    CPF e telefone, caixas, custo dos produtos, vendedores, saldo de
--    pedidos. A trava não pode ser security_invoker sem mudar o que cada
--    papel do ERP vê hoje (vw_caixa_resumo, vw_meta_funcionario…), então a
--    view ganha um filtro por fora: só devolve linha para quem é do ERP.
-- 2. 25 funções SECURITY DEFINER sem trava, executáveis por qualquer login.
--    As 5 que a tela chama e as 3 que as views chamam ganham a trava; as
--    outras só são usadas pelas edges (service_role), pelo cron ou por
--    dentro de outras funções, e saem do authenticated. usuario_tem_loja fica: as policies a chamam
--    como quem consulta (e ela passa a responder false para quem não é
--    do ERP, via lojas_do_usuario).
-- 3. erp_papel_permissoes tinha SELECT USING (true).
--
-- "É do ERP" = perfil ativo em erp_usuarios, ou nenhum usuário final no
-- JWT (service_role das edges, cron, psql). Usuário desativado também cai
-- fora, como no resto da RLS.
--
-- Atenção ao recriar uma destas views: CREATE OR REPLACE VIEW sem o filtro
-- erp.chamador_do_erp() reabre o vazamento.
-- Volta: docs/ajustes/2026-10-26-volta-migration-118.sql
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- 0. Quem chama é do ERP?
CREATE OR REPLACE FUNCTION erp.chamador_do_erp()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = erp, public
AS $$
  SELECT erp.current_erp_user_id() IS NOT NULL OR auth.uid() IS NULL
$$;
GRANT EXECUTE ON FUNCTION erp.chamador_do_erp() TO authenticated, service_role;

-- 1. Views com direito do dono: filtro por fora, mesmas colunas.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    -- Nome sempre com schema: regclass sai sem "erp." quando o erp está no
    -- search_path, e aí o CREATE OR REPLACE criaria uma view nova no public.
    SELECT format('%I.%I', n.nspname, c.relname) AS v, pg_get_viewdef(c.oid) AS def
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'erp'
      AND c.relkind = 'v'
      AND NOT coalesce(c.reloptions::text[] && ARRAY['security_invoker=true', 'security_invoker=on'], false)
      AND pg_get_viewdef(c.oid) !~ 'chamador_do_erp'
  LOOP
    EXECUTE format('CREATE OR REPLACE VIEW %s AS SELECT * FROM (%s) AS base WHERE erp.chamador_do_erp()',
                   r.v, rtrim(r.def, E'; \n'));
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'erp' AND c.relkind = 'v'
               AND NOT coalesce(c.reloptions::text[] && ARRAY['security_invoker=true', 'security_invoker=on'], false)
               AND pg_get_viewdef(c.oid) !~ 'chamador_do_erp') THEN
    RAISE EXCEPTION '118: ainda há view do erp com direito do dono sem o filtro';
  END IF;
END $$;

-- 2a. As 5 que a tela chama: mesma função, com trava na entrada.
CREATE OR REPLACE FUNCTION erp.baixar_estoque_atomico(p_loja_id uuid, p_itens jsonb, p_origem text DEFAULT 'venda'::text, p_documento_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
BEGIN
  IF NOT erp.chamador_do_erp() THEN
    RAISE EXCEPTION 'Acesso negado: usuário sem perfil ativo no ERP' USING ERRCODE = '42501';
  END IF;
  PERFORM erp.baixar_estoque_movimento(p_loja_id, p_itens, p_origem, p_documento_id, false);
END;
$function$;

CREATE OR REPLACE FUNCTION erp.criptografar_senha_cert(plaintext text)
 RETURNS bytea
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp', 'public', 'extensions'
AS $function$
DECLARE
  v_chave TEXT;
BEGIN
  IF NOT erp.chamador_do_erp() THEN
    RAISE EXCEPTION 'Acesso negado: usuário sem perfil ativo no ERP' USING ERRCODE = '42501';
  END IF;

  SELECT s.valor INTO v_chave
    FROM erp.erp_configuracoes_sistema s
   WHERE s.chave = 'chave_cripto_certificado'
   LIMIT 1;

  IF v_chave IS NULL OR v_chave = '' THEN
    -- Chave padrão: trocar em produção cadastrando
    -- erp_configuracoes_sistema.chave = 'chave_cripto_certificado'
    v_chave := 'xlife-erp-chave-padrao-trocar-em-producao';
  END IF;

  RETURN pgp_sym_encrypt(plaintext, v_chave, 'cipher-algo=aes256');
END;
$function$;

CREATE OR REPLACE FUNCTION erp.curva_abc(p_loja_id uuid DEFAULT NULL::uuid, p_desde date DEFAULT NULL::date, p_ate date DEFAULT NULL::date)
 RETURNS TABLE(produto_id uuid, sku text, produto_nome text, quantidade numeric, receita numeric, custo numeric, margem numeric, margem_pct numeric, participacao numeric, acumulado numeric, classe text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
  WITH base AS (
    SELECT i.produto_id,
           SUM(i.quantidade)::numeric                        AS quantidade,
           SUM(COALESCE(i.valor_total, i.subtotal, 0))::numeric AS receita,
           SUM(COALESCE(i.preco_custo,0) * i.quantidade)::numeric AS custo
      FROM erp.erp_venda_itens i
      JOIN erp.erp_vendas v ON v.id = i.venda_id
     WHERE v.status = 'finalizada'
       AND i.produto_id IS NOT NULL
       AND (p_loja_id IS NULL OR v.loja_id = p_loja_id)
       AND (p_desde   IS NULL OR v.data_venda >= p_desde)
       AND (p_ate     IS NULL OR v.data_venda <  (p_ate + 1))
       AND erp.chamador_do_erp()
     GROUP BY i.produto_id
  ), total AS (
    SELECT NULLIF(SUM(receita), 0) AS receita_total FROM base
  ), ranqueado AS (
    SELECT b.*,
           b.receita / t.receita_total * 100 AS participacao,
           SUM(b.receita) OVER (ORDER BY b.receita DESC, b.produto_id)
             / t.receita_total * 100 AS acumulado
      FROM base b CROSS JOIN total t
     WHERE t.receita_total IS NOT NULL
  )
  SELECT r.produto_id,
         p.sku::text,
         p.nome::text,
         r.quantidade,
         round(r.receita, 2),
         round(r.custo, 2),
         round(r.receita - r.custo, 2),
         CASE WHEN r.receita > 0
              THEN round((r.receita - r.custo) / r.receita * 100, 2) ELSE 0 END,
         round(r.participacao, 2),
         round(r.acumulado, 2),
         CASE WHEN r.acumulado <= 80 THEN 'A'
              WHEN r.acumulado <= 95 THEN 'B'
              ELSE 'C' END
    FROM ranqueado r
    JOIN erp.erp_produtos p ON p.id = r.produto_id
   ORDER BY r.receita DESC;
$function$;

CREATE OR REPLACE FUNCTION erp.lojas_do_usuario(p_usuario uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
  SELECT l.id FROM erp.erp_lojas l
  WHERE erp.chamador_do_erp()
    AND EXISTS (SELECT 1 FROM erp.erp_usuarios u WHERE u.id = p_usuario AND u.admin_principal)
  UNION
  SELECT ul.loja_id FROM erp.erp_usuario_lojas ul
  WHERE erp.chamador_do_erp() AND ul.usuario_id = p_usuario;
$function$;

CREATE OR REPLACE FUNCTION erp.preco_efetivo(p_produto_id uuid, p_loja_id uuid DEFAULT NULL::uuid, p_cliente_id uuid DEFAULT NULL::uuid, p_quantidade integer DEFAULT 1)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
DECLARE
  v_base   numeric(14,2);
  v_tab    RECORD;
  v_item   numeric(14,2);
BEGIN
  IF NOT erp.chamador_do_erp() THEN
    RAISE EXCEPTION 'Acesso negado: usuário sem perfil ativo no ERP' USING ERRCODE = '42501';
  END IF;

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
$function$;

-- 2b. Usadas dentro de views: a permissão de função numa view é checada para
--     quem consulta, então estas continuam com o authenticated e ganham a
--     trava por dentro (quem não é do ERP recebe o resumo zerado).
CREATE OR REPLACE FUNCTION erp.resumo_compras_telefone(p_telefone text)
 RETURNS TABLE(compras integer, total numeric, primeira date, ultima date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
  WITH alvo AS (SELECT erp.chave_telefone(p_telefone) AS k WHERE erp.chamador_do_erp()),
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
    AND v.status::text = 'finalizada';
$function$;

CREATE OR REPLACE FUNCTION erp.resumo_compras_telefone_loja(p_telefone text, p_loja uuid)
 RETURNS TABLE(compras integer, total numeric, primeira date, ultima date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
  WITH alvo AS (SELECT erp.chave_telefone(p_telefone) AS k WHERE erp.chamador_do_erp()),
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
$function$;

CREATE OR REPLACE FUNCTION erp.saldo_devedor_cliente(p_pessoa_id uuid)
 RETURNS TABLE(em_aberto numeric, em_atraso numeric, contratos integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'erp', 'public'
AS $function$
  SELECT
    COALESCE(SUM(i.valor - COALESCE(i.valor_pago, 0))
             FILTER (WHERE i.status <> 'pago'), 0)::numeric,
    COALESCE(SUM(i.valor - COALESCE(i.valor_pago, 0))
             FILTER (WHERE i.status <> 'pago' AND i.data_vencimento < CURRENT_DATE), 0)::numeric,
    COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'ativo')::integer
    FROM erp.erp_crediario_parcelas c
    LEFT JOIN erp.erp_crediario_parcela_itens i ON i.crediario_id = c.id
   WHERE c.pessoa_id = p_pessoa_id
     AND erp.chamador_do_erp();
$function$;

-- 2c. Internas: só edges (service_role), cron e outras funções as chamam.
REVOKE EXECUTE ON FUNCTION
  erp.incrementar_numeracao_nfe(uuid, character varying),
  erp.loja_pode_emitir_nfe(uuid),
  erp.lojas_dfe_pendentes(),
  erp.marcar_contas_vencidas(),
  erp.marcar_parcelas_vencidas(),
  erp.pct_faixa_servico(uuid, numeric),
  erp.pct_faixa_venda(uuid, numeric),
  erp.pode_abrir_ponto_venda(uuid, uuid),
  erp.pode_multiplos_caixas(uuid),
  erp.recalcular_comissao_venda(uuid, boolean),
  erp.situacao_faixa_servico(uuid, date),
  erp.situacao_faixa_venda(uuid, date),
  erp.tem_faixa_servico(uuid),
  erp.tem_faixa_venda(uuid),
  erp.total_produtos_mes(uuid, date),
  erp.total_servicos_mes(uuid, date)
FROM PUBLIC, anon, authenticated;

-- 3. Permissões padrão por papel: só para quem é do ERP.
DROP POLICY IF EXISTS erp_papel_permissoes_select ON erp.erp_papel_permissoes;
CREATE POLICY erp_papel_permissoes_select ON erp.erp_papel_permissoes
  FOR SELECT TO authenticated
  USING ((SELECT erp.current_erp_user_id()) IS NOT NULL);

COMMIT;
