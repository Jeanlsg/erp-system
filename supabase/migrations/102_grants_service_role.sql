-- ============================================================
-- 102 — GRANT para service_role nas tabelas que as edges leem.
--
-- A 087 deu GRANT só para authenticated. As edges usam a service key
-- (service_role ignora RLS, mas não o GRANT) e o PostgREST respondia
-- "permission denied" — o supabase-js devolve data = null e a edge
-- erp-emitir-nfe dizia "devolução não encontrada" para todo espelho e
-- toda NF-e de devolução a fornecedor. Achado no teste ao vivo de 10/10.
--
-- erp_orcamentos/itens: mesmo caso no erp-crm-sync (orçamento → lead).
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_devolucoes_fornecedor      TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_devolucao_fornecedor_itens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_orcamentos                 TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_orcamento_itens            TO service_role;
