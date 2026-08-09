-- =====================================================
-- ERP System · Endurecimento de RLS por usuário
-- Migration: 021_require_erp_usuarios_for_access.sql
--
-- Substitui policies permissivas (USING true) por policies
-- que exigem o user ter registro em erp.erp_usuarios com ativo=true.
--
-- Sem registro em erp_usuarios = sem acesso a NADA do ERP.
-- Com registro ativo = acesso conforme role (admin/gerente/operador).
--
-- Regras:
--   - SELECT: precisa ter erp_usuarios ativo
--   - INSERT/UPDATE/DELETE: precisa ter role admin ou gerente
--   - service_role bypassa tudo (sempre)
-- =====================================================

-- Helper function: retorna o id do erp_usuario logado (ou NULL se nao tiver)
-- IMPORTANTE: erp.erp_usuarios.id == auth.users.id (FK direta)
CREATE OR REPLACE FUNCTION erp.current_erp_user_id()
RETURNS uuid AS $$
  SELECT id FROM erp.erp_usuarios
  WHERE id = auth.uid() AND ativo = true
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: verifica se é admin/gerente
CREATE OR REPLACE FUNCTION erp.is_erp_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM erp.erp_usuarios
    WHERE id = auth.uid()
      AND ativo = true
      AND role IN ('admin', 'gerente')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =====================================================
-- APAGA POLICIES PERMISSIVAS ANTIGAS
-- (eram USING (true) — vazao de dados)
-- =====================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'erp'
      AND policyname NOT LIKE 'service_role%'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- =====================================================
-- NOVAS POLICIES: exigem erp_usuarios ativo
-- =====================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'erp_agenda_compromissos', 'erp_agenda_telefonica', 'erp_avaliacoes',
    'erp_bandeiras_cartao', 'erp_boletos', 'erp_caixa', 'erp_caixa_movimentacoes',
    'erp_cartao_fidelidade', 'erp_cartao_fidelidade_movimentacoes', 'erp_categorias',
    'erp_certificados_digitais', 'erp_chaves_pix', 'erp_cheques', 'erp_comissoes',
    'erp_compra_itens', 'erp_compras', 'erp_configuracoes_sefaz',
    'erp_configuracoes_sistema', 'erp_contas', 'erp_contas_bancarias',
    'erp_crediario_parcela_itens', 'erp_crediario_parcelas',
    'erp_dados_empresariais', 'erp_documentos', 'erp_downloads',
    'erp_email_marketing', 'erp_entradas_extras', 'erp_estoque',
    'erp_funcionarios', 'erp_kit_itens', 'erp_kits', 'erp_lojas',
    'erp_lotes', 'erp_mala_direta', 'erp_negativacoes',
    'erp_notas_fiscais', 'erp_notificacoes', 'erp_ocorrencias',
    'erp_parcelamento_contas', 'erp_parcelamento_parcelas', 'erp_parcelamentos',
    'erp_parcerias', 'erp_pedidos', 'erp_pessoas', 'erp_produtos',
    'erp_promissorias', 'erp_protestos', 'erp_recomendacoes',
    'erp_regioes_entrega', 'erp_sangrias', 'erp_servicos', 'erp_torpedos',
    'erp_transportadoras', 'erp_venda_itens', 'erp_venda_taxas', 'erp_vendas'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- SELECT: usuario ativo no erp
    EXECUTE format(
      'CREATE POLICY "erp_user_select" ON erp.%I FOR SELECT TO authenticated USING (erp.current_erp_user_id() IS NOT NULL)',
      t
    );

    -- INSERT/UPDATE/DELETE: apenas admin/gerente
    EXECUTE format(
      'CREATE POLICY "erp_admin_write" ON erp.%I FOR ALL TO authenticated USING (erp.is_erp_admin()) WITH CHECK (erp.is_erp_admin())',
      t
    );
  END LOOP;

  -- Caso especial: erp_usuarios
  -- Usuario ve a si mesmo; admin/gerente ve todos
  EXECUTE 'CREATE POLICY "erp_self_or_admin_select" ON erp.erp_usuarios FOR SELECT TO authenticated
    USING (id = auth.uid() OR erp.is_erp_admin())';
  EXECUTE 'CREATE POLICY "erp_admin_write_usuarios" ON erp.erp_usuarios FOR ALL TO authenticated
    USING (erp.is_erp_admin()) WITH CHECK (erp.is_erp_admin())';
END $$;

-- service_role sempre tem acesso total (pra migrations, admin scripts, etc)
-- Isso ja vem por default do Supabase, mas garantindo.

-- Mensagem final
DO $$
DECLARE
  total_policies INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_policies FROM pg_policies WHERE schemaname = 'erp';
  RAISE NOTICE 'Migration 021 aplicada. % policies no schema erp', total_policies;
  RAISE NOTICE 'Agora o ERP exige erp_usuarios ativo. Sem registro = sem acesso.';
END $$;