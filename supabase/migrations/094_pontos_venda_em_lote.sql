-- ============================================================
-- 094 — Caixas criados por quantidade, renomeados e apagados
--
-- Pedido: criar os caixas pela quantidade, já com nome "Caixa 1", "Caixa 2"...
-- e poder renomear e apagar depois.
--
-- Duas regras que não podem ficar na tela:
--
--   Numeração. O número do caixa é o que sai no cupom e separa os turnos no
--   relatório. Calcular "o próximo" na tela e inserir em seguida deixa duas
--   pessoas criarem o mesmo número ao mesmo tempo. Aqui a loja é travada
--   enquanto o lote é criado.
--
--   Apagar. erp_caixa.ponto_venda_id é ON DELETE SET NULL: apagar um caixa
--   com turnos no histórico apagaria de qual caixa cada turno foi, e o
--   relatório de fechamento perderia o nome. Caixa com histórico é arquivado
--   (some das listas, o histórico fica); sem histórico, é apagado de fato.
--   Caixa com turno aberto é recusado.
-- ============================================================

BEGIN;

-- nome vazio não identifica caixa nenhum
ALTER TABLE erp.erp_pontos_venda DROP CONSTRAINT IF EXISTS erp_pontos_venda_nome_preenchido;
ALTER TABLE erp.erp_pontos_venda
  ADD CONSTRAINT erp_pontos_venda_nome_preenchido CHECK (btrim(nome) <> '');

-- dois "Caixa 2" visíveis na mesma loja confundem quem escolhe na abertura;
-- arquivados não contam, para o nome poder voltar a ser usado
CREATE UNIQUE INDEX IF NOT EXISTS uq_erp_pontos_venda_nome_ativo
  ON erp.erp_pontos_venda (loja_id, lower(btrim(nome)))
  WHERE ativo;

CREATE OR REPLACE FUNCTION erp.criar_pontos_venda(p_loja_id uuid, p_quantidade integer)
RETURNS SETOF erp.erp_pontos_venda
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
DECLARE
  v_numero integer;
  v_nome text;
  v_k integer;
  i integer;
BEGIN
  IF NOT erp.is_erp_admin() THEN
    RAISE EXCEPTION 'Só administrador ou gerente cria caixas.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_quantidade IS NULL OR p_quantidade < 1 OR p_quantidade > 20 THEN
    RAISE EXCEPTION 'Quantidade de caixas entre 1 e 20.';
  END IF;

  -- trava a loja: dois lotes ao mesmo tempo não disputam o mesmo número
  PERFORM 1 FROM erp.erp_lojas WHERE id = p_loja_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loja não encontrada.'; END IF;

  -- inclui arquivados: o número de um caixa arquivado continua dele no
  -- histórico, e reaproveitá-lo misturaria turnos antigos com o caixa novo
  SELECT coalesce(max(numero), 0) INTO v_numero
  FROM erp.erp_pontos_venda WHERE loja_id = p_loja_id;

  FOR i IN 1..p_quantidade LOOP
    v_numero := v_numero + 1;
    v_nome := 'Caixa ' || v_numero;
    v_k := 2;
    -- alguém pode ter renomeado outro caixa para "Caixa N"
    WHILE EXISTS (SELECT 1 FROM erp.erp_pontos_venda
                  WHERE loja_id = p_loja_id AND ativo
                    AND lower(btrim(nome)) = lower(v_nome)) LOOP
      v_nome := 'Caixa ' || v_numero || ' (' || v_k || ')';
      v_k := v_k + 1;
    END LOOP;

    RETURN QUERY
      INSERT INTO erp.erp_pontos_venda (loja_id, numero, nome)
      VALUES (p_loja_id, v_numero, v_nome)
      RETURNING *;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION erp.criar_pontos_venda(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION erp.criar_pontos_venda(uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION erp.remover_ponto_venda(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
DECLARE
  v_turnos integer;
BEGIN
  IF NOT erp.is_erp_admin() THEN
    RAISE EXCEPTION 'Só administrador ou gerente apaga caixas.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM erp.erp_pontos_venda WHERE id = p_id) THEN
    RAISE EXCEPTION 'Caixa não encontrado.';
  END IF;

  IF EXISTS (SELECT 1 FROM erp.erp_caixa
             WHERE ponto_venda_id = p_id AND status = 'aberto' AND data_fechamento IS NULL) THEN
    RAISE EXCEPTION 'Este caixa está com um turno aberto. Feche o turno antes de apagar.';
  END IF;

  SELECT count(*) INTO v_turnos FROM erp.erp_caixa WHERE ponto_venda_id = p_id;

  IF v_turnos > 0 THEN
    UPDATE erp.erp_pontos_venda SET ativo = false WHERE id = p_id;
    RETURN 'arquivado';
  END IF;

  DELETE FROM erp.erp_pontos_venda WHERE id = p_id;
  RETURN 'apagado';
END;
$$;

REVOKE ALL ON FUNCTION erp.remover_ponto_venda(uuid) FROM public;
GRANT EXECUTE ON FUNCTION erp.remover_ponto_venda(uuid) TO authenticated, service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
