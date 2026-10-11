-- ============================================================
-- 109 — Reabrir devolução a fornecedor recusada pela SEFAZ (11/10/2026)
--
-- "Gerar Nota de Devolução" baixa o estoque e emite a NF-e. Se a SEFAZ
-- recusa (no teste de 11/10: rejeição 1048, nItem do DFeReferenciado não
-- informado), a devolução ficava "confirmada": estoque fora e nada que a
-- tela deixasse corrigir — só rascunho é editável.
--
-- erp.reabrir_devolucao_fornecedor devolve ao estoque o que a confirmação
-- tirou (as próprias saídas do Kardex, com os lotes consumidos), grava a
-- entrada de estorno e volta a devolução para rascunho. Cada saída é
-- estornada uma vez só (observação "estorno:<id da saída>"). Com nota
-- autorizada não reabre: aí o caminho é cancelar a nota.
-- ============================================================

CREATE OR REPLACE FUNCTION erp.reabrir_devolucao_fornecedor(p_devolucao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'erp', 'public'
AS $$
DECLARE
  d       erp.erp_devolucoes_fornecedor%ROWTYPE;
  m       RECORD;
  l       jsonb;
  v_uid   uuid := erp.current_erp_user_id();
  v_saldo integer;
  v_n     integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'usuário sem perfil no ERP' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO d FROM erp.erp_devolucoes_fornecedor WHERE id = p_devolucao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'devolução não encontrada'; END IF;
  IF d.status <> 'confirmada' THEN
    RAISE EXCEPTION 'só a devolução com estoque baixado e sem nota pode ser reaberta (situação: %)', d.status;
  END IF;
  IF d.nota_fiscal_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM erp.erp_notas_fiscais n
        WHERE n.id = d.nota_fiscal_id AND n.status IN ('autorizada', 'pendente_arquivo')) THEN
    RAISE EXCEPTION 'esta devolução já tem nota autorizada: cancele a nota antes';
  END IF;

  FOR m IN
    SELECT s.* FROM erp.erp_estoque_movimentacoes s
     WHERE s.origem = 'devolucao_fornecedor' AND s.documento_id = p_devolucao_id AND s.tipo = 'saida'
       AND NOT EXISTS (
         SELECT 1 FROM erp.erp_estoque_movimentacoes e
          WHERE e.origem = 'devolucao_fornecedor' AND e.documento_id = p_devolucao_id
            AND e.tipo = 'entrada' AND e.observacao = 'estorno:' || s.id)
     ORDER BY s.created_at
  LOOP
    UPDATE erp.erp_estoque SET quantidade = quantidade + m.quantidade, updated_at = now()
     WHERE produto_id = m.produto_id AND loja_id = m.loja_id
     RETURNING quantidade INTO v_saldo;
    IF NOT FOUND THEN
      INSERT INTO erp.erp_estoque (produto_id, loja_id, quantidade, custo_medio)
      VALUES (m.produto_id, m.loja_id, m.quantidade, m.custo_medio_posterior)
      RETURNING quantidade INTO v_saldo;
    END IF;

    -- os lotes que a saída consumiu voltam para os mesmos lotes
    IF jsonb_typeof(m.lote_detalhe) = 'array' THEN
      FOR l IN SELECT * FROM jsonb_array_elements(m.lote_detalhe) LOOP
        IF l ? 'lote_id' THEN
          UPDATE erp.erp_lotes SET quantidade = quantidade + (l->>'quantidade')::int
           WHERE id = (l->>'lote_id')::uuid;
        END IF;
      END LOOP;
    END IF;

    INSERT INTO erp.erp_estoque_movimentacoes (
      produto_id, loja_id, tipo, origem, documento_id, quantidade,
      saldo_anterior, saldo_posterior, custo_unitario,
      custo_medio_anterior, custo_medio_posterior, valor_total, usuario_id,
      observacao, lote_detalhe
    ) VALUES (
      m.produto_id, m.loja_id, 'entrada', 'devolucao_fornecedor', p_devolucao_id, m.quantidade,
      v_saldo - m.quantidade, v_saldo, m.custo_unitario,
      m.custo_medio_posterior, m.custo_medio_posterior, m.valor_total, v_uid,
      'estorno:' || m.id, m.lote_detalhe
    );
    v_n := v_n + 1;
  END LOOP;

  UPDATE erp.erp_devolucoes_fornecedor SET status = 'rascunho', updated_at = now() WHERE id = p_devolucao_id;
  RETURN jsonb_build_object('devolucao_id', p_devolucao_id, 'itens_estornados', v_n);
END;
$$;

REVOKE ALL ON FUNCTION erp.reabrir_devolucao_fornecedor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION erp.reabrir_devolucao_fornecedor(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
