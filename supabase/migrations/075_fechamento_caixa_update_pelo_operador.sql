-- ============================================================
-- 075 — operador de caixa não conseguia fechar o próprio caixa
--
-- Erro na tela: "new row violates row-level security policy (USING
-- expression) for table erp_fechamentos_caixa". O "USING" entrega: é a
-- parte de UPDATE de um upsert.
--
-- O fechamento acontece em dois passos: a tela marca o caixa como fechado,
-- o trigger fn_criar_fechamento_automatico insere a linha de fechamento
-- (com dinheiro/PIX/cartão ZERADOS), e a tela faz upsert por caixa_id para
-- preencher o detalhamento. Como a linha já existe, o upsert vira UPDATE —
-- e a única policy de UPDATE era is_erp_admin() (admin/gerente). Para o
-- papel caixa: caixa fechado, erro na tela, detalhamento em zero.
--
-- Permissão dada em Usuários e Permissões não muda isto: aquilo é
-- navegação; RLS olha o role.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS erp_user_update_fechamentos ON erp.erp_fechamentos_caixa;
CREATE POLICY erp_user_update_fechamentos ON erp.erp_fechamentos_caixa
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM erp.erp_caixa c
             WHERE c.id = erp_fechamentos_caixa.caixa_id
               AND c.usuario_id = erp.current_erp_user_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM erp.erp_caixa c
             WHERE c.id = erp_fechamentos_caixa.caixa_id
               AND c.usuario_id = erp.current_erp_user_id())
  );

COMMENT ON POLICY erp_user_update_fechamentos ON erp.erp_fechamentos_caixa IS
  'Quem abriu o caixa preenche o próprio fechamento (o trigger cria a linha zerada; a tela completa por upsert).';

COMMIT;
