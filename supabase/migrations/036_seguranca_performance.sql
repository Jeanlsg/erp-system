-- ============================================================================
-- 036 · SEGURANÇA + PERFORMANCE (auditoria 11/08/2026 — PLANO_FUNCIONAL.md)
--
-- 1) Remove políticas USING (true) que davam acesso a qualquer authenticated
--    (o Auth é compartilhado com o CRM Overdrive!)
-- 2) Revoga grants do papel anon no schema erp
-- 3) Reescreve TODAS as políticas com initplan: (SELECT fn()) → 1 chamada por
--    query em vez de 1 por linha
-- 4) Divide erp_admin_write (FOR ALL) em INSERT/UPDATE/DELETE — SELECT deixa
--    de avaliar duas políticas
-- 5) Índices de FK nas tabelas transacionais
-- 6) Triggers de updated_at onde faltam
-- 7) Timeouts por role + ANALYZE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) POLÍTICAS INSEGURAS (USING true)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Usuários autenticados podem ler NFe entrada"             ON erp.erp_nfe_entrada;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir NFe entrada"         ON erp.erp_nfe_entrada;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar NFe entrada"       ON erp.erp_nfe_entrada;
DROP POLICY IF EXISTS "Usuários autenticados podem ler itens NFe entrada"       ON erp.erp_nfe_entrada_itens;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir itens NFe entrada"   ON erp.erp_nfe_entrada_itens;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar itens NFe entrada" ON erp.erp_nfe_entrada_itens;
DROP POLICY IF EXISTS "Usuários autenticados podem ler remessas"                ON erp.erp_remessas;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir remessas"            ON erp.erp_remessas;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar remessas"          ON erp.erp_remessas;
DROP POLICY IF EXISTS "Usuários autenticados podem ler itens remessa"           ON erp.erp_remessa_itens;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir itens remessa"       ON erp.erp_remessa_itens;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar itens remessa"     ON erp.erp_remessa_itens;

-- ----------------------------------------------------------------------------
-- 2) ANON: fora do schema erp (a chave pública fica exposta no browser)
-- ----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES    IN SCHEMA erp FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA erp FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA erp REVOKE ALL ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA erp REVOKE ALL ON SEQUENCES FROM anon;

-- ----------------------------------------------------------------------------
-- 4) erp_admin_write (FOR ALL) → 3 políticas só de escrita
--    (feito ANTES do initplan; as novas já nascem com (SELECT ...))
-- ----------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_policies
    WHERE schemaname = 'erp' AND policyname = 'erp_admin_write' AND cmd = 'ALL'
  LOOP
    EXECUTE format('DROP POLICY erp_admin_write ON erp.%I', r.tablename);
    EXECUTE format(
      'CREATE POLICY erp_admin_insert ON erp.%I FOR INSERT TO authenticated WITH CHECK ((SELECT erp.is_erp_admin()))',
      r.tablename);
    EXECUTE format(
      'CREATE POLICY erp_admin_update ON erp.%I FOR UPDATE TO authenticated USING ((SELECT erp.is_erp_admin()))',
      r.tablename);
    EXECUTE format(
      'CREATE POLICY erp_admin_delete ON erp.%I FOR DELETE TO authenticated USING ((SELECT erp.is_erp_admin()))',
      r.tablename);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 3) INITPLAN em todas as políticas restantes
