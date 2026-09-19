-- ============================================================
-- 073 — vários papéis por usuário + permissões padrão por papel editáveis
--
-- Até aqui um usuário tinha UM papel (`role`) e as permissões de cada papel
-- viviam em código (ROLE_PERMISSIONS no front). Pedido: um usuário poder ser
-- gerente E estoquista, e o admin poder mudar o que cada papel enxerga sem
-- mexer em código.
--
-- Duas decisões que valem a pena entender:
--
-- 1. `role` CONTINUA existindo e continua sendo o que o RLS consulta
--    (is_erp_admin = admin/gerente; is_erp_admin_safe = admin). Ele passa a
--    ser o "papel principal": o mais alto entre os papéis do usuário. A lista
--    completa fica em `papeis`; o trigger garante que `role` sempre está nela.
--    Assim nenhuma policy muda, e o acesso ao banco continua governado pelo
--    papel mais forte que o admin escolheu — sem surpresa.
--
-- 2. As permissões padrão de cada papel vão para `erp_papel_permissoes`,
--    semeadas com o mapa que estava no código. O front lê daqui (com o mapa
--    do código como reserva se a tabela ainda não tiver sido lida). Elas
--    controlam NAVEGAÇÃO (menu e botões); a barreira de banco é o `role`.
-- ============================================================

BEGIN;

-- ---------- papéis ----------
ALTER TABLE erp.erp_usuarios
  ADD COLUMN IF NOT EXISTS papeis erp.erp_user_role[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN erp.erp_usuarios.papeis IS
  'Todos os papéis do usuário. `role` é o principal (o mais alto) e sempre está aqui — o trigger garante.';

UPDATE erp.erp_usuarios SET papeis = ARRAY[role] WHERE NOT (role = ANY(papeis));

CREATE OR REPLACE FUNCTION erp.usuarios_papeis_coerentes()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.papeis IS NULL THEN NEW.papeis := '{}'; END IF;
  -- o papel principal (o que o RLS consulta) sempre está entre os papéis
  IF NOT (NEW.role = ANY(NEW.papeis)) THEN
    NEW.papeis := array_append(NEW.papeis, NEW.role);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_usuarios_papeis ON erp.erp_usuarios;
CREATE TRIGGER trg_usuarios_papeis
  BEFORE INSERT OR UPDATE OF role, papeis ON erp.erp_usuarios
  FOR EACH ROW EXECUTE FUNCTION erp.usuarios_papeis_coerentes();

-- ---------- permissões padrão por papel ----------
CREATE TABLE IF NOT EXISTS erp.erp_papel_permissoes (
  papel       erp.erp_user_role PRIMARY KEY,
  permissoes  text[]      NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid        REFERENCES erp.erp_usuarios(id) ON DELETE SET NULL
);

COMMENT ON TABLE erp.erp_papel_permissoes IS
  'Permissões de navegação padrão de cada papel. Editável em Usuários e Permissões › Papéis. Usuário com `permissoes` próprio ignora isto.';

-- semente: exatamente o que estava em ROLE_PERMISSIONS no front
INSERT INTO erp.erp_papel_permissoes (papel, permissoes) VALUES
  ('admin', ARRAY[
    'pdv.usar','caixa.abrir','caixa.fechar','venda.criar','venda.cancelar','venda.desconto',
    'produto.ver','produto.criar','produto.editar','produto.excluir',
    'estoque.ver','estoque.ajustar','estoque.transferir',
    'cliente.ver','cliente.criar','cliente.editar',
    'compra.ver','compra.criar','compra.receber',
    'financeiro.ver','financeiro.lancar','financeiro.conciliar',
    'fiscal.emitir','relatorio.ver','relatorio.exportar',
    'config.ver','config.editar','usuario.ver','usuario.criar','usuario.editar',
    'loja.ver','loja.criar','loja.editar']),
  ('gerente', ARRAY[
    'pdv.usar','caixa.abrir','caixa.fechar','venda.criar','venda.cancelar','venda.desconto',
    'produto.ver','produto.criar','produto.editar',
    'estoque.ver','estoque.ajustar','estoque.transferir',
    'cliente.ver','cliente.criar','cliente.editar',
    'compra.ver','compra.criar','compra.receber',
    'financeiro.ver','financeiro.lancar','financeiro.conciliar',
    'fiscal.emitir','relatorio.ver','relatorio.exportar',
    'config.ver','loja.ver']),
  ('caixa', ARRAY[
    'pdv.usar','caixa.abrir','venda.criar',
    'produto.ver','estoque.ver',
    'cliente.ver','cliente.criar']),
  ('estoquista', ARRAY[
    'produto.ver','produto.criar','produto.editar',
    'estoque.ver','estoque.ajustar','estoque.transferir',
    'compra.ver','compra.criar','compra.receber',
    'relatorio.ver','loja.ver'])
ON CONFLICT (papel) DO NOTHING;

ALTER TABLE erp.erp_papel_permissoes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON erp.erp_papel_permissoes TO authenticated;

DROP POLICY IF EXISTS erp_papel_permissoes_select ON erp.erp_papel_permissoes;
CREATE POLICY erp_papel_permissoes_select ON erp.erp_papel_permissoes
  FOR SELECT TO authenticated USING (true);

-- só admin (is_erp_admin_safe = role admin) altera
DROP POLICY IF EXISTS erp_papel_permissoes_admin ON erp.erp_papel_permissoes;
CREATE POLICY erp_papel_permissoes_admin ON erp.erp_papel_permissoes
  FOR ALL TO authenticated
  USING ((SELECT erp.is_erp_admin_safe()))
  WITH CHECK ((SELECT erp.is_erp_admin_safe()));

-- ---------- importar do CRM ----------
-- ERP e CRM dividem o MESMO auth.users. Quem já tem login no CRM não precisa
-- de convite por e-mail (que, aliás, cai na tela do CRM porque SITE_URL é
-- compartilhada): basta criar a linha em erp_usuarios com o mesmo id e dar
-- os papéis. Esta função lista quem está nessa situação — só para admin.
CREATE OR REPLACE FUNCTION erp.usuarios_crm_disponiveis()
RETURNS TABLE (id uuid, email text, nome text, criado_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = erp, public, auth AS $$
  SELECT u.id,
         u.email::text,
         coalesce(p.nome, u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1)) AS nome,
         u.created_at
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
   WHERE erp.is_erp_admin_safe()
     AND u.deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM erp.erp_usuarios e WHERE e.id = u.id)
   ORDER BY 3;
$$;
REVOKE ALL ON FUNCTION erp.usuarios_crm_disponiveis() FROM public;
GRANT EXECUTE ON FUNCTION erp.usuarios_crm_disponiveis() TO authenticated;

SELECT 'usuarios com papeis: ' || count(*) FILTER (WHERE cardinality(papeis) > 0) || '/' || count(*)
    || ' · papeis com permissoes: ' || (SELECT count(*) FROM erp.erp_papel_permissoes) AS resultado
  FROM erp.erp_usuarios;

COMMIT;
