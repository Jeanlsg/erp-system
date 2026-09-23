-- ============================================================
-- 092 — Quais caixas cada conta pode abrir, e vários caixas no admin
--
-- Duas mudanças pedidas juntas, e que dependem uma da outra:
--
--   (a) Limitar quais caixas cada conta abre. Hoje qualquer usuário do ERP
--       abre qualquer caixa de qualquer loja. Numa operação com Petrolina e
--       Juazeiro isso é o operador de uma loja abrindo o caixa da outra.
--
--   (b) Deixar o admin manter mais de um caixa aberto e alternar entre eles.
--       Hoje é impossível por duas razões no banco:
--         - uq_erp_caixa_aberto_por_usuario, índice único de 1 caixa aberto
--           por usuário;
--         - fn_fechar_caixa_anterior, gatilho que FECHA SOZINHO o caixa
--           anterior do usuário ao abrir outro.
--
-- O gatilho continua valendo para quem NÃO pode ter vários — nada muda para
-- o operador de balcão. Para quem pode, ele sai do caminho.
--
-- ATENÇÃO, registrado e não alterado aqui: esse fechamento automático grava
-- o caixa anterior sem ninguém contar a gaveta, com a observação "Fechado
-- automaticamente ao abrir novo caixa". O turno esquecido de ontem morre sem
-- conferência. O caminho certo é recusar a abertura e mandar fechar o
-- anterior (há fechamento indireto desde a 089), mas isso muda a rotina da
-- manhã do balcão e precisa da sua decisão.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- (a) Lista de caixas que a conta pode abrir
--
-- Sem linha nenhuma = sem restrição. É o que mantém todo usuário existente
-- funcionando: a trava só passa a existir quando alguém for de fato
-- restringido na tela de usuários.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS erp.erp_usuario_pontos_venda (
  usuario_id uuid NOT NULL REFERENCES erp.erp_usuarios(id) ON DELETE CASCADE,
  ponto_venda_id uuid NOT NULL REFERENCES erp.erp_pontos_venda(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, ponto_venda_id)
);

ALTER TABLE erp.erp_usuario_pontos_venda ENABLE ROW LEVEL SECURITY;

-- Ler é liberado: o PDV precisa saber quais caixas oferecer.
DROP POLICY IF EXISTS erp_usuario_pv_select ON erp.erp_usuario_pontos_venda;
CREATE POLICY erp_usuario_pv_select ON erp.erp_usuario_pontos_venda
  FOR SELECT USING ((SELECT erp.current_erp_user_id()) IS NOT NULL);

-- Escrever é decisão de acesso: só admin/gerente. Sem isto, o operador
-- ampliaria a própria lista com uma chamada de API.
DROP POLICY IF EXISTS erp_usuario_pv_admin ON erp.erp_usuario_pontos_venda;
CREATE POLICY erp_usuario_pv_admin ON erp.erp_usuario_pontos_venda
  FOR ALL USING ((SELECT erp.is_erp_admin())) WITH CHECK ((SELECT erp.is_erp_admin()));

GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_usuario_pontos_venda TO authenticated, service_role;

CREATE OR REPLACE FUNCTION erp.pode_abrir_ponto_venda(p_usuario uuid, p_ponto uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = erp, public
AS $$
  SELECT
    -- conta sem lista definida abre qualquer caixa
    NOT EXISTS (SELECT 1 FROM erp.erp_usuario_pontos_venda WHERE usuario_id = p_usuario)
    OR EXISTS (
      SELECT 1 FROM erp.erp_usuario_pontos_venda
      WHERE usuario_id = p_usuario AND ponto_venda_id = p_ponto
    );
$$;

GRANT EXECUTE ON FUNCTION erp.pode_abrir_ponto_venda(uuid, uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- (b) Quem pode manter mais de um caixa aberto
--
-- Só admin. Gerente e caixa continuam com um turno por vez: dois caixas
-- abertos no mesmo nome significa duas gavetas sob a mesma conferência, e
-- quem responde por isso é a administração.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION erp.pode_multiplos_caixas(p_usuario uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = erp, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM erp.erp_usuarios
    WHERE id = p_usuario AND ativo AND (admin_principal OR role = 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION erp.pode_multiplos_caixas(uuid) TO authenticated, service_role;

-- O índice único impedia o segundo caixa aberto no mesmo usuário. A regra
-- passa a ser do gatilho, que sabe distinguir quem pode de quem não pode.
DROP INDEX IF EXISTS erp.uq_erp_caixa_aberto_por_usuario;

-- Duas pessoas no mesmo caixa físico ao mesmo tempo não existe: a gaveta é
-- uma só e a conferência sairia embaralhada.
CREATE UNIQUE INDEX IF NOT EXISTS uq_erp_caixa_aberto_por_ponto
  ON erp.erp_caixa (ponto_venda_id)
  WHERE status = 'aberto' AND data_fechamento IS NULL AND ponto_venda_id IS NOT NULL;

-- ------------------------------------------------------------
-- Gatilho de abertura: valida a lista e preserva o caixa anterior de quem
-- pode ter vários.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION erp.fn_fechar_caixa_anterior()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
BEGIN
  IF NEW.status = 'aberto' AND NEW.data_fechamento IS NULL THEN

    -- (a) a conta pode abrir ESTE caixa?
    IF NEW.ponto_venda_id IS NOT NULL
       AND NOT erp.pode_abrir_ponto_venda(NEW.usuario_id, NEW.ponto_venda_id) THEN
      RAISE EXCEPTION
        'Esta conta não tem permissão para abrir este caixa. Fale com o administrador.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- (b) quem pode ter vários mantém os anteriores abertos
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

COMMIT;
NOTIFY pgrst, 'reload schema';
