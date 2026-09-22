-- ============================================================
-- 078 — leitura por papel: operador de caixa lia salário e financeiro
--
-- Toda tabela do ERP tinha a MESMA policy de leitura:
--
--   CREATE POLICY erp_user_select ... USING (current_erp_user_id() IS NOT NULL)
--
-- ou seja: qualquer usuário autenticado lia TUDO. A escrita era restrita a
-- admin/gerente, a leitura não. Medido com o JWT de um usuário de papel
-- `caixa`: 2 contas do financeiro, 1 funcionário (com salário), 2
-- certificados digitais, 2 dados empresariais. O menu escondia parte das
-- telas, mas esconder no front não é trava — a URL digitada abria, e a API
-- respondia.
--
-- Aqui fica a camada que realmente protege. Três tabelas passam a exigir
-- papel; as demais seguem como estão (catálogo, estoque e vendas são
-- operação do balcão).
--
--   · erp_funcionarios       → admin/gerente (salário, PIS, CTPS, RG)
--   · erp_contas             → admin/gerente (financeiro da loja)
--   · erp_certificados_digitais → admin (certificado A1 e senha)
--
-- O PDV precisa da LISTA DE VENDEDORES para a comissão, e ela vinha de
-- erp_funcionarios. Para não devolver salário ao balcão, a lista passa a
-- vir de v_erp_vendedores — view sem os campos de folha, que roda com os
-- direitos do dono e por isso não esbarra na policy nova.
-- ============================================================

BEGIN;

-- ---------- helpers de papel ----------
-- is_erp_admin() já existe e cobre admin+gerente; is_erp_admin_safe() só admin.
-- Falta o papel em si, para políticas que precisem de mais granularidade.
CREATE OR REPLACE FUNCTION erp.papel_atual()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'erp', 'public' AS $$
  SELECT role::text FROM erp.erp_usuarios WHERE id = erp.current_erp_user_id() LIMIT 1;
$$;

COMMENT ON FUNCTION erp.papel_atual() IS
  'Papel principal do usuário logado. Para policies que precisam distinguir gerente de caixa.';

GRANT EXECUTE ON FUNCTION erp.papel_atual() TO authenticated;

-- ---------- vendedores para o balcão, sem folha ----------
-- View sem security_invoker: roda com os direitos do dono, então o caixa
-- lê a lista mesmo sem poder ler erp_funcionarios.
CREATE OR REPLACE VIEW erp.v_erp_vendedores AS
  SELECT f.id,
         f.pessoa_id,
         p.nome_razao AS nome,
         f.cargo,
         f.usuario_id,
         f.data_demissao,
         (f.data_demissao IS NULL) AS ativo
    FROM erp.erp_funcionarios f
    JOIN erp.erp_pessoas p ON p.id = f.pessoa_id;

COMMENT ON VIEW erp.v_erp_vendedores IS
  'Quem pode ser escolhido como vendedor no PDV. Sem salário, comissão, PIS, CTPS ou RG — o balcão não precisa e não deve ver.';

GRANT SELECT ON erp.v_erp_vendedores TO authenticated;

-- ---------- leitura restrita ----------
DROP POLICY IF EXISTS erp_user_select ON erp.erp_funcionarios;
CREATE POLICY erp_gestao_select_funcionarios ON erp.erp_funcionarios
  FOR SELECT TO authenticated
  USING ((SELECT erp.is_erp_admin()));

DROP POLICY IF EXISTS erp_user_select ON erp.erp_contas;
CREATE POLICY erp_gestao_select_contas ON erp.erp_contas
  FOR SELECT TO authenticated
  USING ((SELECT erp.is_erp_admin()));

DROP POLICY IF EXISTS erp_user_select ON erp.erp_certificados_digitais;
CREATE POLICY erp_admin_select_certificados ON erp.erp_certificados_digitais
  FOR SELECT TO authenticated
  USING ((SELECT erp.is_erp_admin_safe()));

COMMENT ON POLICY erp_gestao_select_funcionarios ON erp.erp_funcionarios IS
  'Folha de pagamento é de admin/gerente. O PDV usa v_erp_vendedores.';
COMMENT ON POLICY erp_gestao_select_contas ON erp.erp_contas IS
  'Financeiro da loja é de admin/gerente.';
COMMENT ON POLICY erp_admin_select_certificados ON erp.erp_certificados_digitais IS
  'Certificado A1 e senha: só o administrador.';

COMMIT;
