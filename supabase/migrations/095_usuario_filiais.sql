-- ============================================================
-- 095 — Em quais filiais cada usuário trabalha
--
-- Pedido: fora o dono, ninguém alterna entre as lojas, a menos que esteja
-- cadastrado em mais de uma filial.
--
-- Até aqui o usuário tinha só loja_default_id — uma sugestão de qual loja
-- abrir, que qualquer um trocava no seletor do topo. Agora:
--
--   - o dono (admin_principal) trabalha em todas, sempre;
--   - os demais, só nas filiais cadastradas aqui. Uma filial = seletor fixo;
--     duas ou mais = seletor com essas.
--
-- O banco recusa abrir caixa em filial que não é do usuário. É por aí que
-- dinheiro entra; sem esta trava, trocar a loja guardada no navegador
-- bastava para vender na filial vizinha.
--
-- NÃO coberto aqui, registrado no plano: a LEITURA dos dados ainda não é
-- separada por filial no banco. As telas passam a mostrar só as filiais do
-- usuário, mas quem chamar a API direto lê as duas.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS erp.erp_usuario_lojas (
  usuario_id uuid NOT NULL REFERENCES erp.erp_usuarios(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES erp.erp_lojas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, loja_id)
);

ALTER TABLE erp.erp_usuario_lojas ENABLE ROW LEVEL SECURITY;

-- cada um lê as próprias filiais; admin lê todas (tela de usuários)
DROP POLICY IF EXISTS erp_usuario_lojas_select ON erp.erp_usuario_lojas;
CREATE POLICY erp_usuario_lojas_select ON erp.erp_usuario_lojas
  FOR SELECT USING (
    usuario_id = (SELECT erp.current_erp_user_id())
    OR (SELECT erp.is_erp_admin_safe())
  );

-- mudar filial é decisão de acesso: mesmo critério de protege_campos_de_acesso
DROP POLICY IF EXISTS erp_usuario_lojas_admin ON erp.erp_usuario_lojas;
CREATE POLICY erp_usuario_lojas_admin ON erp.erp_usuario_lojas
  FOR ALL USING ((SELECT erp.is_erp_admin_safe())) WITH CHECK ((SELECT erp.is_erp_admin_safe()));

GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_usuario_lojas TO authenticated, service_role;

-- Filiais em que o usuário trabalha. A regra do dono mora aqui, num lugar só.
CREATE OR REPLACE FUNCTION erp.lojas_do_usuario(p_usuario uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = erp, public
AS $$
  SELECT l.id FROM erp.erp_lojas l
  WHERE EXISTS (SELECT 1 FROM erp.erp_usuarios u WHERE u.id = p_usuario AND u.admin_principal)
  UNION
  SELECT ul.loja_id FROM erp.erp_usuario_lojas ul WHERE ul.usuario_id = p_usuario;
$$;

GRANT EXECUTE ON FUNCTION erp.lojas_do_usuario(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION erp.usuario_tem_loja(p_usuario uuid, p_loja uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = erp, public
AS $$
  SELECT EXISTS (SELECT 1 FROM erp.lojas_do_usuario(p_usuario) x WHERE x = p_loja);
$$;

GRANT EXECUTE ON FUNCTION erp.usuario_tem_loja(uuid, uuid) TO authenticated, service_role;

-- Carga inicial. Quem tinha loja padrão fica nela.
INSERT INTO erp.erp_usuario_lojas (usuario_id, loja_id)
SELECT u.id, u.loja_default_id FROM erp.erp_usuarios u
WHERE NOT coalesce(u.admin_principal, false) AND u.loja_default_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- jean (conta de teste do dono, papel caixa) não tinha loja padrão e já
-- abriu caixa nas duas. Fica em Juazeiro, onde está o turno dele ainda
-- aberto — em qualquer outra, ele não conseguiria fechá-lo. Ajustável na
-- tela de usuários.
INSERT INTO erp.erp_usuario_lojas (usuario_id, loja_id)
SELECT '49320f25-807c-4c95-9f06-9ea39293c05e', 'e385d4aa-e724-440b-8336-88daafe06ed4'
WHERE EXISTS (SELECT 1 FROM erp.erp_usuarios WHERE id = '49320f25-807c-4c95-9f06-9ea39293c05e')
ON CONFLICT DO NOTHING;

-- Abrir caixa: agora também confere a filial do usuário.
CREATE OR REPLACE FUNCTION erp.fn_fechar_caixa_anterior()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
BEGIN
  IF NEW.status = 'aberto' AND NEW.data_fechamento IS NULL THEN

    -- o usuário trabalha nesta filial?
    IF NOT erp.usuario_tem_loja(NEW.usuario_id, NEW.loja_id) THEN
      RAISE EXCEPTION
        'Este usuário não está cadastrado nesta filial. Fale com o administrador.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- a conta pode abrir ESTE caixa? (092)
    IF NEW.ponto_venda_id IS NOT NULL
       AND NOT erp.pode_abrir_ponto_venda(NEW.usuario_id, NEW.ponto_venda_id) THEN
      RAISE EXCEPTION
        'Esta conta não tem permissão para abrir este caixa. Fale com o administrador.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- quem pode ter vários mantém os anteriores abertos (092)
    IF NOT erp.pode_multiplos_caixas(NEW.usuario_id) THEN
      UPDATE erp.erp_caixa
      SET status = 'fechado',
          data_fechamento = NOW(),
          observacoes = COALESCE(observacoes, '') || ' | Fechado automaticamente ao abrir novo caixa'
      WHERE usuario_id = NEW.usuario_id
        AND status = 'aberto'
        AND data_fechamento IS NULL
        AND id != NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

SELECT 'vinculos: '||u.nome||' -> '||l.apelido
FROM erp.erp_usuario_lojas ul JOIN erp.erp_usuarios u ON u.id=ul.usuario_id JOIN erp.erp_lojas l ON l.id=ul.loja_id;

COMMIT;
NOTIFY pgrst, 'reload schema';