--    is_erp_admin() → (SELECT erp.is_erp_admin()) etc.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION erp._mig036_fix_expr(expr text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $fix$
BEGIN
  IF expr IS NULL OR expr LIKE '%SELECT%' THEN
    RETURN expr; -- já tem initplan (ou nada a fazer)
  END IF;
  -- placeholders para evitar substituição dentro do resultado
  expr := replace(expr, 'is_erp_admin_safe()',    '@@SAFE@@');
  expr := replace(expr, 'is_erp_admin()',         '@@ADMIN@@');
  expr := replace(expr, 'current_erp_user_id()',  '@@UID@@');
  expr := replace(expr, 'auth.uid()',             '@@AUTH@@');
  -- normaliza chamadas qualificadas (erp.@@X@@ → @@X@@)
  expr := replace(expr, 'erp.@@SAFE@@',  '@@SAFE@@');
  expr := replace(expr, 'erp.@@ADMIN@@', '@@ADMIN@@');
  expr := replace(expr, 'erp.@@UID@@',   '@@UID@@');
  expr := replace(expr, '@@SAFE@@',  '(SELECT erp.is_erp_admin_safe())');
  expr := replace(expr, '@@ADMIN@@', '(SELECT erp.is_erp_admin())');
  expr := replace(expr, '@@UID@@',   '(SELECT erp.current_erp_user_id())');
  expr := replace(expr, '@@AUTH@@',  '(SELECT auth.uid())');
  RETURN expr;
END;
$fix$;

DO $$
DECLARE
  r record;
  new_qual text;
  new_check text;
  stmt text;
BEGIN
  FOR r IN SELECT * FROM pg_policies WHERE schemaname = 'erp' LOOP
    new_qual  := erp._mig036_fix_expr(r.qual);
    new_check := erp._mig036_fix_expr(r.with_check);
    IF coalesce(new_qual, '') IS DISTINCT FROM coalesce(r.qual, '')
       OR coalesce(new_check, '') IS DISTINCT FROM coalesce(r.with_check, '') THEN
      stmt := format('ALTER POLICY %I ON erp.%I', r.policyname, r.tablename);
      IF new_qual  IS NOT NULL THEN stmt := stmt || format(' USING (%s)', new_qual); END IF;
      IF new_check IS NOT NULL THEN stmt := stmt || format(' WITH CHECK (%s)', new_check); END IF;
      EXECUTE stmt;
    END IF;
  END LOOP;
END $$;

DROP FUNCTION erp._mig036_fix_expr(text);

-- ----------------------------------------------------------------------------
-- 5) ÍNDICES DE FK — tabelas transacionais
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_erp_venda_itens_venda      ON erp.erp_venda_itens (venda_id);
CREATE INDEX IF NOT EXISTS idx_erp_venda_itens_produto    ON erp.erp_venda_itens (produto_id);
CREATE INDEX IF NOT EXISTS idx_erp_venda_itens_kit        ON erp.erp_venda_itens (kit_id) WHERE kit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_venda_itens_servico    ON erp.erp_venda_itens (servico_id) WHERE servico_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_vendas_usuario         ON erp.erp_vendas (usuario_id);
CREATE INDEX IF NOT EXISTS idx_erp_vendas_vendedor        ON erp.erp_vendas (vendedor_id) WHERE vendedor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_venda_taxas_bandeira   ON erp.erp_venda_taxas (bandeira_id);
CREATE INDEX IF NOT EXISTS idx_erp_caixa_mov_caixa        ON erp.erp_caixa_movimentacoes (caixa_id);
CREATE INDEX IF NOT EXISTS idx_erp_caixa_mov_pessoa       ON erp.erp_caixa_movimentacoes (pessoa_id) WHERE pessoa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_contas_loja            ON erp.erp_contas (loja_id);
CREATE INDEX IF NOT EXISTS idx_erp_contas_venda           ON erp.erp_contas (venda_id) WHERE venda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_lotes_produto          ON erp.erp_lotes (produto_id);
CREATE INDEX IF NOT EXISTS idx_erp_lotes_loja             ON erp.erp_lotes (loja_id);
CREATE INDEX IF NOT EXISTS idx_erp_compras_fornecedor     ON erp.erp_compras (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_erp_compras_loja           ON erp.erp_compras (loja_id);
CREATE INDEX IF NOT EXISTS idx_erp_compras_usuario        ON erp.erp_compras (usuario_id);
CREATE INDEX IF NOT EXISTS idx_erp_compra_itens_compra    ON erp.erp_compra_itens (compra_id);
CREATE INDEX IF NOT EXISTS idx_erp_compra_itens_produto   ON erp.erp_compra_itens (produto_id);
CREATE INDEX IF NOT EXISTS idx_erp_nf_loja                ON erp.erp_notas_fiscais (loja_id);
CREATE INDEX IF NOT EXISTS idx_erp_nf_venda               ON erp.erp_notas_fiscais (venda_id) WHERE venda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_pedidos_cliente        ON erp.erp_pedidos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_erp_pedidos_loja           ON erp.erp_pedidos (loja_id);
CREATE INDEX IF NOT EXISTS idx_erp_pedidos_venda          ON erp.erp_pedidos (venda_id) WHERE venda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_pedidos_transp         ON erp.erp_pedidos (transportadora_id) WHERE transportadora_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_cheques_conta          ON erp.erp_cheques (conta_id) WHERE conta_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_cheques_pessoa         ON erp.erp_cheques (pessoa_id) WHERE pessoa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_cheques_venda          ON erp.erp_cheques (venda_id) WHERE venda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_crediario_venda        ON erp.erp_crediario_parcelas (venda_id);
CREATE INDEX IF NOT EXISTS idx_erp_boletos_conta          ON erp.erp_boletos (conta_id) WHERE conta_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_promissorias_conta     ON erp.erp_promissorias (conta_id) WHERE conta_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_promissorias_venda     ON erp.erp_promissorias (venda_id) WHERE venda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_remessas_venda         ON erp.erp_remessas (venda_id) WHERE venda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_remessas_usuario       ON erp.erp_remessas (usuario_id);
CREATE INDEX IF NOT EXISTS idx_erp_remessas_transp        ON erp.erp_remessas (transportadora_id) WHERE transportadora_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_remessas_nfe_rem       ON erp.erp_remessas (nfe_remessa_id) WHERE nfe_remessa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_remessas_nfe_ret       ON erp.erp_remessas (nfe_retorno_id) WHERE nfe_retorno_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_remessa_itens_lote     ON erp.erp_remessa_itens (lote_id) WHERE lote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_nfe_entrada_compra     ON erp.erp_nfe_entrada (compra_id) WHERE compra_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_nfe_entrada_usuario    ON erp.erp_nfe_entrada (usuario_id) WHERE usuario_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_fidelidade_mov_venda   ON erp.erp_cartao_fidelidade_movimentacoes (venda_id) WHERE venda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_docs_pessoa            ON erp.erp_documentos (pessoa_relacionada_id) WHERE pessoa_relacionada_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_docs_venda             ON erp.erp_documentos (venda_relacionada_id) WHERE venda_relacionada_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_agenda_loja            ON erp.erp_agenda_compromissos (loja_id) WHERE loja_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_sangrias_usuario       ON erp.erp_sangrias (usuario_id);
CREATE INDEX IF NOT EXISTS idx_erp_entradas_usuario       ON erp.erp_entradas_extras (usuario_id);
CREATE INDEX IF NOT EXISTS idx_erp_notif_pessoa           ON erp.erp_notificacoes (pessoa_id) WHERE pessoa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_notif_venda            ON erp.erp_notificacoes (venda_id) WHERE venda_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6) updated_at onde a coluna existe sem trigger
-- ----------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN pg_class pc ON pc.relname = c.table_name
    JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = 'erp'
    WHERE c.table_schema = 'erp' AND c.column_name = 'updated_at' AND pc.relkind = 'r'
      AND NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        WHERE t.tgrelid = pc.oid AND NOT t.tgisinternal
          AND t.tgname ILIKE '%updated_at%'
      )
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON erp.%I FOR EACH ROW EXECUTE FUNCTION erp.erp_set_updated_at()',
      r.table_name, r.table_name);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 7) Timeouts por role + estatísticas
-- ----------------------------------------------------------------------------
ALTER ROLE authenticated SET statement_timeout = '30s';
ALTER ROLE authenticated SET idle_in_transaction_session_timeout = '60s';

ANALYZE;

-- PostgREST: recarregar schema cache
NOTIFY pgrst, 'reload schema';
